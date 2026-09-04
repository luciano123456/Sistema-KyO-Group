using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

public class CajasRepository : ICajasRepository
{
    private readonly SistemaKyoGroupContext _db;

    public CajasRepository(SistemaKyoGroupContext context)
    {
        _db = context;
    }

    // ═══════════════════════════════ Motor de asientos ═══════════════════════════

    public async Task<Caja> Registrar(CajaAsiento asiento)
    {
        if (asiento.Ingreso < 0 || asiento.Egreso < 0)
            throw new ArgumentException("Los importes del asiento no pueden ser negativos.");

        var existente = asiento.IdMov.HasValue
            ? await _db.Cajas.FirstOrDefaultAsync(x =>
                x.TipoMov == asiento.TipoMov && x.IdMov == asiento.IdMov && !x.Anulado)
            : null;

        // Si la cuenta tiene un turno abierto, el asiento queda atado a ese turno.
        var idSesion = asiento.IdSesion ?? (await SesionAbierta(asiento.IdCuenta))?.Id;

        if (existente != null)
        {
            existente.IdCuenta = asiento.IdCuenta;
            existente.Fecha = asiento.Fecha.Date;
            existente.Concepto = Recortar(asiento.Concepto, 300);
            existente.Ingreso = asiento.Ingreso;
            existente.Egreso = asiento.Egreso;
            existente.IdLocal = asiento.IdLocal;
            existente.IdUnidadNegocio = asiento.IdUnidadNegocio;
            existente.IdMedioPago = asiento.IdMedioPago;
            existente.NotaInterna = Recortar(asiento.NotaInterna, 300);
            existente.IdUsuarioModifica = asiento.IdUsuario;
            existente.FechaModifica = DateTime.Now;
            await _db.SaveChangesAsync();
            return existente;
        }

        var mov = new Caja
        {
            IdCuenta = asiento.IdCuenta,
            Fecha = asiento.Fecha.Date,
            TipoMov = asiento.TipoMov,
            IdMov = asiento.IdMov,
            Concepto = Recortar(asiento.Concepto, 300) ?? "",
            Ingreso = asiento.Ingreso,
            Egreso = asiento.Egreso,
            IdSesion = idSesion,
            IdLocal = asiento.IdLocal,
            IdUnidadNegocio = asiento.IdUnidadNegocio,
            IdMedioPago = asiento.IdMedioPago,
            NotaInterna = Recortar(asiento.NotaInterna, 300),
            Anulado = false,
            IdUsuarioRegistra = asiento.IdUsuario,
            FechaRegistra = DateTime.Now
        };

        _db.Cajas.Add(mov);
        await _db.SaveChangesAsync();
        return mov;
    }

    public async Task<bool> AnularPorOrigen(string tipoMov, int idMov, int idUsuario, string? motivo)
    {
        var movs = await _db.Cajas
            .Where(x => x.TipoMov == tipoMov && x.IdMov == idMov && !x.Anulado)
            .ToListAsync();
        if (movs.Count == 0) return false;

        foreach (var mov in movs) MarcarAnulado(mov, idUsuario, motivo);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AnularPorId(int idCaja, int idUsuario, string? motivo)
    {
        var mov = await _db.Cajas.FirstOrDefaultAsync(x => x.Id == idCaja);
        if (mov == null || mov.Anulado) return false;

        MarcarAnulado(mov, idUsuario, motivo);
        await _db.SaveChangesAsync();
        return true;
    }

    private static void MarcarAnulado(Caja mov, int idUsuario, string? motivo)
    {
        mov.Anulado = true;
        mov.MotivoAnula = Recortar(motivo, 200);
        mov.IdUsuarioAnula = idUsuario;
        mov.FechaAnula = DateTime.Now;
    }

    public Task<Caja?> ObtenerPorOrigen(string tipoMov, int idMov)
        => _db.Cajas.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TipoMov == tipoMov && x.IdMov == idMov && !x.Anulado);

