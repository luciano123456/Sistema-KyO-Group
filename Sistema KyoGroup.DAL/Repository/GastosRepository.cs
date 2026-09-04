using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

/// <summary>
/// Gastos operativos. Coordina tres libros a la vez: el gasto en sí, la cuenta
/// corriente del proveedor (cuando corresponde) y el libro de caja.
/// </summary>
public class GastosRepository : IGastosRepository
{
    private readonly SistemaKyoGroupContext _db;
    private readonly ICajasRepository _cajas;

    public GastosRepository(SistemaKyoGroupContext context, ICajasRepository cajas)
    {
        _db = context;
        _cajas = cajas;
    }

    // ═══════════════════════════════════ Consultas ═══════════════════════════════

    private IQueryable<Gasto> Query(GastoFiltro f)
    {
        var query = _db.Gastos.AsNoTracking().AsQueryable();

        if (!f.IncluirAnulados)
            query = query.Where(x => !x.Anulado);
        if (f.FechaDesde.HasValue)
            query = query.Where(x => x.Fecha >= f.FechaDesde.Value.Date);
        if (f.FechaHasta.HasValue)
            query = query.Where(x => x.Fecha <= f.FechaHasta.Value.Date);
        if (f.IdProveedor is > 0)
            query = query.Where(x => x.IdProveedor == f.IdProveedor);
        if (f.IdLocal is > 0)
            query = query.Where(x => x.IdLocal == f.IdLocal);
        if (f.IdUnidadNegocio is > 0)
            query = query.Where(x => x.IdUnidadNegocio == f.IdUnidadNegocio);
        if (f.IdEstado is > 0)
            query = query.Where(x => x.IdEstado == f.IdEstado);
        if (f.SoloPendientes)
            query = query.Where(x => x.IdEstado == GastoEstado.Pendiente || x.IdEstado == GastoEstado.Parcial);
        if (f.SoloVencidos)
        {
            var hoy = DateTime.Today;
            query = query.Where(x =>
                x.FechaVencimiento != null &&
                x.FechaVencimiento < hoy &&
                (x.IdEstado == GastoEstado.Pendiente || x.IdEstado == GastoEstado.Parcial));
        }
        if (!string.IsNullOrWhiteSpace(f.Texto))
            query = query.Where(x =>
                x.Concepto.Contains(f.Texto) ||
                (x.Detalle != null && x.Detalle.Contains(f.Texto)) ||
                (x.ComprobanteNumero != null && x.ComprobanteNumero.Contains(f.Texto)) ||
                (x.NotaInterna != null && x.NotaInterna.Contains(f.Texto)));

        // Una categoría padre arrastra a sus hijas: filtrar por "Servicios" trae Luz, Gas, etc.
        if (f.IdCategoria is > 0)
        {
            var hijas = _db.GastosCategorias.AsNoTracking()
                .Where(c => c.IdPadre == f.IdCategoria)
                .Select(c => c.Id);
            query = query.Where(x => x.IdCategoria == f.IdCategoria || hijas.Contains(x.IdCategoria));
        }

        return query;
    }

    public Task<List<Gasto>> Listar(GastoFiltro filtro)
        => Query(filtro)
            .Include(x => x.IdCategoriaNavigation)
            .Include(x => x.IdProveedorNavigation)
            .Include(x => x.IdLocalNavigation)
            .Include(x => x.IdUnidadNegocioNavigation)
            .OrderByDescending(x => x.Fecha).ThenByDescending(x => x.Id)
            .ToListAsync();

    public Task<Gasto?> Obtener(int id)
        => _db.Gastos.AsNoTracking()
            .Include(x => x.IdCategoriaNavigation)
            .Include(x => x.IdProveedorNavigation)
            .Include(x => x.IdLocalNavigation)
            .Include(x => x.IdUnidadNegocioNavigation)
            .Include(x => x.IdUsuarioRegistraNavigation)
            .FirstOrDefaultAsync(x => x.Id == id);

    public async Task<decimal> SaldoPendiente(int idGasto)
    {
        var gasto = await _db.Gastos.AsNoTracking()
            .Where(x => x.Id == idGasto)
            .Select(x => new { x.Importe, x.Anulado })
            .FirstOrDefaultAsync();
        if (gasto == null || gasto.Anulado) return 0m;

        var pagado = await _db.GastosPagos.AsNoTracking()
            .Where(p => p.IdGasto == idGasto && !p.Anulado)
            .SumAsync(p => (decimal?)p.Importe) ?? 0m;

        return gasto.Importe - pagado;
    }

