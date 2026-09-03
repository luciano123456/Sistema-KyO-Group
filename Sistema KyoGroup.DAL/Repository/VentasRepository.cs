using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Ventas;
using System.Globalization;
using System.Text;

namespace SistemaKyoGroup.DAL.Repository;

public class VentasRepository : IVentasRepository
{
    public const string TipoMaxiRest = "MaxiRest RankingVentas";
    private static readonly HashSet<string> SkusAuxiliares = new(StringComparer.OrdinalIgnoreCase)
    {
        "10405", "6050", "20091", "2460", "2507", "6093"
    };

    private readonly SistemaKyoGroupContext _db;

    public VentasRepository(SistemaKyoGroupContext db)
    {
        _db = db;
    }

    public Task EnsureSchemaAsync() => VentasSchemaHelper.EnsureSchemaAsync(_db);

    public async Task EnsureTipoMaxiRestAsync()
    {
        if (!await _db.ImportacionesTipos.AnyAsync(t => t.Nombre == TipoMaxiRest))
        {
            _db.ImportacionesTipos.Add(new ImportacionesTipo { Nombre = TipoMaxiRest });
            await _db.SaveChangesAsync();
        }
    }

    public async Task<int> ObtenerIdTipoMaxiRestAsync()
    {
        await EnsureTipoMaxiRestAsync();
        return await _db.ImportacionesTipos.Where(t => t.Nombre == TipoMaxiRest).Select(t => t.Id).FirstAsync();
    }

    public Task<Importacion?> ObtenerPorLocalFechaAsync(int idLocal, DateTime fecha)
    {
        var d = fecha.Date;
        return _db.Importaciones.AsNoTracking().FirstOrDefaultAsync(i => i.IdLocal == idLocal && i.Fecha == d);
    }

    public Task<Importacion?> ObtenerConLineasAsync(int id)
        => _db.Importaciones
            .Include(i => i.ImportacionesReceta)
            .FirstOrDefaultAsync(i => i.Id == id);

    public async Task<List<Local>> ListarLocalesAsync()
        => await _db.Locales.AsNoTracking().OrderBy(l => l.Nombre).ToListAsync();

