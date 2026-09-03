using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.Contracts;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service;

public class CostoPropagacionService : ICostoPropagacionService
{
    public const string OrigenCompra = "COMPRA";

    private readonly SistemaKyoGroupContext _db;

    public CostoPropagacionService(SistemaKyoGroupContext db)
    {
        _db = db;
    }

    public async Task PropagarDesdeCompra(Compra compra, int idUsuario)
    {
        if (compra.ComprasInsumos == null || !compra.ComprasInsumos.Any())
            return;

        var costosPorInsumo = new Dictionary<int, decimal>();
        var ahora = DateTime.Now;

        var listaIds = compra.ComprasInsumos.Select(l => l.IdProveedorLista).Distinct().ToList();
        var listasDict = await _db.ProveedoresInsumosListas
            .Where(x => listaIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id);

        var usuarioNombre = await ProveedoresInsumosHistorialHelper.NombreUsuarioAsync(_db, idUsuario);

        foreach (var linea in compra.ComprasInsumos)
        {
            if (!listasDict.TryGetValue(linea.IdProveedorLista, out var lista))
                continue;

            var costoAnterior = lista.CostoUnitario;
            var costoNuevo = linea.PrecioFinal;

            if (costoAnterior == costoNuevo)
            {
                costosPorInsumo[linea.IdInsumo] = costoNuevo;
                continue;
            }

            _db.InsumosCostoHistoriales.Add(new InsumosCostoHistorial
            {
                IdInsumo = linea.IdInsumo,
                CostoAnterior = costoAnterior,
                CostoNuevo = costoNuevo,
                Origen = OrigenCompra,
                IdCompra = compra.Id,
                Fecha = ahora,
                IdUsuario = idUsuario
            });

            var antes = CloneListaSnapshot(lista);
            lista.CostoUnitario = costoNuevo;
            lista.FechaActualizacion = ahora;
            lista.IdUsuarioModifica = idUsuario;
            lista.FechaModifica = ahora;

            ProveedoresInsumosHistorialHelper.AgregarCambioSiCorresponde(
                _db, antes, lista, idUsuario, usuarioNombre,
                ProveedoresInsumosHistorialHelper.OrigenCompra);

            costosPorInsumo[linea.IdInsumo] = costoNuevo;
        }

        if (costosPorInsumo.Count == 0)
            return;

        await RecalcularCadenaCostosAsync(costosPorInsumo, idUsuario);
        await _db.SaveChangesAsync();
    }

