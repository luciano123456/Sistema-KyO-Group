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

        var usuarioNombre = await EntidadHistorialHelper.NombreUsuarioAsync(_db, idUsuario);
        var proveedorNombre = await EntidadHistorialHelper.NombreFkAsync(_db, "Proveedor", compra.IdProveedor);

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

            RegistrarHistorialInsumoPorCompra(
                linea.IdInsumo, lista.Descripcion, proveedorNombre,
                costoAnterior, costoNuevo, compra.Id, esReversion: false,
                idUsuario, usuarioNombre);

            costosPorInsumo[linea.IdInsumo] = costoNuevo;
        }

        if (costosPorInsumo.Count == 0)
            return;

        await RecalcularCadenaCostosAsync(costosPorInsumo, idUsuario, compra.Id, esReversion: false);
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
        var usuarioNombre = await EntidadHistorialHelper.NombreUsuarioAsync(_db, idUsuario);
        var idProveedor = listasDict.Values.Select(x => x.IdProveedor).FirstOrDefault();
        var proveedorNombre = idProveedor > 0
            ? await EntidadHistorialHelper.NombreFkAsync(_db, "Proveedor", idProveedor)
            : "—";

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

                RegistrarHistorialInsumoPorCompra(
                    h.IdInsumo, lista.Descripcion, proveedorNombre,
                    h.CostoNuevo, h.CostoAnterior, idCompra, esReversion: true,
                    idUsuario, usuarioNombre);

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

                RegistrarHistorialInsumoPorCompra(
                    linea.IdInsumo, lista.Descripcion, proveedorNombre,
                    linea.PrecioFinal, linea.PrecioLista, idCompra, esReversion: true,
                    idUsuario, usuarioNombre);

                costosRestaurados[linea.IdInsumo] = linea.PrecioLista;
            }
        }

        if (costosRestaurados.Count > 0)
            await RecalcularCadenaCostosAsync(costosRestaurados, idUsuario, idCompra, esReversion: true);

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

    private async Task RecalcularCadenaCostosAsync(
        Dictionary<int, decimal> costosPorInsumo,
        int idUsuario,
        int idCompra,
        bool esReversion)
    {
        var insumosAfectados = costosPorInsumo.Keys.ToHashSet();
        var subRecetasOrden = await ObtenerSubRecetasOrdenBottomUpAsync(insumosAfectados);
        var usuarioNombre = await EntidadHistorialHelper.NombreUsuarioAsync(_db, idUsuario);
        var ctx = new ContextoHistorialCosto(idUsuario, usuarioNombre, idCompra, esReversion);

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
            await RecalcularSubRecetaAsync(idSubReceta, costosPorInsumo, costosSubRecetas, ctx);

        var subRecetasAfectadas = subRecetasOrden.ToHashSet();
        var recetasAfectadas = await ObtenerRecetasAfectadasAsync(insumosAfectados, subRecetasAfectadas);

        foreach (var idReceta in recetasAfectadas)
            await RecalcularRecetaAsync(idReceta, costosPorInsumo, costosSubRecetas, ctx);
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
        ContextoHistorialCosto ctx)
    {
        var subReceta = await _db.SubRecetas
            .Include(x => x.SubRecetasInsumos)
                .ThenInclude(i => i.IdInsumoNavigation)
            .Include(x => x.SubRecetasSubRecetaIdSubRecetaPadreNavigations)
                .ThenInclude(h => h.IdSubRecetaHijaNavigation)
            .FirstOrDefaultAsync(x => x.Id == idSubReceta);

        if (subReceta == null)
            return;

        var ahora = DateTime.Now;
        var cambios = new List<string>();
        var costoUnitAntes = subReceta.CostoUnitario;
        var costoPorcionAntes = subReceta.CostoPorcion;
        var costoInsumosAntes = subReceta.CostoInsumos;
        var costoSubsAntes = subReceta.CostoSubRecetas;

        foreach (var insumo in subReceta.SubRecetasInsumos)
        {
            if (!costosPorInsumo.TryGetValue(insumo.IdInsumo, out var nuevoCosto))
                continue;

            var subTotalNuevo = insumo.Cantidad * nuevoCosto;
            if (RecetaHistorialHelper.ValoresIguales(insumo.CostoUnitario, nuevoCosto)
                && RecetaHistorialHelper.ValoresIguales(insumo.SubTotal, subTotalNuevo))
                continue;

            AgregarDiff(cambios, NombreLinea("Insumo", insumo.IdInsumoNavigation?.Descripcion, insumo.IdInsumo),
                insumo.CostoUnitario, nuevoCosto);
            insumo.CostoUnitario = nuevoCosto;
            insumo.SubTotal = subTotalNuevo;
            insumo.IdUsuarioModifica = ctx.IdUsuario;
            insumo.FechaModifica = ahora;
        }

        foreach (var hijo in subReceta.SubRecetasSubRecetaIdSubRecetaPadreNavigations)
        {
            if (!costosSubRecetas.TryGetValue(hijo.IdSubRecetaHija, out var costoHija))
                continue;

            var subTotalNuevo = hijo.Cantidad * costoHija;
            if (RecetaHistorialHelper.ValoresIguales(hijo.CostoUnitario, costoHija)
                && RecetaHistorialHelper.ValoresIguales(hijo.Subtotal, subTotalNuevo))
                continue;

            AgregarDiff(cambios, NombreLinea("Subreceta", hijo.IdSubRecetaHijaNavigation?.Descripcion, hijo.IdSubRecetaHija),
                hijo.CostoUnitario, costoHija);
            hijo.CostoUnitario = costoHija;
            hijo.Subtotal = subTotalNuevo;
            hijo.IdUsuarioModifica = ctx.IdUsuario;
            hijo.FechaModifica = ahora;
        }

        var costoInsumos = subReceta.SubRecetasInsumos.Sum(x => x.SubTotal);
        var costoHijas = subReceta.SubRecetasSubRecetaIdSubRecetaPadreNavigations.Sum(x => x.Subtotal);
        var costoPorcion = costoInsumos + costoHijas;
        var rendimiento = subReceta.Rendimiento.GetValueOrDefault(1m);
        if (rendimiento == 0) rendimiento = 1m;
        var costoUnitario = Math.Round(costoPorcion / rendimiento, 2);

        AgregarDiff(cambios, "Costo insumos", costoInsumosAntes, costoInsumos);
        AgregarDiff(cambios, "Costo subrecetas", costoSubsAntes, costoHijas);
        AgregarDiff(cambios, "Costo porción", costoPorcionAntes, costoPorcion);
        AgregarDiff(cambios, "Costo unitario", costoUnitAntes, costoUnitario);

        costosSubRecetas[idSubReceta] = costoUnitario;

        if (cambios.Count == 0)
            return;

        subReceta.CostoInsumos = costoInsumos;
        subReceta.CostoSubRecetas = costoHijas;
        subReceta.CostoPorcion = costoPorcion;
        subReceta.CostoUnitario = costoUnitario;
        subReceta.FechaActualizacion = ahora;
        subReceta.IdUsuarioModifica = ctx.IdUsuario;
        subReceta.FechaModifica = ahora;

        RecetaHistorialHelper.Agregar(
            _db,
            RecetaHistorialHelper.TipoSubReceta,
            idSubReceta,
            EntidadHistorialHelper.AccionModificacion,
            ResumenCostosPorCompra("subreceta", subReceta.Descripcion, ctx),
            string.Join(" | ", cambios),
            ctx.IdUsuario,
            ctx.UsuarioNombre);
    }

    private async Task RecalcularRecetaAsync(
        int idReceta,
        Dictionary<int, decimal> costosPorInsumo,
        Dictionary<int, decimal> costosSubRecetas,
        ContextoHistorialCosto ctx)
    {
        var receta = await _db.Recetas
            .Include(x => x.RecetasInsumos)
                .ThenInclude(i => i.IdInsumoNavigation)
            .Include(x => x.RecetasSubReceta)
                .ThenInclude(s => s.IdSubRecetaNavigation)
            .FirstOrDefaultAsync(x => x.Id == idReceta);

        if (receta == null)
            return;

        var ahora = DateTime.Now;
        var cambios = new List<string>();
        var costoUnitAntes = receta.CostoUnitario;
        var costoPorcionAntes = receta.CostoPorcion;
        var costoInsumosAntes = receta.CostoInsumos;
        var costoSubsAntes = receta.CostoSubRecetas;

        foreach (var insumo in receta.RecetasInsumos)
        {
            if (!costosPorInsumo.TryGetValue(insumo.IdInsumo, out var nuevoCosto))
                continue;

            var subTotalNuevo = insumo.Cantidad * nuevoCosto;
            if (RecetaHistorialHelper.ValoresIguales(insumo.CostoUnitario, nuevoCosto)
                && RecetaHistorialHelper.ValoresIguales(insumo.SubTotal, subTotalNuevo))
                continue;

            AgregarDiff(cambios, NombreLinea("Insumo", insumo.IdInsumoNavigation?.Descripcion, insumo.IdInsumo),
                insumo.CostoUnitario, nuevoCosto);
            insumo.CostoUnitario = nuevoCosto;
            insumo.SubTotal = subTotalNuevo;
            insumo.IdUsuarioModifica = ctx.IdUsuario;
            insumo.FechaModifica = ahora;
        }

        foreach (var sub in receta.RecetasSubReceta)
        {
            if (!costosSubRecetas.TryGetValue(sub.IdSubReceta, out var costoSub))
                continue;

            var subTotalNuevo = sub.Cantidad * costoSub;
            if (RecetaHistorialHelper.ValoresIguales(sub.CostoUnitario, costoSub)
                && RecetaHistorialHelper.ValoresIguales(sub.SubTotal ?? 0m, subTotalNuevo))
                continue;

            AgregarDiff(cambios, NombreLinea("Subreceta", sub.IdSubRecetaNavigation?.Descripcion, sub.IdSubReceta),
                sub.CostoUnitario, costoSub);
            sub.CostoUnitario = costoSub;
            sub.SubTotal = subTotalNuevo;
            sub.IdUsuarioModifica = ctx.IdUsuario;
            sub.FechaModifica = ahora;
        }

        var costoInsumos = receta.RecetasInsumos.Sum(x => x.SubTotal);
        var costoHijas = receta.RecetasSubReceta.Sum(x => x.SubTotal ?? 0m);
        var costoPorcion = costoInsumos + costoHijas;
        var rendimiento = receta.Rendimiento.GetValueOrDefault(1m);
        if (rendimiento == 0) rendimiento = 1m;
        var costoUnitario = Math.Round(costoPorcion / rendimiento, 2);

        AgregarDiff(cambios, "Costo insumos", costoInsumosAntes, costoInsumos);
        AgregarDiff(cambios, "Costo subrecetas", costoSubsAntes, costoHijas);
        AgregarDiff(cambios, "Costo porción", costoPorcionAntes, costoPorcion);
        AgregarDiff(cambios, "Costo unitario", costoUnitAntes, costoUnitario);

        if (cambios.Count == 0)
            return;

        receta.CostoInsumos = costoInsumos;
        receta.CostoSubRecetas = costoHijas;
        receta.CostoPorcion = costoPorcion;
        receta.CostoUnitario = costoUnitario;
        receta.FechaActualizacion = ahora;
        receta.IdUsuarioModifica = ctx.IdUsuario;
        receta.FechaModifica = ahora;

        RecetaHistorialHelper.Agregar(
            _db,
            RecetaHistorialHelper.TipoReceta,
            idReceta,
            EntidadHistorialHelper.AccionModificacion,
            ResumenCostosPorCompra("receta", receta.Descripcion, ctx),
            string.Join(" | ", cambios),
            ctx.IdUsuario,
            ctx.UsuarioNombre);
    }

    private void RegistrarHistorialInsumoPorCompra(
        int idInsumo,
        string? descripcionLista,
        string proveedorNombre,
        decimal costoAnterior,
        decimal costoNuevo,
        int idCompra,
        bool esReversion,
        int idUsuario,
        string? usuarioNombre)
    {
        var lista = string.IsNullOrWhiteSpace(descripcionLista) ? $"#{idInsumo}" : descripcionLista.Trim();
        var resumen = esReversion
            ? $"Precio de lista revertido por eliminación de compra #{idCompra}"
            : $"Precio de lista actualizado por compra #{idCompra}";
        var detalle =
            $"Proveedor: {proveedorNombre}. Lista: {lista}. Costo unitario: {RecetaHistorialHelper.FormatearValor(costoAnterior)} → {RecetaHistorialHelper.FormatearValor(costoNuevo)}.";

        EntidadHistorialHelper.Agregar(
            _db,
            EntidadHistorialHelper.Insumo,
            idInsumo,
            EntidadHistorialHelper.AccionModificacion,
            resumen,
            detalle,
            idUsuario,
            usuarioNombre);
    }

    private static void AgregarDiff(List<string> cambios, string campo, object? antes, object? despues)
    {
        if (RecetaHistorialHelper.ValoresIguales(antes, despues)) return;
        cambios.Add($"{campo}: {RecetaHistorialHelper.FormatearValor(antes)} → {RecetaHistorialHelper.FormatearValor(despues)}");
    }

    private static string NombreLinea(string tipo, string? nombre, int id)
        => string.IsNullOrWhiteSpace(nombre) ? $"{tipo} #{id}" : $"{tipo} \"{nombre.Trim()}\"";

    private static string ResumenCostosPorCompra(string tipo, string? descripcion, ContextoHistorialCosto ctx)
    {
        var nombre = string.IsNullOrWhiteSpace(descripcion) ? tipo : $"{tipo} \"{descripcion.Trim()}\"";
        return ctx.EsReversion
            ? $"Costos de {nombre} revertidos por eliminación de compra #{ctx.IdCompra}"
            : $"Costos de {nombre} actualizados por compra #{ctx.IdCompra}";
    }

    private sealed record ContextoHistorialCosto(
        int IdUsuario,
        string? UsuarioNombre,
        int IdCompra,
        bool EsReversion);
}
