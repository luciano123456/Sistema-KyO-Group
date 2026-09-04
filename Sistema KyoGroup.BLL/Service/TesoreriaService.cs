using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service;

public interface ITesoreriaService
{
    Task<TesoreriaResumen> Resumen(DateTime desde, DateTime hasta, int? idCuenta, int? idLocal);
    Task<List<Gasto>> ProximosVencimientos(int dias, int top);
    Task<FinanzasControlMensual> ControlMensual(FinanzasControlFiltro filtro);
}

/// <summary>
/// Consolida el estado financiero para el tablero: saldos por cuenta, flujo del
/// período, gastos y deuda con proveedores en una sola foto.
/// </summary>
public class TesoreriaService : ITesoreriaService
{
    private readonly ICajasRepository _cajas;
    private readonly IGastosRepository _gastos;
    private readonly IProveedoresCuentaCorrienteRepository _cuentaCorriente;

    public TesoreriaService(
        ICajasRepository cajas,
        IGastosRepository gastos,
        IProveedoresCuentaCorrienteRepository cuentaCorriente)
    {
        _cajas = cajas;
        _gastos = gastos;
        _cuentaCorriente = cuentaCorriente;
    }

    public async Task<TesoreriaResumen> Resumen(DateTime desde, DateTime hasta, int? idCuenta, int? idLocal)
    {
        var filtroCaja = new CajaFiltro
        {
            FechaDesde = desde,
            FechaHasta = hasta,
            IdCuenta = idCuenta,
            IdLocal = idLocal
        };
        var filtroGastos = new GastoFiltro
        {
            FechaDesde = desde,
            FechaHasta = hasta,
            IdLocal = idLocal
        };

        var cuentas = await _cajas.SaldosPorCuenta(soloActivas: true, idLocal: idLocal);
        if (idCuenta is > 0)
            cuentas = cuentas.Where(c => c.Id == idCuenta).ToList();

        var (ingresos, egresos, pagos) = await _cajas.TotalesPeriodo(desde, hasta, idCuenta, idLocal);
        var gastos = await _gastos.Resumen(filtroGastos);

        // Los pendientes/vencidos son una foto del presente, no del período filtrado.
        var pendientes = await _gastos.Resumen(new GastoFiltro { SoloPendientes = true, IdLocal = idLocal });
        var vencidos = await _gastos.Resumen(new GastoFiltro { SoloVencidos = true, IdLocal = idLocal });

        return new TesoreriaResumen
        {
            SaldoTotal = cuentas.Sum(c => c.Saldo),
            SaldoEfectivo = cuentas.Where(c => c.EsEfectivo).Sum(c => c.Saldo),
            SaldoBancario = cuentas.Where(c => !c.EsEfectivo).Sum(c => c.Saldo),
            IngresosPeriodo = ingresos,
            EgresosPeriodo = egresos,
            PagosPeriodo = pagos,
            GastosPeriodo = gastos.Total,
            GastosPendientes = pendientes.Pendiente,
            GastosVencidos = vencidos.Pendiente,
            CantidadGastosVencidos = vencidos.CantidadVencidos,
            DeudaProveedores = await _cuentaCorriente.DeudaTotal(),
            SesionesAbiertas = cuentas.Count(c => c.IdSesionAbierta != null),
            Cuentas = cuentas,
            Flujo = await _cajas.Flujo(filtroCaja),
            GastosPorCategoria = await _gastos.PorCategoria(filtroGastos),
            EgresosPorTipo = await _cajas.EgresosPorTipo(filtroCaja)
        };
    }

    public Task<List<Gasto>> ProximosVencimientos(int dias, int top)
        => _gastos.ProximosVencimientos(dias, top);

