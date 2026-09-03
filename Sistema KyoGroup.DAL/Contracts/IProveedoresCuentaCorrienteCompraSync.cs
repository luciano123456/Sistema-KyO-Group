namespace SistemaKyoGroup.DAL.Contracts;

public interface IProveedoresCuentaCorrienteCompraSync
{
    Task RegistrarMovimientoCompra(int idProveedor, int idCompra, decimal importe, DateTime fecha);
    Task ActualizarMovimientoCompra(int idCompra, decimal importe, DateTime fecha);
    Task EliminarMovimientosCompra(int idCompra);
}