    // ═══════════════════════════════════ Altas / bajas ═══════════════════════════

    public async Task<int> Insertar(Gasto gasto, GastosPago? pagoInmediato, int idUsuario)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        gasto.Fecha = gasto.Fecha.Date;
        gasto.FechaVencimiento = gasto.FechaVencimiento?.Date;
        gasto.ImportePagado = 0;
        gasto.IdEstado = GastoEstado.Pendiente;
        gasto.Anulado = false;
        gasto.IdUsuarioRegistra = idUsuario;
        gasto.FechaRegistra = DateTime.Now;

        // Sin proveedor no hay cuenta corriente donde impactar.
        if (gasto.IdProveedor is null or <= 0)
        {
            gasto.IdProveedor = null;
            gasto.ImpactaCuentaCorriente = false;
        }

        _db.Gastos.Add(gasto);
        await _db.SaveChangesAsync();

        await SincronizarCuentaCorriente(gasto);

        if (pagoInmediato != null && pagoInmediato.Importe > 0)
        {
            pagoInmediato.IdGasto = gasto.Id;
            await RegistrarPagoInterno(pagoInmediato, gasto, idUsuario);
        }

        await Recalcular(gasto.Id);
        await tx.CommitAsync();
        return gasto.Id;
    }

    public async Task<bool> Actualizar(Gasto gasto, int idUsuario)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var actual = await _db.Gastos.FirstOrDefaultAsync(x => x.Id == gasto.Id);
        if (actual == null || actual.Anulado) return false;

        var proveedorAnterior = actual.IdProveedor;

        actual.IdUnidadNegocio = gasto.IdUnidadNegocio;
        actual.IdLocal = gasto.IdLocal;
        actual.IdCategoria = gasto.IdCategoria;
        actual.IdProveedor = gasto.IdProveedor is > 0 ? gasto.IdProveedor : null;
        actual.Fecha = gasto.Fecha.Date;
        actual.FechaVencimiento = gasto.FechaVencimiento?.Date;
        actual.Concepto = gasto.Concepto;
        actual.Detalle = gasto.Detalle;
        actual.ComprobanteTipo = gasto.ComprobanteTipo;
        actual.ComprobanteNumero = gasto.ComprobanteNumero;
        actual.Importe = gasto.Importe;
        actual.ImpactaCuentaCorriente = actual.IdProveedor != null && gasto.ImpactaCuentaCorriente;
        actual.NotaInterna = gasto.NotaInterna;
        actual.IdUsuarioModifica = idUsuario;
        actual.FechaModifica = DateTime.Now;
        await _db.SaveChangesAsync();

        // Si cambió el proveedor hay que sacar el Debe de la cuenta corriente anterior.
        if (proveedorAnterior != actual.IdProveedor)
            await BorrarMovimientosCuentaCorriente(actual.Id);

        await SincronizarCuentaCorriente(actual);
        await SincronizarAsientosPagos(actual, idUsuario);
        await Recalcular(actual.Id);

        await tx.CommitAsync();
        return true;
    }

    public async Task<bool> Anular(int id, string? motivo, int idUsuario)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var gasto = await _db.Gastos.FirstOrDefaultAsync(x => x.Id == id);
        if (gasto == null || gasto.Anulado) return false;

        var pagos = await _db.GastosPagos.Where(p => p.IdGasto == id && !p.Anulado).ToListAsync();
        foreach (var pago in pagos)
        {
            await _cajas.AnularPorOrigen(CajaTipoMov.Gasto, pago.Id, idUsuario, motivo ?? "Gasto anulado");
            pago.Anulado = true;
        }

        await BorrarMovimientosCuentaCorriente(id);

        gasto.Anulado = true;
        gasto.IdEstado = GastoEstado.Anulado;
        gasto.ImportePagado = 0;
        gasto.MotivoAnula = motivo;
        gasto.IdUsuarioModifica = idUsuario;
        gasto.FechaModifica = DateTime.Now;
        await _db.SaveChangesAsync();

        await tx.CommitAsync();
        return true;
    }

    public async Task<DeleteResult> Eliminar(int id)
    {
        try
        {
            var gasto = await _db.Gastos.FirstOrDefaultAsync(x => x.Id == id);
            if (gasto == null) return DeleteResult.NotFound("el gasto");

            var nPagos = await _db.GastosPagos.CountAsync(p => p.IdGasto == id && !p.Anulado);
            if (nPagos > 0)
            {
                return DeleteResult.Relacion(
                    "El gasto tiene pagos registrados que ya impactaron en caja. Anúlelo para revertir los movimientos y conservar la trazabilidad.",
                    new[]
                    {
                        new DeleteDependencia
                        {
                            Entidad = "Pagos del gasto",
                            Cantidad = nPagos,
                            Detalle = "Cada pago tiene su asiento en el libro de caja",
                            Cascadeable = false
                        }
                    },
                    cascadeDisponible: false);
            }

            await using var tx = await _db.Database.BeginTransactionAsync();

            var pagosAnulados = await _db.GastosPagos.Where(p => p.IdGasto == id).ToListAsync();
            if (pagosAnulados.Count > 0) _db.GastosPagos.RemoveRange(pagosAnulados);

            await BorrarMovimientosCuentaCorriente(id);

            _db.Gastos.Remove(gasto);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return DeleteResult.Success("Gasto eliminado correctamente.");
        }
        catch (Exception ex)
        {
            return DeleteResult.Error("No se pudo eliminar el gasto: " + (ex.InnerException?.Message ?? ex.Message));
        }
    }

    // ═════════════════════════════════════ Pagos ═════════════════════════════════

    public Task<List<GastosPago>> ListarPagos(int idGasto)
        => _db.GastosPagos.AsNoTracking()
            .Include(p => p.IdCuentaNavigation)
            .Include(p => p.IdMedioPagoNavigation)
            .Include(p => p.IdUsuarioRegistraNavigation)
            .Where(p => p.IdGasto == idGasto)
            .OrderByDescending(p => p.Fecha).ThenByDescending(p => p.Id)
            .ToListAsync();

    public async Task<int> RegistrarPago(GastosPago pago, int idUsuario)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var gasto = await _db.Gastos.FirstOrDefaultAsync(x => x.Id == pago.IdGasto);
        if (gasto == null || gasto.Anulado) return 0;

        await RegistrarPagoInterno(pago, gasto, idUsuario);
        await Recalcular(gasto.Id);

        await tx.CommitAsync();
        return pago.Id;
    }

    private async Task RegistrarPagoInterno(GastosPago pago, Gasto gasto, int idUsuario)
    {
        pago.Fecha = pago.Fecha == default ? DateTime.Today : pago.Fecha.Date;
        pago.Anulado = false;
        pago.IdUsuarioRegistra = idUsuario;
        pago.FechaRegistra = DateTime.Now;
        if (pago.IdMedioPago is <= 0) pago.IdMedioPago = null;

        _db.GastosPagos.Add(pago);
        await _db.SaveChangesAsync();

        var asiento = await _cajas.Registrar(ConstruirAsiento(pago, gasto, idUsuario));
        pago.IdCaja = asiento.Id;
        await _db.SaveChangesAsync();

        // El gasto en cuenta corriente ya generó el Debe: el pago lo cancela con un Haber.
        if (gasto.ImpactaCuentaCorriente && gasto.IdProveedor is > 0)
        {
            _db.ProveedoresCuentaCorrientes.Add(new ProveedoresCuentaCorriente
            {
                IdProveedor = gasto.IdProveedor.Value,
                Fecha = pago.Fecha,
                TipoMov = CuentaCorrienteTipoMov.PagoGasto,
                IdMov = pago.Id,
                Concepto = $"Pago gasto #{gasto.Id} — {gasto.Concepto}",
                Debe = 0,
                Haber = pago.Importe
            });
            await _db.SaveChangesAsync();
        }
    }

    private static CajaAsiento ConstruirAsiento(GastosPago pago, Gasto gasto, int idUsuario) => new()
    {
        IdCuenta = pago.IdCuenta,
        Fecha = pago.Fecha,
        TipoMov = CajaTipoMov.Gasto,
        IdMov = pago.Id,
        Concepto = $"Gasto #{gasto.Id} — {gasto.Concepto}",
        Egreso = pago.Importe,
        IdLocal = gasto.IdLocal,
        IdUnidadNegocio = gasto.IdUnidadNegocio,
        IdMedioPago = pago.IdMedioPago,
        NotaInterna = pago.NotaInterna,
        IdUsuario = idUsuario
    };

    public async Task<bool> AnularPago(int idPago, int idUsuario, string? motivo)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var pago = await _db.GastosPagos.FirstOrDefaultAsync(p => p.Id == idPago);
        if (pago == null || pago.Anulado) return false;

        await _cajas.AnularPorOrigen(CajaTipoMov.Gasto, pago.Id, idUsuario, motivo ?? "Pago de gasto anulado");

        var movsCc = await _db.ProveedoresCuentaCorrientes
            .Where(m => m.TipoMov == CuentaCorrienteTipoMov.PagoGasto && m.IdMov == pago.Id)
            .ToListAsync();
        if (movsCc.Count > 0) _db.ProveedoresCuentaCorrientes.RemoveRange(movsCc);

        pago.Anulado = true;
        await _db.SaveChangesAsync();

        await Recalcular(pago.IdGasto);
        await tx.CommitAsync();
        return true;
    }

    // ════════════════════════════════ Sincronizaciones ═══════════════════════════

    /// <summary>Crea o actualiza el Debe del gasto en la cuenta corriente del proveedor.</summary>
    private async Task SincronizarCuentaCorriente(Gasto gasto)
    {
        var mov = await _db.ProveedoresCuentaCorrientes
            .FirstOrDefaultAsync(m => m.TipoMov == CuentaCorrienteTipoMov.Gasto && m.IdMov == gasto.Id);

        if (!gasto.ImpactaCuentaCorriente || gasto.IdProveedor is null or <= 0)
        {
            if (mov != null)
            {
                _db.ProveedoresCuentaCorrientes.Remove(mov);
                await _db.SaveChangesAsync();
            }
            return;
        }

        var concepto = $"Gasto #{gasto.Id} — {gasto.Concepto}";
        if (mov == null)
        {
            _db.ProveedoresCuentaCorrientes.Add(new ProveedoresCuentaCorriente
            {
                IdProveedor = gasto.IdProveedor.Value,
                Fecha = gasto.Fecha,
                TipoMov = CuentaCorrienteTipoMov.Gasto,
                IdMov = gasto.Id,
                Concepto = concepto,
                Debe = gasto.Importe,
                Haber = 0
            });
        }
        else
        {
            mov.IdProveedor = gasto.IdProveedor.Value;
            mov.Fecha = gasto.Fecha;
            mov.Concepto = concepto;
            mov.Debe = gasto.Importe;
        }
        await _db.SaveChangesAsync();
    }

    /// <summary>Reescribe el concepto/local de los asientos ya generados tras editar el gasto.</summary>
    private async Task SincronizarAsientosPagos(Gasto gasto, int idUsuario)
    {
        var pagos = await _db.GastosPagos
            .Where(p => p.IdGasto == gasto.Id && !p.Anulado)
            .ToListAsync();

        foreach (var pago in pagos)
            await _cajas.Registrar(ConstruirAsiento(pago, gasto, idUsuario));
    }

    private async Task BorrarMovimientosCuentaCorriente(int idGasto)
    {
        var pagoIds = await _db.GastosPagos
            .Where(p => p.IdGasto == idGasto)
            .Select(p => p.Id)
            .ToListAsync();

        var movs = await _db.ProveedoresCuentaCorrientes
            .Where(m =>
                (m.TipoMov == CuentaCorrienteTipoMov.Gasto && m.IdMov == idGasto) ||
                (m.TipoMov == CuentaCorrienteTipoMov.PagoGasto && pagoIds.Contains(m.IdMov)))
            .ToListAsync();

        if (movs.Count > 0)
        {
            _db.ProveedoresCuentaCorrientes.RemoveRange(movs);
            await _db.SaveChangesAsync();
        }
    }

    /// <summary>El importe pagado y el estado siempre se derivan de los pagos vigentes.</summary>
    private async Task Recalcular(int idGasto)
    {
        var gasto = await _db.Gastos.FirstOrDefaultAsync(x => x.Id == idGasto);
        if (gasto == null || gasto.Anulado) return;

        var pagado = await _db.GastosPagos
            .Where(p => p.IdGasto == idGasto && !p.Anulado)
            .SumAsync(p => (decimal?)p.Importe) ?? 0m;

        gasto.ImportePagado = pagado;
        gasto.IdEstado = pagado <= 0
            ? GastoEstado.Pendiente
            : pagado >= gasto.Importe ? GastoEstado.Pagado : GastoEstado.Parcial;

        await _db.SaveChangesAsync();
    }

    // ═══════════════════════════════════ Reportes ════════════════════════════════

    public async Task<GastoResumen> Resumen(GastoFiltro filtro)
    {
        var query = Query(filtro);
        var hoy = DateTime.Today;

        var datos = await query
            .Select(x => new { x.Importe, x.ImportePagado, x.IdEstado, x.FechaVencimiento })
            .ToListAsync();

        var pendientes = datos
            .Where(d => d.IdEstado == GastoEstado.Pendiente || d.IdEstado == GastoEstado.Parcial)
            .ToList();
        var vencidos = pendientes
            .Where(d => d.FechaVencimiento != null && d.FechaVencimiento < hoy)
            .ToList();

        return new GastoResumen
        {
            Total = datos.Sum(d => d.Importe),
            Pagado = datos.Sum(d => d.ImportePagado),
            Pendiente = pendientes.Sum(d => d.Importe - d.ImportePagado),
            Vencido = vencidos.Sum(d => d.Importe - d.ImportePagado),
            Cantidad = datos.Count,
            CantidadPendientes = pendientes.Count,
            CantidadVencidos = vencidos.Count
        };
    }

    public async Task<List<MontoPorClave>> PorCategoria(GastoFiltro filtro)
    {
        var datos = await Query(filtro)
            .GroupBy(x => x.IdCategoria)
            .Select(g => new { IdCategoria = g.Key, Monto = g.Sum(x => x.Importe), Cantidad = g.Count() })
            .ToListAsync();

        var ids = datos.Select(d => d.IdCategoria).ToList();
        var categorias = await _db.GastosCategorias.AsNoTracking()
            .Where(c => ids.Contains(c.Id))
            .Select(c => new { c.Id, c.Nombre, c.Color, c.Icono })
            .ToListAsync();

        return datos
            .Select(d =>
            {
                var cat = categorias.FirstOrDefault(c => c.Id == d.IdCategoria);
                return new MontoPorClave
                {
                    Id = d.IdCategoria,
                    Nombre = cat?.Nombre ?? $"#{d.IdCategoria}",
                    Monto = d.Monto,
                    Cantidad = d.Cantidad,
                    Color = cat?.Color,
                    Icono = cat?.Icono
                };
            })
            .OrderByDescending(d => d.Monto)
            .ToList();
    }

    public async Task<List<MontoPorClave>> PorProveedor(GastoFiltro filtro, int top)
    {
        var datos = await Query(filtro)
            .Where(x => x.IdProveedor != null)
            .GroupBy(x => x.IdProveedor!.Value)
            .Select(g => new { IdProveedor = g.Key, Monto = g.Sum(x => x.Importe), Cantidad = g.Count() })
            .OrderByDescending(g => g.Monto)
            .Take(Math.Clamp(top, 1, 50))
            .ToListAsync();

        var ids = datos.Select(d => d.IdProveedor).ToList();
        var proveedores = await _db.Proveedores.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.Nombre })
            .ToListAsync();

        return datos.Select(d => new MontoPorClave
        {
            Id = d.IdProveedor,
            Nombre = proveedores.FirstOrDefault(p => p.Id == d.IdProveedor)?.Nombre ?? $"#{d.IdProveedor}",
            Monto = d.Monto,
            Cantidad = d.Cantidad
        }).ToList();
    }

    public Task<List<Gasto>> ProximosVencimientos(int dias, int top)
    {
        var hoy = DateTime.Today;
        var limite = hoy.AddDays(Math.Clamp(dias, 1, 365));

        return _db.Gastos.AsNoTracking()
            .Include(x => x.IdCategoriaNavigation)
            .Include(x => x.IdProveedorNavigation)
            .Where(x => !x.Anulado
                && x.FechaVencimiento != null
                && x.FechaVencimiento <= limite
                && (x.IdEstado == GastoEstado.Pendiente || x.IdEstado == GastoEstado.Parcial))
            .OrderBy(x => x.FechaVencimiento)
            .Take(Math.Clamp(top, 1, 100))
            .ToListAsync();
    }

    public async Task<List<GastoMesAgregado>> TotalesPorMes(DateTime desde, DateTime hasta)
    {
        return await _db.Gastos.AsNoTracking()
            .Where(x => !x.Anulado && x.Fecha >= desde.Date && x.Fecha <= hasta.Date)
            .GroupBy(x => new { Anio = x.Fecha.Year, Mes = x.Fecha.Month })
            .Select(g => new GastoMesAgregado
            {
                Anio = g.Key.Anio,
                Mes = g.Key.Mes,
                Total = g.Sum(x => x.Importe),
                Cantidad = g.Count()
            })
            .ToListAsync();
    }
}