    public async Task RevertirDesdeCompra(int idCompra, int idUsuario)
    {
        var historial = await _db.InsumosCostoHistoriales
            .Where(x => x.IdCompra == idCompra && x.Origen == OrigenCompra)
            .ToListAsync();

        var lineasCompra = await _db.ComprasInsumos
            .Where(x => x.IdCompra == idCompra)
            .ToListAsync();

        if (!historial.Any() && !lineasCompra.Any())
            return;

        var listaIds = lineasCompra.Select(l => l.IdProveedorLista).Distinct().ToList();
        var listasDict = await _db.ProveedoresInsumosListas
            .Where(x => listaIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id);

        var costosRestaurados = new Dictionary<int, decimal>();
        var ahora = DateTime.Now;
        var usuarioNombre = await ProveedoresInsumosHistorialHelper.NombreUsuarioAsync(_db, idUsuario);

        if (historial.Any())
        {
            foreach (var h in historial)
            {
                var linea = lineasCompra.FirstOrDefault(x => x.IdInsumo == h.IdInsumo);
                if (linea == null)
                    continue;

                if (!listasDict.TryGetValue(linea.IdProveedorLista, out var lista))
                    continue;

                // Solo revertir si el precio actual sigue siendo el que dejó esta compra
                if (Math.Abs(lista.CostoUnitario - h.CostoNuevo) > 0.0001m)
                    continue;

                var antes = CloneListaSnapshot(lista);
                lista.CostoUnitario = h.CostoAnterior;
                lista.FechaActualizacion = ahora;
                lista.IdUsuarioModifica = idUsuario;
                lista.FechaModifica = ahora;

                ProveedoresInsumosHistorialHelper.AgregarCambioSiCorresponde(
                    _db, antes, lista, idUsuario, usuarioNombre,
                    ProveedoresInsumosHistorialHelper.OrigenCompra);

                costosRestaurados[h.IdInsumo] = h.CostoAnterior;
            }

            _db.InsumosCostoHistoriales.RemoveRange(historial);
        }
        else
        {
            // Fallback compras antiguas sin historial: si el precio actual = factura,
            // volver al PrecioLista (precio OC / lista al momento de la compra).
            foreach (var linea in lineasCompra)
            {
                if (!listasDict.TryGetValue(linea.IdProveedorLista, out var lista))
                    continue;

                if (Math.Abs(lista.CostoUnitario - linea.PrecioFinal) > 0.0001m)
                    continue;
                if (Math.Abs(linea.PrecioFinal - linea.PrecioLista) < 0.0001m)
                    continue;

                var antes = CloneListaSnapshot(lista);
                lista.CostoUnitario = linea.PrecioLista;
                lista.FechaActualizacion = ahora;
                lista.IdUsuarioModifica = idUsuario;
                lista.FechaModifica = ahora;

                ProveedoresInsumosHistorialHelper.AgregarCambioSiCorresponde(
                    _db, antes, lista, idUsuario, usuarioNombre,
                    ProveedoresInsumosHistorialHelper.OrigenCompra);

                costosRestaurados[linea.IdInsumo] = linea.PrecioLista;
            }
        }

        if (costosRestaurados.Count > 0)
            await RecalcularCadenaCostosAsync(costosRestaurados, idUsuario);

        await _db.SaveChangesAsync();
    }

    public async Task<List<CambioPrecioCompra>> PreviewPropagacionAsync(IEnumerable<ComprasInsumo> lineas)
    {
        var lista = (lineas ?? Enumerable.Empty<ComprasInsumo>())
            .Where(l => l.IdProveedorLista > 0 && l.IdInsumo > 0)
            .GroupBy(l => l.IdProveedorLista)
            .Select(g => g.Last())
            .ToList();

        if (lista.Count == 0)
            return new List<CambioPrecioCompra>();

        var listaIds = lista.Select(l => l.IdProveedorLista).Distinct().ToList();
        var insumoIds = lista.Select(l => l.IdInsumo).Distinct().ToList();

        var listasDict = await _db.ProveedoresInsumosListas.AsNoTracking()
            .Where(x => listaIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id);

        var nombres = await _db.Insumos.AsNoTracking()
            .Where(x => insumoIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Descripcion })
            .ToDictionaryAsync(x => x.Id, x => x.Descripcion ?? $"#{x.Id}");

        var cambios = new List<CambioPrecioCompra>();
        foreach (var linea in lista)
        {
            if (!listasDict.TryGetValue(linea.IdProveedorLista, out var pil))
                continue;

            var actual = pil.CostoUnitario;
            var nuevo = linea.PrecioFinal;
            if (Math.Abs(actual - nuevo) < 0.0001m)
                continue;

            nombres.TryGetValue(linea.IdInsumo, out var nombre);
            cambios.Add(new CambioPrecioCompra
            {
                IdInsumo = linea.IdInsumo,
                IdProveedorLista = linea.IdProveedorLista,
                Nombre = !string.IsNullOrWhiteSpace(pil.Descripcion)
                    ? pil.Descripcion!
                    : (nombre ?? $"Insumo #{linea.IdInsumo}"),
                PrecioActual = actual,
                PrecioNuevo = nuevo
            });
        }