    public async Task<Dictionary<string, Receta>> MapRecetasPorSkuAsync(int? idUnidadNegocio = null)
    {
        var q = _db.Recetas.AsNoTracking()
            .Include(r => r.RecetasInsumos)
            .Include(r => r.RecetasSubReceta)
            .Include(r => r.RecetasUnidadesNegocios)
            .AsQueryable();
        if (idUnidadNegocio is > 0)
            q = q.Where(r => r.IdUnidadNegocio == idUnidadNegocio.Value
                || r.RecetasUnidadesNegocios.Any(u => u.IdUnidadNegocio == idUnidadNegocio.Value));

        var list = await q.ToListAsync();
        var map = new Dictionary<string, Receta>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in list)
        {
            var sku = NormalizeSku(r.Sku);
            if (sku.Length == 0) continue;
            if (!map.ContainsKey(sku)) map[sku] = r;
        }
        return map;
    }

    public async Task<Dictionary<string, InsumoMatchInfo>> MapInsumosPorSkuAsync(int? idUnidadNegocio = null)
    {
        var q = _db.Insumos.AsNoTracking()
            .Include(i => i.InsumosUnidadesNegocios)
            .Include(i => i.InsumosProveedores)
                .ThenInclude(p => p.IdListaProveedorNavigation)
            .AsQueryable();

        if (idUnidadNegocio is > 0)
        {
            q = q.Where(i =>
                !i.InsumosUnidadesNegocios.Any()
                || i.InsumosUnidadesNegocios.Any(u => u.IdUnidadNegocio == idUnidadNegocio.Value));
        }

        var list = await q.ToListAsync();
        var map = new Dictionary<string, InsumoMatchInfo>(StringComparer.OrdinalIgnoreCase);
        foreach (var i in list)
        {
            var sku = NormalizeSku(i.Sku);
            if (sku.Length == 0) continue;
            if (map.ContainsKey(sku)) continue;

            var costo = i.InsumosProveedores
                .Select(p => p.IdListaProveedorNavigation?.CostoUnitario ?? 0m)
                .Where(c => c > 0)
                .DefaultIfEmpty(0m)
                .Min();

            map[sku] = new InsumoMatchInfo { Id = i.Id, CostoUnitario = costo };
        }
        return map;
    }

    public static string NormalizeSku(string? sku)
    {
        if (string.IsNullOrWhiteSpace(sku)) return "";
        var s = sku.Trim();
        if (s.EndsWith(".0", StringComparison.Ordinal)) s = s[..^2];
        return s;
    }

    public async Task<GridResult<VentaImportacionListItem>> ListarPaginado(
        GridQuery query, DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio)
    {
        var baseQ = _db.Importaciones.AsNoTracking().AsQueryable();
        if (desde.HasValue) baseQ = baseQ.Where(i => i.Fecha >= desde.Value.Date);
        if (hasta.HasValue) baseQ = baseQ.Where(i => i.Fecha <= hasta.Value.Date);
        if (idLocal > 0) baseQ = baseQ.Where(i => i.IdLocal == idLocal);
        if (idUnidadNegocio > 0) baseQ = baseQ.Where(i => i.IdUnidadNegocio == idUnidadNegocio);

        var total = await baseQ.CountAsync();

        var projected = baseQ.Select(i => new VentaImportacionListItem
        {
            Id = i.Id,
            Fecha = i.Fecha,
            IdLocal = i.IdLocal,
            LocalNombre = i.IdLocalNavigation.Nombre ?? "",
            IdUnidadNegocio = i.IdUnidadNegocio,
            UnidadNegocioNombre = i.IdUnidadNegocioNavigation.Nombre ?? "",
            NombreArchivo = i.NombreArchivo,
            CantidadItems = i.ImportacionesReceta.Count,
            ItemsMatched = i.ImportacionesReceta.Count(r => r.Matched),
            TotalVenta = i.ImportacionesReceta.Sum(r => (decimal?)r.Subtotal) ?? 0,
            TotalCosto = i.ImportacionesReceta.Sum(r => (decimal?)r.SubtotalCosto) ?? 0,
            TotalGanancia = i.ImportacionesReceta.Sum(r => (decimal?)r.Ganancia) ?? 0,
            UsuarioNombre = i.IdUsuarioRegistraNavigation.Usuario,
            FechaRegistra = i.FechaRegistra
        });

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim();
            projected = projected.Where(x =>
                (x.LocalNombre != null && x.LocalNombre.Contains(s)) ||
                (x.UnidadNegocioNombre != null && x.UnidadNegocioNombre.Contains(s)) ||
                (x.NombreArchivo != null && x.NombreArchivo.Contains(s)) ||
                (x.UsuarioNombre != null && x.UsuarioNombre.Contains(s)));
        }

        void ApplyCol(int idx, string? val)
        {
            if (string.IsNullOrWhiteSpace(val)) return;
            var v = val.Trim();
            projected = idx switch
            {
                1 => projected.Where(x => x.Id.ToString().Contains(v)),
                2 => projected.Where(x => x.Fecha.ToString().Contains(v) || x.Fecha.ToString("dd/MM/yyyy").Contains(v)),
                3 => projected.Where(x => x.LocalNombre.Contains(v)),
                4 => projected.Where(x => x.UnidadNegocioNombre.Contains(v)),
                5 => projected.Where(x => x.TotalVenta.ToString().Contains(v)),
                6 => projected.Where(x => x.TotalCosto.ToString().Contains(v)),
                7 => projected.Where(x => x.UsuarioNombre != null && x.UsuarioNombre.Contains(v)),
                _ => projected
            };
        }
        foreach (var kv in query.ColumnSearches) ApplyCol(kv.Key, kv.Value);

        var filtered = await projected.CountAsync();

        projected = query.OrderColumn switch
        {
            1 => query.OrderDesc ? projected.OrderByDescending(x => x.Id) : projected.OrderBy(x => x.Id),
            2 => query.OrderDesc ? projected.OrderByDescending(x => x.Fecha) : projected.OrderBy(x => x.Fecha),
            3 => query.OrderDesc ? projected.OrderByDescending(x => x.LocalNombre) : projected.OrderBy(x => x.LocalNombre),
            4 => query.OrderDesc ? projected.OrderByDescending(x => x.UnidadNegocioNombre) : projected.OrderBy(x => x.UnidadNegocioNombre),
            5 => query.OrderDesc ? projected.OrderByDescending(x => x.TotalVenta) : projected.OrderBy(x => x.TotalVenta),
            6 => query.OrderDesc ? projected.OrderByDescending(x => x.TotalCosto) : projected.OrderBy(x => x.TotalCosto),
            7 => query.OrderDesc ? projected.OrderByDescending(x => x.UsuarioNombre) : projected.OrderBy(x => x.UsuarioNombre),
            _ => query.OrderDesc ? projected.OrderByDescending(x => x.Fecha).ThenByDescending(x => x.Id)
                                 : projected.OrderBy(x => x.Fecha).ThenBy(x => x.Id)
        };

        var take = query.Take <= 0 ? 10 : query.Take;
        var items = await projected.Skip(query.Skip).Take(take).ToListAsync();
        foreach (var it in items)
            it.PorcentajeMatch = it.CantidadItems == 0 ? 0 : Math.Round(100m * it.ItemsMatched / it.CantidadItems, 1);

        return new GridResult<VentaImportacionListItem> { Total = total, Filtered = filtered, Items = items };
    }

    public async Task<VentaKpiIndexDto> ObtenerKpisIndexAsync(DateTime? desde, DateTime? hasta)
    {
        var q = _db.Importaciones.AsNoTracking().AsQueryable();
        if (desde.HasValue) q = q.Where(i => i.Fecha >= desde.Value.Date);
        if (hasta.HasValue) q = q.Where(i => i.Fecha <= hasta.Value.Date);

        var importaciones = await q.CountAsync();
        var locales = await q.Select(i => i.IdLocal).Distinct().CountAsync();
        var venta = await q.SelectMany(i => i.ImportacionesReceta).SumAsync(r => (decimal?)r.Subtotal) ?? 0;
        var sinMatch = await q.SelectMany(i => i.ImportacionesReceta).CountAsync(r => !r.Matched);

        return new VentaKpiIndexDto
        {
            Importaciones = importaciones,
            VentaPeriodo = venta,
            LocalesCargados = locales,
            ItemsSinMatch = sinMatch
        };
    }

    public async Task<VentaImportacionDetalleDto?> ObtenerDetalleAsync(int id)
    {
        var i = await _db.Importaciones.AsNoTracking()
            .Include(x => x.IdLocalNavigation)
            .Include(x => x.IdUnidadNegocioNavigation)
            .Include(x => x.IdUsuarioRegistraNavigation)
            .Include(x => x.ImportacionesReceta)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (i == null) return null;

        var lineas = i.ImportacionesReceta
            .OrderByDescending(r => r.Subtotal)
            .Select(r => new VentaLineaDto
            {
                Id = r.Id,
                Codigo = r.Codigo,
                Descripcion = r.Descripcion,
                Rubro = r.Rubro,
                RubroCodigo = r.RubroCodigo,
                Cantidad = r.Cantidad,
                PrecioUnitario = r.PrecioUnitario,
                Subtotal = r.Subtotal,
                CostoUnitario = r.CostoUnitario,
                SubtotalCosto = r.SubtotalCosto,
                Ganancia = r.Ganancia,
                Matched = r.Matched || (r.IdReceta is > 0),
                IdReceta = r.IdReceta,
                IdInsumo = r.IdInsumo,
                TipoVinculo = r.IdReceta is > 0 ? "Receta" : (r.Matched ? "Insumo" : "Ninguno")
            }).ToList();

        return new VentaImportacionDetalleDto
        {
            Id = i.Id,
            Fecha = i.Fecha,
            IdLocal = i.IdLocal,
            LocalNombre = i.IdLocalNavigation?.Nombre ?? "",
            IdUnidadNegocio = i.IdUnidadNegocio,
            UnidadNegocioNombre = i.IdUnidadNegocioNavigation?.Nombre ?? "",
            NombreArchivo = i.NombreArchivo,
            UsuarioNombre = i.IdUsuarioRegistraNavigation?.Usuario,
            FechaRegistra = i.FechaRegistra,
            TotalVenta = lineas.Sum(l => l.Subtotal),
            TotalCosto = lineas.Sum(l => l.SubtotalCosto),
            TotalGanancia = lineas.Sum(l => l.Ganancia),
            CantidadItems = lineas.Count,
            ItemsMatched = lineas.Count(l => l.Matched),
            Lineas = lineas
        };
    }

    public async Task<(bool Ok, int Id, string? Error, bool Reemplazo)> GuardarImportacionAsync(
        Importacion cabecera,
        List<ImportacionesReceta> lineas,
        bool reemplazarSiExiste,
        int idUsuario)
    {
        await VentasSchemaHelper.EnsureSchemaAsync(_db);

        cabecera.Fecha = cabecera.Fecha.Date;
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var existente = await _db.Importaciones
                .Include(i => i.ImportacionesReceta)
                    .ThenInclude(r => r.ImportacionesInsumos)
                .Include(i => i.ImportacionesReceta)
                    .ThenInclude(r => r.ImportacionesSubReceta)
                .FirstOrDefaultAsync(i => i.IdLocal == cabecera.IdLocal && i.Fecha == cabecera.Fecha);

            var reemplazo = false;
            if (existente != null)
            {
                // Siempre se vuelve a importar: reemplaza la del mismo local+fecha
                reemplazo = true;
                foreach (var r in existente.ImportacionesReceta.ToList())
                {
                    _db.ImportacionesInsumos.RemoveRange(r.ImportacionesInsumos);
                    _db.ImportacionesSubRecetas.RemoveRange(r.ImportacionesSubReceta);
                }
                _db.ImportacionesRecetas.RemoveRange(existente.ImportacionesReceta);
                _db.Importaciones.Remove(existente);
                await _db.SaveChangesAsync();
            }

            cabecera.IdUsuarioRegistra = idUsuario;
            cabecera.FechaRegistra = DateTime.Now;
            if (cabecera.NombreArchivo?.Length > 100)
                cabecera.NombreArchivo = cabecera.NombreArchivo[..100];

            _db.Importaciones.Add(cabecera);
            await _db.SaveChangesAsync();

            foreach (var linea in lineas)
            {
                linea.IdImportacion = cabecera.Id;
                linea.IdUsuarioRegistra = idUsuario;
                linea.FechaRegistra = DateTime.Now;
                if (linea.Descripcion?.Length > 250)
                    linea.Descripcion = linea.Descripcion[..250];
                if (linea.Codigo?.Length > 100)
                    linea.Codigo = linea.Codigo[..100];
                if (linea.Rubro?.Length > 100)
                    linea.Rubro = linea.Rubro[..100];
            }
            _db.ImportacionesRecetas.AddRange(lineas);
            await _db.SaveChangesAsync();

            var localNom = await EntidadHistorialHelper.NombreFkAsync(_db, "Local", cabecera.IdLocal);
            var nombreUser = await EntidadHistorialHelper.NombreUsuarioAsync(_db, idUsuario);
            EntidadHistorialHelper.Agregar(
                _db, EntidadHistorialHelper.Importacion, cabecera.Id,
                reemplazo ? EntidadHistorialHelper.AccionModificacion : EntidadHistorialHelper.AccionCreacion,
                reemplazo
                    ? $"Reimportación de ventas {localNom} {cabecera.Fecha:dd/MM/yyyy}"
                    : $"Importación de ventas {localNom} {cabecera.Fecha:dd/MM/yyyy}",
                $"Archivo: {cabecera.NombreArchivo}. Ítems: {lineas.Count}. Venta: {lineas.Sum(l => l.Subtotal):0.##}. Vinculados: {lineas.Count(l => l.Matched)}.",
                idUsuario, nombreUser);
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
            return (true, cabecera.Id, null, reemplazo);
        }
        catch (Exception ex)
        {
            try { await tx.RollbackAsync(); } catch { /* ignore */ }
            _db.ChangeTracker.Clear();
            var cur = ex;
            while (cur.InnerException != null) cur = cur.InnerException;
            var msg = string.IsNullOrWhiteSpace(cur.Message) ? ex.Message : cur.Message;
            return (false, 0, msg, false);
        }
    }

    public async Task<bool> EliminarAsync(int id, int idUsuario)
    {
        var existente = await _db.Importaciones
            .Include(i => i.ImportacionesReceta).ThenInclude(r => r.ImportacionesInsumos)
            .Include(i => i.ImportacionesReceta).ThenInclude(r => r.ImportacionesSubReceta)
            .FirstOrDefaultAsync(i => i.Id == id);
        if (existente == null) return false;

        var localNom = await EntidadHistorialHelper.NombreFkAsync(_db, "Local", existente.IdLocal);
        var fecha = existente.Fecha;
        var archivo = existente.NombreArchivo;

        foreach (var r in existente.ImportacionesReceta.ToList())
        {
            _db.ImportacionesInsumos.RemoveRange(r.ImportacionesInsumos);
            _db.ImportacionesSubRecetas.RemoveRange(r.ImportacionesSubReceta);
        }
        _db.ImportacionesRecetas.RemoveRange(existente.ImportacionesReceta);
        _db.Importaciones.Remove(existente);

        var nombreUser = await EntidadHistorialHelper.NombreUsuarioAsync(_db, idUsuario);
        EntidadHistorialHelper.Agregar(
            _db, EntidadHistorialHelper.Importacion, id,
            EntidadHistorialHelper.AccionEliminacion,
            $"Eliminación de ventas {localNom} {fecha:dd/MM/yyyy}",
            $"Archivo: {archivo}",
            idUsuario, nombreUser);

        await _db.SaveChangesAsync();
        return true;
    }

    private IQueryable<ImportacionesReceta> LineasFiltradas(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio)
    {
        var q = _db.ImportacionesRecetas.AsNoTracking()
            .Include(r => r.IdImportacionNavigation)
                .ThenInclude(i => i.IdLocalNavigation)
            .AsQueryable();
        if (desde.HasValue) q = q.Where(r => r.IdImportacionNavigation.Fecha >= desde.Value.Date);
        if (hasta.HasValue) q = q.Where(r => r.IdImportacionNavigation.Fecha <= hasta.Value.Date);
        if (idLocal > 0) q = q.Where(r => r.IdImportacionNavigation.IdLocal == idLocal);
        if (idUnidadNegocio > 0) q = q.Where(r => r.IdImportacionNavigation.IdUnidadNegocio == idUnidadNegocio);
        return q;
    }

    private static bool EsAuxiliar(ImportacionesReceta r)
        => SkusAuxiliares.Contains(r.Codigo?.Trim() ?? "")
           || string.Equals(r.Descripcion, "Comensales", StringComparison.OrdinalIgnoreCase)
           || string.Equals(r.Descripcion, "Palitos", StringComparison.OrdinalIgnoreCase)
           || string.Equals(r.Descripcion, "PALITOS", StringComparison.OrdinalIgnoreCase);

    public async Task<VentaResumenDto> ObtenerResumenAsync(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio)
    {
        var lineas = await LineasFiltradas(desde, hasta, idLocal, idUnidadNegocio).ToListAsync();
        var ventaLineas = lineas.Where(l => !EsAuxiliar(l)).ToList();
        var totalVenta = ventaLineas.Sum(l => l.Subtotal);
        var totalCosto = ventaLineas.Sum(l => l.SubtotalCosto);
        var ganancia = ventaLineas.Sum(l => l.Ganancia);
        var dias = lineas.Select(l => l.IdImportacionNavigation.Fecha.Date).Distinct().Count();
        var locales = lineas.Select(l => l.IdImportacionNavigation.IdLocal).Distinct().Count();
        var matched = lineas.Count(l => l.Matched);
        var cubiertos = lineas.Where(l =>
                string.Equals(l.Descripcion, "Comensales", StringComparison.OrdinalIgnoreCase)
                || l.Codigo == "6050")
            .Sum(l => l.Cantidad);
        var palitos = lineas.Where(l =>
                string.Equals(l.Descripcion, "Palitos", StringComparison.OrdinalIgnoreCase)
                || string.Equals(l.Descripcion, "PALITOS", StringComparison.OrdinalIgnoreCase)
                || l.Codigo == "10405")
            .Sum(l => l.Cantidad);

        return new VentaResumenDto
        {
            TotalVenta = totalVenta,
            TotalCosto = totalCosto,
            TotalGanancia = ganancia,
            MargenPct = totalVenta == 0 ? 0 : Math.Round(100m * ganancia / totalVenta, 1),
            DiasCargados = dias,
            LocalesConDatos = locales,
            ItemsTotales = lineas.Count,
            ItemsMatched = matched,
            PorcentajeMatch = lineas.Count == 0 ? 0 : Math.Round(100m * matched / lineas.Count, 1),
            TicketPromedio = dias == 0 ? 0 : Math.Round(totalVenta / dias, 2),
            Cubiertos = cubiertos,
            PedidosAprox = palitos
        };
    }

    public async Task<List<VentaSeriePunto>> ObtenerSerieDiariaAsync(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio)
    {
        var lineas = await LineasFiltradas(desde, hasta, idLocal, idUnidadNegocio).ToListAsync();
        return lineas
            .Where(l => !EsAuxiliar(l))
            .GroupBy(l => new
            {
                Fecha = l.IdImportacionNavigation.Fecha.Date,
                l.IdImportacionNavigation.IdLocal,
                Local = l.IdImportacionNavigation.IdLocalNavigation?.Nombre
            })
            .Select(g => new VentaSeriePunto
            {
                Fecha = g.Key.Fecha,
                Label = g.Key.Fecha.ToString("dd/MM", CultureInfo.InvariantCulture),
                IdLocal = g.Key.IdLocal,
                LocalNombre = g.Key.Local,
                TotalVenta = g.Sum(x => x.Subtotal),
                TotalCosto = g.Sum(x => x.SubtotalCosto),
                Cantidad = g.Sum(x => x.Cantidad)
            })
            .OrderBy(x => x.Fecha).ThenBy(x => x.LocalNombre)
            .ToList();
    }

    public async Task<List<VentaSeriePunto>> ObtenerComparativaLocalesAsync(DateTime? desde, DateTime? hasta, int idUnidadNegocio)
    {
        var lineas = await LineasFiltradas(desde, hasta, 0, idUnidadNegocio).ToListAsync();
        return lineas
            .Where(l => !EsAuxiliar(l))
            .GroupBy(l => new
            {
                l.IdImportacionNavigation.IdLocal,
                Nombre = l.IdImportacionNavigation.IdLocalNavigation?.Nombre ?? ""
            })
            .Select(g => new VentaSeriePunto
            {
                IdLocal = g.Key.IdLocal,
                LocalNombre = g.Key.Nombre,
                Label = g.Key.Nombre,
                TotalVenta = g.Sum(x => x.Subtotal),
                TotalCosto = g.Sum(x => x.SubtotalCosto),
                Cantidad = g.Sum(x => x.Cantidad)
            })
            .OrderByDescending(x => x.TotalVenta)
            .ToList();
    }

    public async Task<List<VentaRubroPunto>> ObtenerPorRubroAsync(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio)
    {
        var lineas = await LineasFiltradas(desde, hasta, idLocal, idUnidadNegocio).ToListAsync();
        return lineas
            .Where(l => !EsAuxiliar(l))
            .GroupBy(l => string.IsNullOrWhiteSpace(l.Rubro) ? "(Sin rubro)" : l.Rubro!.Trim())
            .Select(g => new VentaRubroPunto
            {
                Rubro = g.Key,
                Cantidad = g.Sum(x => x.Cantidad),
                TotalVenta = g.Sum(x => x.Subtotal),
                TotalCosto = g.Sum(x => x.SubtotalCosto)
            })
            .OrderByDescending(x => x.TotalVenta)
            .ToList();
    }

    public async Task<List<VentaTopProducto>> ObtenerTopProductosAsync(
        DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio, int top = 25)
    {
        var lineas = await LineasFiltradas(desde, hasta, idLocal, idUnidadNegocio).ToListAsync();
        return lineas
            .Where(l => !EsAuxiliar(l))
            .GroupBy(l => new { Codigo = l.Codigo?.Trim() ?? "", Desc = l.Descripcion, Rubro = l.Rubro })
            .Select(g => new VentaTopProducto
            {
                Codigo = g.Key.Codigo,
                Descripcion = g.Key.Desc,
                Rubro = g.Key.Rubro,
                Cantidad = g.Sum(x => x.Cantidad),
                TotalVenta = g.Sum(x => x.Subtotal),
                TotalCosto = g.Sum(x => x.SubtotalCosto)
            })
            .OrderByDescending(x => x.TotalVenta)
            .Take(top)
            .ToList();
    }

    public async Task<VentaMatrizMensualDto> ObtenerMatrizMensualAsync(int anio, int mes, int idLocal, int idUnidadNegocio)
    {
        var desde = new DateTime(anio, mes, 1);
        var hasta = desde.AddMonths(1).AddDays(-1);
        var diasMes = Enumerable.Range(0, (hasta - desde).Days + 1).Select(i => desde.AddDays(i)).ToList();

        var lineas = await LineasFiltradas(desde, hasta, idLocal, idUnidadNegocio).ToListAsync();
        var productos = lineas
            .Where(l => !EsAuxiliar(l))
            .GroupBy(l => new { Codigo = l.Codigo?.Trim() ?? "", Desc = l.Descripcion, Rubro = l.Rubro })
            .OrderByDescending(g => g.Sum(x => x.Cantidad))
            .Take(80)
            .ToList();

        var filas = new List<VentaMatrizFila>();
        foreach (var g in productos)
        {
            var porDia = diasMes.Select(d => g.Where(x => x.IdImportacionNavigation.Fecha.Date == d).Sum(x => x.Cantidad)).ToList();
            var diasConDato = porDia.Count(c => c > 0);
            var promedio = diasConDato == 0 ? 0 : Math.Round(porDia.Sum() / diasConDato, 2);
            var promSem = new decimal[7];
            for (var dow = 0; dow < 7; dow++)
            {
                var vals = diasMes
                    .Select((d, idx) => new { d, c = porDia[idx] })
                    .Where(x => ((int)x.d.DayOfWeek + 6) % 7 == dow && x.c > 0)
                    .Select(x => x.c)
                    .ToList();
                promSem[dow] = vals.Count == 0 ? 0 : Math.Round(vals.Average(), 2);
            }

            filas.Add(new VentaMatrizFila
            {
                Codigo = g.Key.Codigo,
                Descripcion = g.Key.Desc,
                Rubro = g.Key.Rubro,
                CantidadesPorDia = porDia,
                Promedio = promedio,
                PromedioPorDiaSemana = promSem,
                TotalCantidad = porDia.Sum(),
                TotalVenta = g.Sum(x => x.Subtotal)
            });
        }

        return new VentaMatrizMensualDto
        {
            Anio = anio,
            Mes = mes,
            Dias = diasMes,
            Filas = filas
        };
    }
}
