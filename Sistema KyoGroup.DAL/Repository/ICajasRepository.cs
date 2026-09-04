using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

/// <summary>
/// Libro de caja: motor de asientos y consultas de saldos.
/// Cualquier módulo que mueva dinero pasa por acá; no se escribe en Cajas desde otro lado.
/// </summary>
public interface ICajasRepository
{
    // ── Motor de asientos ──

    /// <summary>
    /// Registra (o actualiza si ya existe) el asiento del origen indicado en el asiento.
    /// Idempotente por (TipoMov, IdMov): reprocesar el mismo origen no duplica movimientos.
    /// </summary>
    Task<Caja> Registrar(CajaAsiento asiento);

    /// <summary>Anula el asiento vigente de un origen. Devuelve false si no había ninguno.</summary>
    Task<bool> AnularPorOrigen(string tipoMov, int idMov, int idUsuario, string? motivo);

    Task<bool> AnularPorId(int idCaja, int idUsuario, string? motivo);

    Task<Caja?> ObtenerPorOrigen(string tipoMov, int idMov);

    Task<Caja?> Obtener(int id);

    // ── Consultas ──

    Task<List<Caja>> Movimientos(CajaFiltro filtro);
    Task<CajaResumen> Resumen(CajaFiltro filtro);
    Task<decimal> SaldoCuenta(int idCuenta, DateTime? hasta = null);
    Task<List<CuentaSaldo>> SaldosPorCuenta(bool soloActivas = true, int? idLocal = null);
    Task<List<FlujoDia>> Flujo(CajaFiltro filtro);
    Task<List<MontoPorClave>> EgresosPorTipo(CajaFiltro filtro);
    Task<(decimal ingresos, decimal egresos, decimal pagos)> TotalesPeriodo(DateTime desde, DateTime hasta, int? idCuenta, int? idLocal);
    Task<List<CajaMesAgregado>> TotalesPorMes(DateTime desde, DateTime hasta);

    // ── Movimientos manuales ──

    Task<bool> ActualizarManual(int id, DateTime fecha, string concepto, decimal ingreso, decimal egreso, string? notaInterna, int? idMedioPago, int idUsuario);

    // ── Transferencias entre cuentas ──

    Task<int> Transferir(CajasTransferenciasCuenta transferencia, int idUsuario);
    Task<List<CajasTransferenciasCuenta>> ListarTransferencias(DateTime? desde, DateTime? hasta, int? idCuenta);
    Task<bool> AnularTransferencia(int idTransferencia, int idUsuario, string? motivo);

    // ── Sesiones de caja / arqueo ──

    Task<CajasSesion?> SesionAbierta(int idCuenta);
    Task<CajasSesion?> ObtenerSesion(int idSesion);
    Task<CajasSesion> AbrirSesion(CajasSesion sesion);
    Task<CajasSesion?> CerrarSesion(int idSesion, decimal saldoDeclarado, string? nota, int idUsuario, bool generarAjuste);
    Task<List<CajasSesion>> ListarSesiones(int? idCuenta, int? idEstado, DateTime? desde, DateTime? hasta);
    Task<(decimal ingresos, decimal egresos, int cantidad)> TotalesSesion(int idSesion);
}