    public async Task<FinanzasControlMensual> ControlMensual(FinanzasControlFiltro filtro)
    {
        filtro ??= new FinanzasControlFiltro();
        var anios = (filtro.Anios ?? new List<int>())
            .Where(a => a >= 2000 && a <= 2100)
            .Distinct()
            .OrderByDescending(a => a)
            .ToList();
        if (anios.Count == 0) anios.Add(DateTime.Today.Year);

        var meses = (filtro.Meses ?? new List<int>())
            .Where(m => m >= 1 && m <= 12)
            .Distinct()
            .OrderBy(m => m)
            .ToList();
        if (meses.Count == 0) meses = Enumerable.Range(1, 12).ToList();

        var incluirEfectivo = filtro.IncluirEfectivo;
        var incluirBancos = filtro.IncluirBancos;
        var incluirGastos = filtro.IncluirGastos;
        if (!incluirEfectivo && !incluirBancos && !incluirGastos)
        {
            incluirEfectivo = true;
            incluirBancos = true;
        }

        var mesesEs = new[]
        {
            "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        };

        var mapa = new Dictionary<(int Anio, int Mes), FinanzasControlFila>();
        FinanzasControlFila Ensure(int anio, int mes)
        {
            var key = (anio, mes);
            if (mapa.TryGetValue(key, out var fila)) return fila;
            fila = new FinanzasControlFila
            {
                Anio = anio,
                Mes = mes,
                MesNombre = mesesEs[mes]
            };
            mapa[key] = fila;
            return fila;
        }

        foreach (var anio in anios)
            foreach (var mes in meses)
                Ensure(anio, mes);

        var desde = new DateTime(anios.Min(), 1, 1);
        var hasta = new DateTime(anios.Max(), 12, 31);

        if (incluirEfectivo || incluirBancos)
        {
            var caja = await _cajas.TotalesPorMes(desde, hasta);
            foreach (var r in caja)
            {
                if (!anios.Contains(r.Anio) || !meses.Contains(r.Mes)) continue;
                if (r.EsEfectivo && !incluirEfectivo) continue;
                if (!r.EsEfectivo && !incluirBancos) continue;

                var fila = Ensure(r.Anio, r.Mes);
                if (r.EsEfectivo)
                {
                    fila.IngEfectivo += r.Ingresos;
                    fila.EgrEfectivo += r.Egresos;
                }
                else
                {
                    fila.IngBanco += r.Ingresos;
                    fila.EgrBanco += r.Egresos;
                }
            }
        }

        if (incluirGastos)
        {
            var gastos = await _gastos.TotalesPorMes(desde, hasta);
            foreach (var r in gastos)
            {
                if (!anios.Contains(r.Anio) || !meses.Contains(r.Mes)) continue;
                var fila = Ensure(r.Anio, r.Mes);
                fila.Gastos += r.Total;
                fila.CantidadGastos += r.Cantidad;
            }
        }

        foreach (var fila in mapa.Values)
        {
            fila.Ingresos = fila.IngEfectivo + fila.IngBanco;
            fila.Egresos = fila.EgrEfectivo + fila.EgrBanco;
            fila.Neto = fila.Ingresos - fila.Egresos;
        }

        var filas = mapa.Values
            .OrderByDescending(f => f.Anio)
            .ThenBy(f => f.Mes)
            .ToList();

        var conGasto = filas.Where(f => f.Gastos > 0).ToList();
        var conMov = filas.Where(f => f.Ingresos != 0 || f.Egresos != 0 || f.Gastos != 0).ToList();

        return new FinanzasControlMensual
        {
            Filas = filas,
            TotalIngresos = filas.Sum(f => f.Ingresos),
            TotalEgresos = filas.Sum(f => f.Egresos),
            TotalGastos = filas.Sum(f => f.Gastos),
            NetoPeriodo = filas.Sum(f => f.Neto),
            MaxGastos = filas.Count == 0 ? 0 : filas.Max(f => f.Gastos),
            MesMasGasto = conGasto.OrderByDescending(f => f.Gastos).FirstOrDefault(),
            MesMenosGasto = conGasto.OrderBy(f => f.Gastos).FirstOrDefault(),
            MejorNeto = conMov.OrderByDescending(f => f.Neto).FirstOrDefault(),
            PeorNeto = conMov.OrderBy(f => f.Neto).FirstOrDefault()
        };
    }
}
