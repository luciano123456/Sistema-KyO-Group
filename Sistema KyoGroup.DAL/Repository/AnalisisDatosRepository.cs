using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models.Analisis;

namespace SistemaKyoGroup.DAL.Repository;

public class AnalisisDatosRepository : IAnalisisDatosRepository
{
    private static readonly string[] Meses =
    {
        "", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    };

    private readonly SistemaKyoGroupContext _db;

    public AnalisisDatosRepository(SistemaKyoGroupContext db)
    {
        _db = db;
    }

    private static (DateTime desde, DateTime hasta) ResolverPeriodo(DateTime? fechaDesde, DateTime? fechaHasta)
    {
        var hoy = DateTime.Today;
        var desde = fechaDesde?.Date ?? new DateTime(hoy.Year, hoy.Month, 1).AddMonths(-2);
        var hasta = (fechaHasta?.Date ?? hoy).Date.AddDays(1).AddTicks(-1);
        return (desde, hasta);
    }

    public async Task<AnalisisReporteDto> ObtenerCompras(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
    {
        var (desde, hasta) = ResolverPeriodo(fechaDesde, fechaHasta);
        var query = _db.Compras.AsNoTracking()
            .Where(c => c.Fecha >= desde && c.Fecha <= hasta);

        if (idUnidadNegocio > 0)
            query = query.Where(c => c.IdUnidadNegocio == idUnidadNegocio);

        var serieRaw = await query
            .GroupBy(c => new { c.Fecha.Year, c.Fecha.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Valor = g.Sum(x => x.SubtotalFinal),
                Cantidad = g.Count()
            })
            .ToListAsync();

        var serie = serieRaw.Select(g => new AnalisisChartPoint
        {
            Label = $"{Meses[g.Month]} {g.Year}",
            Valor = g.Valor,
            Cantidad = g.Cantidad
        }).ToList();

        var rankingRaw = await query
            .GroupBy(c => c.IdProveedor)
            .Select(g => new
            {
                IdProveedor = g.Key,
                Valor = g.Sum(x => x.SubtotalFinal),
                Cantidad = g.Count()
            })
            .OrderByDescending(x => x.Valor)
            .Take(10)
            .ToListAsync();

        var provIds = rankingRaw.Select(r => r.IdProveedor).ToList();
        var provNames = provIds.Count > 0
            ? await _db.Proveedores.AsNoTracking()
                .Where(p => provIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Nombre)
            : new Dictionary<int, string>();

        var ranking = rankingRaw.Select(r => new AnalisisChartPoint
        {
            Label = provNames.TryGetValue(r.IdProveedor, out var n) ? n : $"Proveedor #{r.IdProveedor}",
            Valor = r.Valor,
            Cantidad = r.Cantidad
        }).ToList();

        var total = await query.SumAsync(c => (decimal?)c.SubtotalFinal) ?? 0m;
        var cantidad = await query.CountAsync();

        return new AnalisisReporteDto
        {
            Total = total,
            Cantidad = cantidad,
            Serie = serie,
            Ranking = ranking
        };
    }

    public async Task<AnalisisReporteDto> ObtenerCostos(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
    {
        var (desde, hasta) = ResolverPeriodo(fechaDesde, fechaHasta);

        var recetasQ = _db.Recetas.AsNoTracking()
            .Where(r => r.FechaActualizacion >= desde && r.FechaActualizacion <= hasta);
        if (idUnidadNegocio > 0)
            recetasQ = recetasQ.Where(r => r.IdUnidadNegocio == idUnidadNegocio);

        var subQ = _db.SubRecetas.AsNoTracking()
            .Where(r => r.FechaActualizacion >= desde && r.FechaActualizacion <= hasta);
        if (idUnidadNegocio > 0)
            subQ = subQ.Where(r => r.IdUnidadNegocio == idUnidadNegocio);

        var serieRaw = await recetasQ
            .GroupBy(r => new { r.FechaActualizacion.Year, r.FechaActualizacion.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Valor = g.Average(x => x.CostoUnitario ?? 0),
                Cantidad = g.Count()
            })
            .ToListAsync();

        var serie = serieRaw.Select(g => new AnalisisChartPoint
        {
            Label = $"{Meses[g.Month]} {g.Year}",
            Valor = g.Valor,
            Cantidad = g.Cantidad
        }).ToList();

        var rankingRaw = await recetasQ
            .GroupBy(r => r.IdCategoria)
            .Select(g => new
            {
                IdCategoria = g.Key,
                Valor = g.Average(x => x.CostoUnitario ?? 0),
                Cantidad = g.Count()
            })
            .OrderByDescending(x => x.Valor)
            .ToListAsync();

        var catIds = rankingRaw.Select(r => r.IdCategoria).ToList();
        var catNames = catIds.Count > 0
            ? await _db.RecetasCategorias.AsNoTracking()
                .Where(c => catIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.Nombre)
            : new Dictionary<int, string>();

        var ranking = rankingRaw.Select(r => new AnalisisChartPoint
        {
            Label = catNames.TryGetValue(r.IdCategoria, out var n) ? n : "Sin categoría",
            Valor = r.Valor,
            Cantidad = r.Cantidad
        }).ToList();

        var totalRec = await recetasQ.SumAsync(r => (decimal?)(r.CostoUnitario ?? 0)) ?? 0m;
        var totalSub = await subQ.SumAsync(r => (decimal?)(r.CostoUnitario ?? 0)) ?? 0m;
        var cantidadRec = await recetasQ.CountAsync();
        var cantidadSub = await subQ.CountAsync();

        return new AnalisisReporteDto
        {
            Total = totalRec + totalSub,
            Cantidad = cantidadRec + cantidadSub,
            Serie = serie,
            Ranking = ranking
        };
    }

    public async Task<AnalisisReporteDto> ObtenerInsumos(DateTime? fechaDesde, DateTime? fechaHasta)
    {
        var (desde, hasta) = ResolverPeriodo(fechaDesde, fechaHasta);

        var ciQuery = _db.ComprasInsumos.AsNoTracking()
            .Where(ci => ci.IdCompraNavigation.Fecha >= desde && ci.IdCompraNavigation.Fecha <= hasta);

        var serieRaw = await ciQuery
            .GroupBy(ci => new { ci.IdCompraNavigation.Fecha.Year, ci.IdCompraNavigation.Fecha.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Valor = g.Sum(x => x.SubtotalFinal),
                Cantidad = g.Count()
            })
            .ToListAsync();

        var serie = serieRaw.Select(g => new AnalisisChartPoint
        {
            Label = $"{Meses[g.Month]} {g.Year}",
            Valor = g.Valor,
            Cantidad = g.Cantidad
        }).ToList();

        var rankingRaw = await ciQuery
            .GroupBy(ci => ci.IdInsumo)
            .Select(g => new
            {
                IdInsumo = g.Key,
                Valor = g.Sum(x => x.SubtotalFinal),
                Cantidad = g.Count()
            })
            .OrderByDescending(x => x.Valor)
            .Take(10)
            .ToListAsync();

        var insumoIds = rankingRaw.Select(r => r.IdInsumo).ToList();
        var insumoNames = insumoIds.Count > 0
            ? await _db.Insumos.AsNoTracking()
                .Where(i => insumoIds.Contains(i.Id))
                .ToDictionaryAsync(i => i.Id, i => i.Descripcion)
            : new Dictionary<int, string>();

        var ranking = rankingRaw.Select(r => new AnalisisChartPoint
        {
            Label = insumoNames.TryGetValue(r.IdInsumo, out var n) ? n : $"Insumo #{r.IdInsumo}",
            Valor = r.Valor,
            Cantidad = r.Cantidad
        }).ToList();

        var total = await ciQuery.SumAsync(ci => (decimal?)ci.SubtotalFinal) ?? 0m;
        var cantidadInsumos = await _db.Insumos.CountAsync();

        return new AnalisisReporteDto
        {
            Total = total,
            Cantidad = cantidadInsumos,
            Serie = serie,
            Ranking = ranking
        };
    }

    public async Task<AnalisisReporteDto> ObtenerRecetas(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
    {
        var (desde, hasta) = ResolverPeriodo(fechaDesde, fechaHasta);

        var query = _db.Recetas.AsNoTracking()
            .Where(r => r.FechaActualizacion >= desde && r.FechaActualizacion <= hasta);

        if (idUnidadNegocio > 0)
            query = query.Where(r => r.IdUnidadNegocio == idUnidadNegocio);

        var serieRaw = await query
            .GroupBy(r => new { r.FechaActualizacion.Year, r.FechaActualizacion.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Valor = g.Sum(x => x.CostoUnitario ?? 0),
                Cantidad = g.Count()
            })
            .ToListAsync();

        var serie = serieRaw.Select(g => new AnalisisChartPoint
        {
            Label = $"{Meses[g.Month]} {g.Year}",
            Valor = g.Valor,
            Cantidad = g.Cantidad
        }).ToList();

        var ranking = await query
            .GroupBy(r => r.Descripcion)
            .Select(g => new AnalisisChartPoint
            {
                Label = g.Key,
                Valor = g.Max(x => x.CostoUnitario ?? 0),
                Cantidad = g.Count()
            })
            .OrderByDescending(x => x.Valor)
            .Take(10)
            .ToListAsync();

        var porCategoriaRaw = await query
            .GroupBy(r => r.IdCategoria)
            .Select(g => new
            {
                IdCategoria = g.Key,
                Cantidad = g.Count()
            })
            .OrderByDescending(x => x.Cantidad)
            .ToListAsync();

        var catIds = porCategoriaRaw.Select(r => r.IdCategoria).ToList();
        var catNames = catIds.Count > 0
            ? await _db.RecetasCategorias.AsNoTracking()
                .Where(c => catIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.Nombre)
            : new Dictionary<int, string>();

        var porCategoria = porCategoriaRaw.Select(r => new AnalisisChartPoint
        {
            Label = catNames.TryGetValue(r.IdCategoria, out var n) ? n : "Sin categoría",
            Valor = r.Cantidad,
            Cantidad = r.Cantidad
        }).ToList();

        var total = await query.SumAsync(r => (decimal?)(r.CostoUnitario ?? 0)) ?? 0m;
        var cantidad = await query.CountAsync();

        return new AnalisisReporteDto
        {
            Total = total,
            Cantidad = cantidad,
            Serie = serie,
            Ranking = ranking.Count > 0 ? ranking : porCategoria
        };
    }

    public async Task<AnalisisReporteDto> ObtenerCuentaCorriente(DateTime? fechaDesde, DateTime? fechaHasta)
    {
        var (desde, hasta) = ResolverPeriodo(fechaDesde, fechaHasta);

        var movProv = await _db.ProveedoresCuentaCorrientes.AsNoTracking()
            .Where(m => m.Fecha >= desde && m.Fecha <= hasta)
            .ToListAsync();

        var saldoProv = await _db.ProveedoresCuentaCorrientes.AsNoTracking()
            .GroupBy(m => m.IdProveedor)
            .Select(g => new { Id = g.Key, Saldo = g.Sum(m => m.Debe - m.Haber) })
            .ToListAsync();

        var serie = new List<AnalisisChartPoint>
        {
            new() { Label = "Debe proveedores", Valor = movProv.Sum(m => m.Debe), Cantidad = movProv.Count },
            new() { Label = "Haber proveedores", Valor = movProv.Sum(m => m.Haber), Cantidad = movProv.Count }
        };

        var topProv = saldoProv
            .Where(x => x.Saldo != 0)
            .OrderByDescending(x => x.Saldo)
            .Take(8)
            .ToList();

        var provNames = await _db.Proveedores.AsNoTracking()
            .Where(p => topProv.Select(t => t.Id).Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Nombre);

        var ranking = topProv
            .Select(x => new AnalisisChartPoint
            {
                Label = provNames.TryGetValue(x.Id, out var n) ? n : $"Proveedor #{x.Id}",
                Valor = x.Saldo,
                Cantidad = 1
            })
            .ToList();

        return new AnalisisReporteDto
        {
            Total = saldoProv.Sum(x => x.Saldo),
            Cantidad = movProv.Count,
            Serie = serie,
            Ranking = ranking
        };
    }
}
