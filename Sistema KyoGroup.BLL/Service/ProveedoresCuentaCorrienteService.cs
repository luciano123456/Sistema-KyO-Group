using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.DAL.Contracts;
using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IProveedoresCuentaCorrienteService : IProveedoresCuentaCorrienteCompraSync
    {
        Task<List<(Proveedor proveedor, decimal saldo)>> ListarProveedoresConSaldo(string? buscar, bool soloConSaldo);
        Task<List<ProveedoresCuentaCorriente>> Movimientos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto);
        Task<object> ResumenCompleto(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto);
        Task<ServiceResult> RegistrarPago(ProveedoresPago pago, int idUsuario);
        Task<List<ProveedoresPago>> ListarPagos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? texto);
        Task<ServiceResult> EliminarPago(int idPago);
        Task<ServiceResult> EliminarMovimiento(int id);
        Task RegistrarMovimientoCompra(int idProveedor, int idCompra, decimal importe, DateTime fecha);
        Task ActualizarMovimientoCompra(int idCompra, decimal importe, DateTime fecha);
        Task EliminarMovimientosCompra(int idCompra);
    }

    public class ProveedoresCuentaCorrienteService : IProveedoresCuentaCorrienteService
    {
        private readonly IProveedoresCuentaCorrienteRepository _repo;

        public ProveedoresCuentaCorrienteService(IProveedoresCuentaCorrienteRepository repo)
        {
            _repo = repo;
        }

        public Task<List<(Proveedor proveedor, decimal saldo)>> ListarProveedoresConSaldo(string? buscar, bool soloConSaldo)
            => _repo.ListarProveedoresConSaldo(buscar, soloConSaldo);

        public Task<List<ProveedoresCuentaCorriente>> Movimientos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto)
            => _repo.Movimientos(idProveedor, fechaDesde, fechaHasta, tipoMov, texto);

        public async Task<object> ResumenCompleto(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto)
        {
            var saldoAnterior = fechaDesde.HasValue
                ? await _repo.SaldoAnterior(idProveedor, fechaDesde.Value)
                : 0m;
            var (debe, haber, cantidad) = await _repo.Resumen(idProveedor, fechaDesde, fechaHasta, tipoMov, texto);
            var saldoActual = await _repo.Saldo(idProveedor);
            return new
            {
                SaldoAnterior = saldoAnterior,
                Debe = debe,
                Haber = haber,
                Cantidad = cantidad,
                SaldoActual = saldoActual,
                SaldoPeriodo = saldoAnterior + debe - haber
            };
        }

        public Task<List<ProveedoresPago>> ListarPagos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? texto)
            => _repo.ListarPagos(idProveedor, fechaDesde, fechaHasta, texto);

        public async Task<ServiceResult> RegistrarPago(ProveedoresPago pago, int idUsuario)
        {
            if (pago.IdProveedor <= 0)
                return ServiceResult.Error("Seleccione un proveedor.", "validacion");
            if (pago.IdCuenta <= 0)
                return ServiceResult.Error("Seleccione una cuenta.", "validacion");
            if (pago.Importe <= 0)
                return ServiceResult.Error("El importe debe ser mayor a cero.", "validacion");
            if (string.IsNullOrWhiteSpace(pago.Concepto))
                return ServiceResult.Error("Indique un concepto.", "validacion");

            pago.FechaRegistra = DateTime.Now;
            pago.IdUsuarioRegistra = idUsuario;
            pago.NotaInterna ??= "";

            await _repo.RegistrarPago(pago);
            return ServiceResult.Success("Pago registrado correctamente.");
        }

        public async Task<ServiceResult> EliminarPago(int idPago)
        {
            if (idPago <= 0)
                return ServiceResult.Error("Pago inválido.", "validacion");

            var ok = await _repo.EliminarPago(idPago);
            return ok
                ? ServiceResult.Success("Pago eliminado. Se revirtió el movimiento en cuenta corriente.")
                : ServiceResult.Error("No se encontró el pago.");
        }

        public async Task<ServiceResult> EliminarMovimiento(int id)
        {
            var ok = await _repo.EliminarMovimiento(id);
            return ok
                ? ServiceResult.Success("Movimiento eliminado.")
                : ServiceResult.Error("No se encontró el movimiento.");
        }

        public Task RegistrarMovimientoCompra(int idProveedor, int idCompra, decimal importe, DateTime fecha)
            => _repo.RegistrarMovimientoCompra(idProveedor, idCompra, importe, fecha, $"Compra #{idCompra}");

        public Task ActualizarMovimientoCompra(int idCompra, decimal importe, DateTime fecha)
            => _repo.ActualizarMovimientoCompra(idCompra, importe, fecha, $"Compra #{idCompra}");

        public Task EliminarMovimientosCompra(int idCompra)
            => _repo.EliminarMovimientosCompra(idCompra);
    }
}
