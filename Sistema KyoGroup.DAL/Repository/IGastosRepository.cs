using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

public interface IGastosRepository
{
    Task<List<Gasto>> Listar(GastoFiltro filtro);
    Task<Gasto?> Obtener(int id);

    /// <summary>Alta del gasto. Si <paramref name="pagoInmediato"/> viene, se cancela en el acto.</summary>
    Task<int> Insertar(Gasto gasto, GastosPago? pagoInmediato, int idUsuario);

    Task<bool> Actualizar(Gasto gasto, int idUsuario);

    /// <summary>Baja lógica: revierte los asientos de caja y el movimiento de cuenta corriente.</summary>
    Task<bool> Anular(int id, string? motivo, int idUsuario);

    Task<DeleteResult> Eliminar(int id);

    Task<List<GastosPago>> ListarPagos(int idGasto);
    Task<int> RegistrarPago(GastosPago pago, int idUsuario);
    Task<bool> AnularPago(int idPago, int idUsuario, string? motivo);

    Task<decimal> SaldoPendiente(int idGasto);
    Task<GastoResumen> Resumen(GastoFiltro filtro);
    Task<List<MontoPorClave>> PorCategoria(GastoFiltro filtro);
    Task<List<MontoPorClave>> PorProveedor(GastoFiltro filtro, int top);
    Task<List<Gasto>> ProximosVencimientos(int dias, int top);
    Task<List<GastoMesAgregado>> TotalesPorMes(DateTime desde, DateTime hasta);
}

public class GastoResumen
{
    public decimal Total { get; set; }
    public decimal Pagado { get; set; }
    public decimal Pendiente { get; set; }
    public decimal Vencido { get; set; }
    public int Cantidad { get; set; }
    public int CantidadVencidos { get; set; }
    public int CantidadPendientes { get; set; }
}