    public Task<Caja?> Obtener(int id)
        => _db.Cajas.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);

    // ═══════════════════════════════════ Consultas ═══════════════════════════════

    private IQueryable<Caja> Query(CajaFiltro f, bool aplicarFechaDesde = true)
    {
        var query = _db.Cajas.AsNoTracking().AsQueryable();

        if (!f.IncluirAnulados)
            query = query.Where(x => !x.Anulado);
        if (f.IdCuenta is > 0)
            query = query.Where(x => x.IdCuenta == f.IdCuenta);
        if (f.IdLocal is > 0)
            query = query.Where(x => x.IdLocal == f.IdLocal);
        if (f.IdUnidadNegocio is > 0)
            query = query.Where(x => x.IdUnidadNegocio == f.IdUnidadNegocio);
        if (f.IdSesion is > 0)
            query = query.Where(x => x.IdSesion == f.IdSesion);
        if (aplicarFechaDesde && f.FechaDesde.HasValue)
            query = query.Where(x => x.Fecha >= f.FechaDesde.Value.Date);
        if (f.FechaHasta.HasValue)
            query = query.Where(x => x.Fecha <= f.FechaHasta.Value.Date);
        if (!string.IsNullOrWhiteSpace(f.TipoMov))
            query = query.Where(x => x.TipoMov == f.TipoMov);
        if (!string.IsNullOrWhiteSpace(f.Texto))
            query = query.Where(x =>
                x.Concepto.Contains(f.Texto) ||
                (x.NotaInterna != null && x.NotaInterna.Contains(f.Texto)));

        return query;
    }

    public Task<List<Caja>> Movimientos(CajaFiltro filtro)
        => Query(filtro)
            .Include(x => x.IdCuentaNavigation)
            .Include(x => x.IdMedioPagoNavigation)
            .Include(x => x.IdLocalNavigation)
            .Include(x => x.IdUsuarioRegistraNavigation)
            .OrderBy(x => x.Fecha).ThenBy(x => x.Id)
            .ToListAsync();

    public async Task<CajaResumen> Resumen(CajaFiltro filtro)
    {
        var query = Query(filtro);
        var ingresos = await query.SumAsync(x => (decimal?)x.Ingreso) ?? 0m;
        var egresos = await query.SumAsync(x => (decimal?)x.Egreso) ?? 0m;
        var cantidad = await query.CountAsync();

        var saldoAnterior = 0m;
        if (filtro.FechaDesde.HasValue)
        {
            // Mismo filtro pero acotado a lo anterior al período: da el arrastre.
            var previo = Query(filtro, aplicarFechaDesde: false)
                .Where(x => x.Fecha < filtro.FechaDesde.Value.Date);
            saldoAnterior = await previo.SumAsync(x => (decimal?)(x.Ingreso - x.Egreso)) ?? 0m;

            if (filtro.IdCuenta is > 0)
                saldoAnterior += await _db.Cuentas.AsNoTracking()
                    .Where(c => c.Id == filtro.IdCuenta)
                    .Select(c => c.SaldoInicial)
                    .FirstOrDefaultAsync();
        }

        return new CajaResumen
        {
            SaldoAnterior = saldoAnterior,
            Ingresos = ingresos,
            Egresos = egresos,
            Cantidad = cantidad
        };
    }

    public async Task<decimal> SaldoCuenta(int idCuenta, DateTime? hasta = null)
    {
        var query = _db.Cajas.AsNoTracking().Where(x => x.IdCuenta == idCuenta && !x.Anulado);
        if (hasta.HasValue)
            query = query.Where(x => x.Fecha <= hasta.Value.Date);

        var movs = await query.SumAsync(x => (decimal?)(x.Ingreso - x.Egreso)) ?? 0m;
        var inicial = await _db.Cuentas.AsNoTracking()
            .Where(c => c.Id == idCuenta)
            .Select(c => c.SaldoInicial)
            .FirstOrDefaultAsync();

        return inicial + movs;
    }

    public async Task<List<CuentaSaldo>> SaldosPorCuenta(bool soloActivas = true, int? idLocal = null)
    {
        var cuentasQuery = _db.Cuentas.AsNoTracking()
            .Include(c => c.IdTipoNavigation)
            .Include(c => c.IdLocalNavigation)
            .AsQueryable();

        if (soloActivas) cuentasQuery = cuentasQuery.Where(c => c.Activa);
        if (idLocal is > 0) cuentasQuery = cuentasQuery.Where(c => c.IdLocal == idLocal || c.IdLocal == null);

        var cuentas = await cuentasQuery
            .OrderBy(c => c.Orden).ThenBy(c => c.Nombre)
            .ToListAsync();
        var ids = cuentas.Select(c => c.Id).ToList();

        var totales = await _db.Cajas.AsNoTracking()
            .Where(x => ids.Contains(x.IdCuenta) && !x.Anulado)
            .GroupBy(x => x.IdCuenta)
            .Select(g => new
            {
                IdCuenta = g.Key,
                Ingresos = g.Sum(x => x.Ingreso),
                Egresos = g.Sum(x => x.Egreso),
                Cantidad = g.Count(),
                Ultimo = g.Max(x => (DateTime?)x.Fecha)
            })
            .ToListAsync();

        var sesiones = await _db.CajasSesiones.AsNoTracking()
            .Where(s => ids.Contains(s.IdCuenta) && s.IdEstado == CajaSesionEstado.Abierta)
            .Select(s => new { s.IdCuenta, s.Id })
            .ToListAsync();

        var porCuenta = totales.ToDictionary(t => t.IdCuenta);
        var sesionPorCuenta = sesiones
            .GroupBy(s => s.IdCuenta)
            .ToDictionary(g => g.Key, g => g.Max(x => x.Id));

        return cuentas.Select(c =>
        {
            porCuenta.TryGetValue(c.Id, out var t);
            var ingresos = t?.Ingresos ?? 0m;
            var egresos = t?.Egresos ?? 0m;
            return new CuentaSaldo
            {
                Id = c.Id,
                Nombre = c.Nombre,
                IdTipo = c.IdTipo,
                Tipo = c.IdTipoNavigation?.Nombre ?? "",
                EsEfectivo = c.IdTipoNavigation?.EsEfectivo ?? false,
                IdLocal = c.IdLocal,
                Local = c.IdLocalNavigation?.Nombre,
                Moneda = c.Moneda,
                SaldoInicial = c.SaldoInicial,
                Ingresos = ingresos,
                Egresos = egresos,
                Saldo = c.SaldoInicial + ingresos - egresos,
                Movimientos = t?.Cantidad ?? 0,
                UltimoMovimiento = t?.Ultimo,
                Activa = c.Activa,
                RequiereArqueo = c.RequiereArqueo,
                PermiteNegativo = c.PermiteNegativo,
                Color = c.Color,
                Icono = c.Icono,
                Orden = c.Orden,
                IdSesionAbierta = sesionPorCuenta.TryGetValue(c.Id, out var idS) ? idS : null
            };
        }).ToList();
    }

    public async Task<List<FlujoDia>> Flujo(CajaFiltro filtro)
    {
        var dias = await Query(filtro)
            .GroupBy(x => x.Fecha)
            .Select(g => new
            {
                Fecha = g.Key,
                Ingresos = g.Sum(x => x.Ingreso),
                Egresos = g.Sum(x => x.Egreso)
            })
            .OrderBy(x => x.Fecha)
            .ToListAsync();

        var acumulado = 0m;
        return dias.Select(d =>
        {
            acumulado += d.Ingresos - d.Egresos;
            return new FlujoDia
            {
                Fecha = d.Fecha,
                Ingresos = d.Ingresos,
                Egresos = d.Egresos,
                Acumulado = acumulado
            };
        }).ToList();
    }

    public async Task<List<MontoPorClave>> EgresosPorTipo(CajaFiltro filtro)
    {
        var datos = await Query(filtro)
            .Where(x => x.Egreso > 0)
            .GroupBy(x => x.TipoMov)
            .Select(g => new { TipoMov = g.Key, Monto = g.Sum(x => x.Egreso), Cantidad = g.Count() })
            .ToListAsync();

        return datos
            .Select(d => new MontoPorClave
            {
                Nombre = CajaTipoMov.Etiqueta(d.TipoMov),
                Monto = d.Monto,
                Cantidad = d.Cantidad
            })
            .OrderByDescending(d => d.Monto)
            .ToList();
    }

    public async Task<(decimal ingresos, decimal egresos, decimal pagos)> TotalesPeriodo(
        DateTime desde, DateTime hasta, int? idCuenta, int? idLocal)
    {
        var filtro = new CajaFiltro
        {
            FechaDesde = desde,
            FechaHasta = hasta,
            IdCuenta = idCuenta,
            IdLocal = idLocal
        };
        var query = Query(filtro);

        var ingresos = await query.SumAsync(x => (decimal?)x.Ingreso) ?? 0m;
        var egresos = await query.SumAsync(x => (decimal?)x.Egreso) ?? 0m;
        var pagos = await query
            .Where(x => x.TipoMov == CajaTipoMov.PagoProveedor)
            .SumAsync(x => (decimal?)x.Egreso) ?? 0m;

        return (ingresos, egresos, pagos);
    }

    public async Task<List<CajaMesAgregado>> TotalesPorMes(DateTime desde, DateTime hasta)
    {
        return await _db.Cajas.AsNoTracking()
            .Where(x => !x.Anulado && x.Fecha >= desde.Date && x.Fecha <= hasta.Date)
            .GroupBy(x => new
            {
                Anio = x.Fecha.Year,
                Mes = x.Fecha.Month,
                EsEfectivo = x.IdCuentaNavigation.IdTipoNavigation.EsEfectivo
            })
            .Select(g => new CajaMesAgregado
            {
                Anio = g.Key.Anio,
                Mes = g.Key.Mes,
                EsEfectivo = g.Key.EsEfectivo,
                Ingresos = g.Sum(x => x.Ingreso),
                Egresos = g.Sum(x => x.Egreso)
            })
            .ToListAsync();
    }

    // ═════════════════════════════ Movimientos manuales ══════════════════════════

    public async Task<bool> ActualizarManual(
        int id, DateTime fecha, string concepto, decimal ingreso, decimal egreso,
        string? notaInterna, int? idMedioPago, int idUsuario)
    {
        var mov = await _db.Cajas.FirstOrDefaultAsync(x => x.Id == id);
        if (mov == null || mov.Anulado || !CajaTipoMov.EsManual(mov.TipoMov)) return false;

        mov.Fecha = fecha.Date;
        mov.Concepto = Recortar(concepto, 300) ?? "";
        mov.Ingreso = ingreso;
        mov.Egreso = egreso;
        mov.NotaInterna = Recortar(notaInterna, 300);
        mov.IdMedioPago = idMedioPago;
        mov.IdUsuarioModifica = idUsuario;
        mov.FechaModifica = DateTime.Now;
        await _db.SaveChangesAsync();
        return true;
    }

    // ═══════════════════════════ Transferencias de fondos ════════════════════════

    /// <summary>
    /// Una transferencia son dos asientos espejo: egreso en origen e ingreso en destino.
    /// Se permiten importes distintos para absorber comisiones bancarias.
    /// </summary>
    public async Task<int> Transferir(CajasTransferenciasCuenta transferencia, int idUsuario)
    {
        transferencia.IdUsuarioRegistra = idUsuario;
        transferencia.FechaRegistra = DateTime.Now;
        transferencia.Fecha = transferencia.Fecha.Date;
        if (transferencia.ImporteDestino <= 0)
            transferencia.ImporteDestino = transferencia.ImporteOrigen;

        _db.CajasTransferenciasCuentas.Add(transferencia);
        await _db.SaveChangesAsync();

        var nombres = await _db.Cuentas.AsNoTracking()
            .Where(c => c.Id == transferencia.IdCuentaOrigen || c.Id == transferencia.IdCuentaDestino)
            .Select(c => new { c.Id, c.Nombre })
            .ToListAsync();
        string Nombre(int id) => nombres.FirstOrDefault(n => n.Id == id)?.Nombre ?? $"#{id}";

        var salida = await Registrar(new CajaAsiento
        {
            IdCuenta = transferencia.IdCuentaOrigen,
            Fecha = transferencia.Fecha,
            TipoMov = CajaTipoMov.TransferenciaSalida,
            IdMov = transferencia.Id,
            Concepto = $"Transferencia a {Nombre(transferencia.IdCuentaDestino)} — {transferencia.Concepto}",
            Egreso = transferencia.ImporteOrigen,
            NotaInterna = transferencia.NotaInterna,
            IdUsuario = idUsuario
        });

        var entrada = await Registrar(new CajaAsiento
        {
            IdCuenta = transferencia.IdCuentaDestino,
            Fecha = transferencia.Fecha,
            TipoMov = CajaTipoMov.TransferenciaEntrada,
            IdMov = transferencia.Id,
            Concepto = $"Transferencia desde {Nombre(transferencia.IdCuentaOrigen)} — {transferencia.Concepto}",
            Ingreso = transferencia.ImporteDestino,
            NotaInterna = transferencia.NotaInterna,
            IdUsuario = idUsuario
        });

        transferencia.IdCajaOrigen = salida.Id;
        transferencia.IdCajaDestino = entrada.Id;
        await _db.SaveChangesAsync();

        return transferencia.Id;
    }

    public Task<List<CajasTransferenciasCuenta>> ListarTransferencias(DateTime? desde, DateTime? hasta, int? idCuenta)
    {
        var query = _db.CajasTransferenciasCuentas.AsNoTracking()
            .Include(x => x.IdCuentaOrigenNavigation)
            .Include(x => x.IdCuentaDestinoNavigation)
            .Include(x => x.IdUsuarioRegistraNavigation)
            .AsQueryable();

        if (desde.HasValue) query = query.Where(x => x.Fecha >= desde.Value.Date);
        if (hasta.HasValue) query = query.Where(x => x.Fecha <= hasta.Value.Date);
        if (idCuenta is > 0)
            query = query.Where(x => x.IdCuentaOrigen == idCuenta || x.IdCuentaDestino == idCuenta);

        return query.OrderByDescending(x => x.Fecha).ThenByDescending(x => x.Id).ToListAsync();
    }

    public async Task<bool> AnularTransferencia(int idTransferencia, int idUsuario, string? motivo)
    {
        var transf = await _db.CajasTransferenciasCuentas.FirstOrDefaultAsync(x => x.Id == idTransferencia);
        if (transf == null) return false;

        await AnularPorOrigen(CajaTipoMov.TransferenciaSalida, idTransferencia, idUsuario, motivo);
        await AnularPorOrigen(CajaTipoMov.TransferenciaEntrada, idTransferencia, idUsuario, motivo);

        _db.CajasTransferenciasCuentas.Remove(transf);
        await _db.SaveChangesAsync();
        return true;
    }

    // ═══════════════════════════ Sesiones de caja / arqueo ═══════════════════════

    public Task<CajasSesion?> SesionAbierta(int idCuenta)
        => _db.CajasSesiones
            .Where(s => s.IdCuenta == idCuenta && s.IdEstado == CajaSesionEstado.Abierta)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

    public Task<CajasSesion?> ObtenerSesion(int idSesion)
        => _db.CajasSesiones.AsNoTracking()
            .Include(s => s.IdCuentaNavigation)
            .Include(s => s.IdLocalNavigation)
            .Include(s => s.IdUsuarioAbreNavigation)
            .Include(s => s.IdUsuarioCierraNavigation)
            .FirstOrDefaultAsync(s => s.Id == idSesion);

    public async Task<CajasSesion> AbrirSesion(CajasSesion sesion)
    {
        sesion.IdEstado = CajaSesionEstado.Abierta;
        sesion.FechaApertura = DateTime.Now;
        _db.CajasSesiones.Add(sesion);
        await _db.SaveChangesAsync();

        // El saldo declarado en la apertura sólo genera asiento si difiere del saldo real:
        // así el arranque del turno queda cuadrado sin inventar movimientos.
        var saldoSistema = await SaldoCuenta(sesion.IdCuenta);
        var ajuste = sesion.SaldoInicial - saldoSistema;
        if (ajuste != 0)
        {
            await Registrar(new CajaAsiento
            {
                IdCuenta = sesion.IdCuenta,
                Fecha = sesion.FechaApertura,
                TipoMov = CajaTipoMov.Apertura,
                IdMov = sesion.Id,
                Concepto = $"Apertura de caja — ajuste de saldo inicial ({(ajuste > 0 ? "sobrante" : "faltante")})",
                Ingreso = ajuste > 0 ? ajuste : 0,
                Egreso = ajuste < 0 ? -ajuste : 0,
                NotaInterna = sesion.NotaApertura,
                IdSesion = sesion.Id,
                IdLocal = sesion.IdLocal,
                IdUnidadNegocio = sesion.IdUnidadNegocio,
                IdUsuario = sesion.IdUsuarioAbre
            });
        }

        return sesion;
    }

    public async Task<CajasSesion?> CerrarSesion(
        int idSesion, decimal saldoDeclarado, string? nota, int idUsuario, bool generarAjuste)
    {
        var sesion = await _db.CajasSesiones.FirstOrDefaultAsync(s => s.Id == idSesion);
        if (sesion == null || sesion.IdEstado != CajaSesionEstado.Abierta) return null;

        var (ingresos, egresos, _) = await TotalesSesion(idSesion);
        var teorico = sesion.SaldoInicial + ingresos - egresos;
        var diferencia = saldoDeclarado - teorico;

        sesion.IdEstado = CajaSesionEstado.Cerrada;
        sesion.FechaCierre = DateTime.Now;
        sesion.SaldoTeorico = teorico;
        sesion.SaldoDeclarado = saldoDeclarado;
        sesion.Diferencia = diferencia;
        sesion.NotaCierre = Recortar(nota, 300);
        sesion.IdUsuarioCierra = idUsuario;
        await _db.SaveChangesAsync();

        if (generarAjuste && diferencia != 0)
        {
            await Registrar(new CajaAsiento
            {
                IdCuenta = sesion.IdCuenta,
                Fecha = sesion.FechaCierre.Value,
                TipoMov = CajaTipoMov.AjusteCierre,
                IdMov = sesion.Id,
                Concepto = $"Arqueo de cierre — {(diferencia > 0 ? "sobrante" : "faltante")} de caja",
                Ingreso = diferencia > 0 ? diferencia : 0,
                Egreso = diferencia < 0 ? -diferencia : 0,
                NotaInterna = nota,
                IdSesion = sesion.Id,
                IdLocal = sesion.IdLocal,
                IdUnidadNegocio = sesion.IdUnidadNegocio,
                IdUsuario = idUsuario
            });
        }

        return sesion;
    }

    public Task<List<CajasSesion>> ListarSesiones(int? idCuenta, int? idEstado, DateTime? desde, DateTime? hasta)
    {
        var query = _db.CajasSesiones.AsNoTracking()
            .Include(s => s.IdCuentaNavigation)
            .Include(s => s.IdLocalNavigation)
            .Include(s => s.IdUsuarioAbreNavigation)
            .Include(s => s.IdUsuarioCierraNavigation)
            .AsQueryable();

        if (idCuenta is > 0) query = query.Where(s => s.IdCuenta == idCuenta);
        if (idEstado is > 0) query = query.Where(s => s.IdEstado == idEstado);
        if (desde.HasValue) query = query.Where(s => s.FechaApertura >= desde.Value.Date);
        if (hasta.HasValue)
        {
            var limite = hasta.Value.Date.AddDays(1).AddTicks(-1);
            query = query.Where(s => s.FechaApertura <= limite);
        }

        return query.OrderByDescending(s => s.FechaApertura).ThenByDescending(s => s.Id).ToListAsync();
    }

    public async Task<(decimal ingresos, decimal egresos, int cantidad)> TotalesSesion(int idSesion)
    {
        // La apertura ya está contemplada en SaldoInicial: sumarla duplicaría el ajuste.
        var query = _db.Cajas.AsNoTracking()
            .Where(x => x.IdSesion == idSesion && !x.Anulado && x.TipoMov != CajaTipoMov.Apertura);

        var ingresos = await query.SumAsync(x => (decimal?)x.Ingreso) ?? 0m;
        var egresos = await query.SumAsync(x => (decimal?)x.Egreso) ?? 0m;
        var cantidad = await query.CountAsync();
        return (ingresos, egresos, cantidad);
    }

    private static string? Recortar(string? valor, int max)
    {
        if (string.IsNullOrWhiteSpace(valor)) return valor;
        var limpio = valor.Trim();
        return limpio.Length <= max ? limpio : limpio[..max];
    }
}