        return cambios.OrderBy(c => c.Nombre).ToList();
    }

    public async Task<List<CambioPrecioCompra>> PreviewReversionAsync(int idCompra)
    {
        var historial = await _db.InsumosCostoHistoriales.AsNoTracking()
            .Where(x => x.IdCompra == idCompra && x.Origen == OrigenCompra)
            .ToListAsync();

        var lineasCompra = await _db.ComprasInsumos.AsNoTracking()
            .Where(x => x.IdCompra == idCompra)
            .ToListAsync();

        if (!historial.Any() && !lineasCompra.Any())
            return new List<CambioPrecioCompra>();

        var listaIds = lineasCompra.Select(l => l.IdProveedorLista).Distinct().ToList();
        var listasDict = await _db.ProveedoresInsumosListas.AsNoTracking()
            .Where(x => listaIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id);

        var insumoIds = (historial.Any()
                ? historial.Select(h => h.IdInsumo)
                : lineasCompra.Select(l => l.IdInsumo))
            .Distinct()
            .ToList();

        var nombres = await _db.Insumos.AsNoTracking()
            .Where(x => insumoIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Descripcion })
            .ToDictionaryAsync(x => x.Id, x => x.Descripcion ?? $"#{x.Id}");

        var cambios = new List<CambioPrecioCompra>();

        if (historial.Any())
        {
            foreach (var h in historial)
            {
                var linea = lineasCompra.FirstOrDefault(x => x.IdInsumo == h.IdInsumo);
                if (linea == null)
                    continue;

                if (!listasDict.TryGetValue(linea.IdProveedorLista, out var pil))
                    continue;

                if (Math.Abs(pil.CostoUnitario - h.CostoNuevo) > 0.0001m)
                    continue;

                nombres.TryGetValue(h.IdInsumo, out var nombre);
                cambios.Add(new CambioPrecioCompra
                {
                    IdInsumo = h.IdInsumo,
                    IdProveedorLista = linea.IdProveedorLista,
                    Nombre = !string.IsNullOrWhiteSpace(pil.Descripcion)
                        ? pil.Descripcion!
                        : (nombre ?? $"Insumo #{h.IdInsumo}"),
                    PrecioActual = pil.CostoUnitario,
                    PrecioNuevo = h.CostoAnterior
                });
            }
        }
        else
        {
            foreach (var linea in lineasCompra)
            {
                if (!listasDict.TryGetValue(linea.IdProveedorLista, out var pil))
                    continue;

                if (Math.Abs(pil.CostoUnitario - linea.PrecioFinal) > 0.0001m)
                    continue;
                if (Math.Abs(linea.PrecioFinal - linea.PrecioLista) < 0.0001m)
                    continue;

                nombres.TryGetValue(linea.IdInsumo, out var nombre);
                cambios.Add(new CambioPrecioCompra
                {
                    IdInsumo = linea.IdInsumo,
                    IdProveedorLista = linea.IdProveedorLista,
                    Nombre = !string.IsNullOrWhiteSpace(pil.Descripcion)
                        ? pil.Descripcion!
                        : (nombre ?? $"Insumo #{linea.IdInsumo}"),
                    PrecioActual = pil.CostoUnitario,
                    PrecioNuevo = linea.PrecioLista
                });
            }
        }

        return cambios.OrderBy(c => c.Nombre).ToList();
    }

    private static ProveedoresInsumosLista CloneListaSnapshot(ProveedoresInsumosLista src) => new()
    {
        Id = src.Id,
        IdProveedor = src.IdProveedor,
        Descripcion = src.Descripcion,
        Codigo = src.Codigo,
        Costo = src.Costo,
        CostoUnitario = src.CostoUnitario,
        Cantidad = src.Cantidad,
        PorcDesc = src.PorcDesc
    };

    private async Task RecalcularCadenaCostosAsync(Dictionary<int, decimal> costosPorInsumo, int idUsuario)
    {
        var insumosAfectados = costosPorInsumo.Keys.ToHashSet();
        var subRecetasOrden = await ObtenerSubRecetasOrdenBottomUpAsync(insumosAfectados);

        var costosSubRecetas = new Dictionary<int, decimal>();
        if (subRecetasOrden.Count > 0)
        {
            var existentes = await _db.SubRecetas.AsNoTracking()
                .Where(x => subRecetasOrden.Contains(x.Id))
                .Select(x => new { x.Id, x.CostoUnitario })
                .ToDictionaryAsync(x => x.Id, x => x.CostoUnitario ?? 0m);

            foreach (var kv in existentes)
                costosSubRecetas[kv.Key] = kv.Value;
        }

        foreach (var idSubReceta in subRecetasOrden)
            await RecalcularSubRecetaAsync(idSubReceta, costosPorInsumo, costosSubRecetas, idUsuario);

        var subRecetasAfectadas = subRecetasOrden.ToHashSet();
        var recetasAfectadas = await ObtenerRecetasAfectadasAsync(insumosAfectados, subRecetasAfectadas);

        foreach (var idReceta in recetasAfectadas)
            await RecalcularRecetaAsync(idReceta, costosPorInsumo, costosSubRecetas, idUsuario);
    }

    private async Task<List<int>> ObtenerSubRecetasOrdenBottomUpAsync(HashSet<int> insumosAfectados)
    {
        var directas = await _db.SubRecetasInsumos
            .Where(x => insumosAfectados.Contains(x.IdInsumo))
            .Select(x => x.IdSubReceta)
            .Distinct()
            .ToListAsync();

        var allRels = await _db.SubRecetasSubRecetas
            .AsNoTracking()
            .Select(x => new { x.IdSubRecetaPadre, x.IdSubRecetaHija })
            .ToListAsync();

        var childToParents = allRels
            .GroupBy(r => r.IdSubRecetaHija)
            .ToDictionary(g => g.Key, g => g.Select(r => r.IdSubRecetaPadre).ToList());

        var todas = new HashSet<int>(directas);
        var pendientes = new Queue<int>(directas);

        while (pendientes.Count > 0)
        {
            var idHija = pendientes.Dequeue();
            if (!childToParents.TryGetValue(idHija, out var padres))
                continue;

            foreach (var padre in padres)
            {
                if (todas.Add(padre))
                    pendientes.Enqueue(padre);
            }
        }

        if (todas.Count == 0)
            return new List<int>();

        var relaciones = allRels
            .Where(x => todas.Contains(x.IdSubRecetaPadre) && todas.Contains(x.IdSubRecetaHija))
            .ToList();

        var restantes = new HashSet<int>(todas);
        var orden = new List<int>();

        while (restantes.Count > 0)
        {
            var listas = restantes
                .Where(id => !relaciones.Any(r => r.IdSubRecetaPadre == id && restantes.Contains(r.IdSubRecetaHija)))
                .ToList();

            if (listas.Count == 0)
            {
                orden.AddRange(restantes);
                break;
            }

            foreach (var id in listas)
            {
                orden.Add(id);
                restantes.Remove(id);
            }
        }

        return orden;
    }

    private async Task<List<int>> ObtenerRecetasAfectadasAsync(
        HashSet<int> insumosAfectados,
        HashSet<int> subRecetasAfectadas)
    {
        var porInsumo = await _db.RecetasInsumos
            .Where(x => insumosAfectados.Contains(x.IdInsumo))
            .Select(x => x.IdReceta)
            .Distinct()
            .ToListAsync();

        if (subRecetasAfectadas.Count == 0)
            return porInsumo;

        var porSubReceta = await _db.RecetasSubRecetas
            .Where(x => subRecetasAfectadas.Contains(x.IdSubReceta))
            .Select(x => x.IdReceta)
            .Distinct()
            .ToListAsync();

        return porInsumo.Union(porSubReceta).Distinct().ToList();
    }

    private async Task RecalcularSubRecetaAsync(
        int idSubReceta,
        Dictionary<int, decimal> costosPorInsumo,
        Dictionary<int, decimal> costosSubRecetas,
        int idUsuario)
    {
        var subReceta = await _db.SubRecetas
            .Include(x => x.SubRecetasInsumos)
            .Include(x => x.SubRecetasSubRecetaIdSubRecetaPadreNavigations)
            .FirstOrDefaultAsync(x => x.Id == idSubReceta);

        if (subReceta == null)
            return;

        var ahora = DateTime.Now;

        foreach (var insumo in subReceta.SubRecetasInsumos)
        {
            if (!costosPorInsumo.TryGetValue(insumo.IdInsumo, out var nuevoCosto))
                continue;

            if (insumo.CostoUnitario == nuevoCosto && insumo.SubTotal == insumo.Cantidad * nuevoCosto)
                continue;

            insumo.CostoUnitario = nuevoCosto;
            insumo.SubTotal = insumo.Cantidad * nuevoCosto;
            insumo.IdUsuarioModifica = idUsuario;
            insumo.FechaModifica = ahora;
        }

        foreach (var hijo in subReceta.SubRecetasSubRecetaIdSubRecetaPadreNavigations)
        {
            var costoHija = costosSubRecetas.TryGetValue(hijo.IdSubRecetaHija, out var c) ? c : 0m;

            hijo.CostoUnitario = costoHija;
            hijo.Subtotal = hijo.Cantidad * costoHija;
            hijo.IdUsuarioModifica = idUsuario;
            hijo.FechaModifica = ahora;
        }

        var costoInsumos = subReceta.SubRecetasInsumos.Sum(x => x.SubTotal);
        var costoSubRecetas = subReceta.SubRecetasSubRecetaIdSubRecetaPadreNavigations.Sum(x => x.Subtotal);
        var costoPorcion = costoInsumos + costoSubRecetas;
        var rendimiento = subReceta.Rendimiento.GetValueOrDefault(1m);
        if (rendimiento == 0) rendimiento = 1m;

        subReceta.CostoInsumos = costoInsumos;
        subReceta.CostoSubRecetas = costoSubRecetas;
        subReceta.CostoPorcion = costoPorcion;
        subReceta.CostoUnitario = Math.Round(costoPorcion / rendimiento, 2);
        subReceta.FechaActualizacion = ahora;
        subReceta.IdUsuarioModifica = idUsuario;
        subReceta.FechaModifica = ahora;

        costosSubRecetas[idSubReceta] = subReceta.CostoUnitario ?? 0m;
    }

    private async Task RecalcularRecetaAsync(
        int idReceta,
        Dictionary<int, decimal> costosPorInsumo,
        Dictionary<int, decimal> costosSubRecetas,
        int idUsuario)
    {
        var receta = await _db.Recetas
            .Include(x => x.RecetasInsumos)
            .Include(x => x.RecetasSubReceta)
            .FirstOrDefaultAsync(x => x.Id == idReceta);

        if (receta == null)
            return;

        var ahora = DateTime.Now;

        foreach (var insumo in receta.RecetasInsumos)
        {
            if (!costosPorInsumo.TryGetValue(insumo.IdInsumo, out var nuevoCosto))
                continue;

            insumo.CostoUnitario = nuevoCosto;
            insumo.SubTotal = insumo.Cantidad * nuevoCosto;
            insumo.IdUsuarioModifica = idUsuario;
            insumo.FechaModifica = ahora;
        }

        foreach (var sub in receta.RecetasSubReceta)
        {
            var costoSub = costosSubRecetas.TryGetValue(sub.IdSubReceta, out var c) ? c : 0m;

            sub.CostoUnitario = costoSub;
            sub.SubTotal = sub.Cantidad * costoSub;
            sub.IdUsuarioModifica = idUsuario;
            sub.FechaModifica = ahora;
        }

        var costoInsumos = receta.RecetasInsumos.Sum(x => x.SubTotal);
        var costoSubRecetas = receta.RecetasSubReceta.Sum(x => x.SubTotal ?? 0m);
        var costoPorcion = costoInsumos + costoSubRecetas;
        var rendimiento = receta.Rendimiento.GetValueOrDefault(1m);
        if (rendimiento == 0) rendimiento = 1m;

        receta.CostoInsumos = costoInsumos;
        receta.CostoSubRecetas = costoSubRecetas;
        receta.CostoPorcion = costoPorcion;
        receta.CostoUnitario = Math.Round(costoPorcion / rendimiento, 2);
        receta.FechaActualizacion = ahora;
        receta.IdUsuarioModifica = idUsuario;
        receta.FechaModifica = ahora;
    }
}
