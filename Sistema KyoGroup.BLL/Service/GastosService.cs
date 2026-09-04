using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service;

public interface IGastosService
{
    Task<List<Gasto>> Listar(GastoFiltro filtro);
    Task<Gasto?> Obtener(int id);
    Task<GastoResumen> Resumen(GastoFiltro filtro);
    Task<List<MontoPorClave>> PorCategoria(GastoFiltro filtro);
    Task<List<MontoPorClave>> PorProveedor(GastoFiltro filtro, int top);
    Task<List<Gasto>> ProximosVencimientos(int dias, int top);

    Task<ServiceResult> Guardar(GastoGuardar model, int idUsuario);
    Task<ServiceResult> Anular(int id, string? motivo, int idUsuario);
    Task<ServiceResult> Eliminar(int id);

    Task<List<GastosPago>> ListarPagos(int idGasto);
    Task<ServiceResult> RegistrarPago(GastosPago pago, int idUsuario);
    Task<ServiceResult> AnularPago(int idPago, string? motivo, int idUsuario);
}

public class GastosService : IGastosService
{
    private readonly IGastosRepository _repo;
    private readonly ICuentasRepository _cuentas;
    private readonly ICajasRepository _cajas;

    public GastosService(IGastosRepository repo, ICuentasRepository cuentas, ICajasRepository cajas)
    {
        _repo = repo;
        _cuentas = cuentas;
        _cajas = cajas;
    }

    public Task<List<Gasto>> Listar(GastoFiltro filtro) => _repo.Listar(filtro);
    public Task<Gasto?> Obtener(int id) => _repo.Obtener(id);
    public Task<GastoResumen> Resumen(GastoFiltro filtro) => _repo.Resumen(filtro);
    public Task<List<MontoPorClave>> PorCategoria(GastoFiltro filtro) => _repo.PorCategoria(filtro);
    public Task<List<MontoPorClave>> PorProveedor(GastoFiltro filtro, int top) => _repo.PorProveedor(filtro, top);
    public Task<List<Gasto>> ProximosVencimientos(int dias, int top) => _repo.ProximosVencimientos(dias, top);
    public Task<List<GastosPago>> ListarPagos(int idGasto) => _repo.ListarPagos(idGasto);

    // ═══════════════════════════════ Alta / edición ══════════════════════════════

    public async Task<ServiceResult> Guardar(GastoGuardar model, int idUsuario)
    {
        if (model.IdCategoria <= 0)
            return ServiceResult.Error("Seleccione una categoría de gasto.", "validacion");
        if (string.IsNullOrWhiteSpace(model.Concepto))
            return ServiceResult.Error("Indique un concepto.", "validacion");
        if (model.Importe <= 0)
            return ServiceResult.Error("El importe debe ser mayor a cero.", "validacion");
        if (model.Fecha == default)
            model.Fecha = DateTime.Today;
        if (model.FechaVencimiento.HasValue && model.FechaVencimiento.Value.Date < model.Fecha.Date)
            return ServiceResult.Error("El vencimiento no puede ser anterior a la fecha del gasto.", "validacion");
        if (model.ImpactaCuentaCorriente && model.IdProveedor is null or <= 0)
            return ServiceResult.Error("Para impactar en cuenta corriente hay que indicar el proveedor.", "validacion");

        var gasto = new Gasto
        {
            Id = model.Id,
            IdUnidadNegocio = model.IdUnidadNegocio is > 0 ? model.IdUnidadNegocio : null,
            IdLocal = model.IdLocal is > 0 ? model.IdLocal : null,
            IdCategoria = model.IdCategoria,
            IdProveedor = model.IdProveedor is > 0 ? model.IdProveedor : null,
            Fecha = model.Fecha,
            FechaVencimiento = model.FechaVencimiento,
            Concepto = model.Concepto.Trim(),
            Detalle = Vacio(model.Detalle),
            ComprobanteTipo = Vacio(model.ComprobanteTipo),
            ComprobanteNumero = Vacio(model.ComprobanteNumero),
            Importe = model.Importe,
            ImpactaCuentaCorriente = model.ImpactaCuentaCorriente,
            NotaInterna = Vacio(model.NotaInterna)
        };

        if (model.Id > 0)
        {
            var existente = await _repo.Obtener(model.Id);
            if (existente == null)
                return ServiceResult.Error("No se encontró el gasto.", "validacion");
            if (existente.Anulado)
                return ServiceResult.Error("El gasto está anulado y no se puede editar.", "validacion");

            // Bajar el importe por debajo de lo ya pagado dejaría el gasto sobrepagado.
            if (model.Importe < existente.ImportePagado)
            {
                return ServiceResult.Error(
                    $"El gasto ya tiene {existente.ImportePagado:C2} pagados. Anule pagos antes de bajar el importe a {model.Importe:C2}.",
                    "validacion");
            }

            var actualizado = await _repo.Actualizar(gasto, idUsuario);
            return actualizado
                ? new ServiceResult { Ok = true, Mensaje = "Gasto actualizado.", Tipo = "success", IdReferencia = model.Id }
                : ServiceResult.Error("No se pudo actualizar el gasto.");
        }

        GastosPago? pago = null;
        if (model.PagarAhora)
        {
            var importePago = model.ImportePago is > 0 ? model.ImportePago.Value : model.Importe;
            if (importePago > model.Importe)
                return ServiceResult.Error("El pago no puede superar el importe del gasto.", "validacion");

            var validacion = await ValidarCuentaPago(model.IdCuentaPago ?? 0, importePago);
            if (!validacion.Ok) return validacion;

            pago = new GastosPago
            {
                IdCuenta = model.IdCuentaPago!.Value,
                IdMedioPago = model.IdMedioPago is > 0 ? model.IdMedioPago : null,
                Fecha = model.FechaPago?.Date ?? model.Fecha,
                Importe = importePago,
                NotaInterna = Vacio(model.NotaInterna)
            };
        }

        var id = await _repo.Insertar(gasto, pago, idUsuario);
        var mensaje = pago == null
            ? "Gasto registrado."
            : pago.Importe >= model.Importe
                ? "Gasto registrado y pagado. El egreso ya impactó en la caja."
                : "Gasto registrado con un pago parcial. El egreso ya impactó en la caja.";

        return new ServiceResult { Ok = true, Mensaje = mensaje, Tipo = "success", IdReferencia = id };
    }

    public async Task<ServiceResult> Anular(int id, string? motivo, int idUsuario)
    {
        if (id <= 0) return ServiceResult.Error("Gasto inválido.", "validacion");

        var ok = await _repo.Anular(id, motivo, idUsuario);
        return ok
            ? ServiceResult.Success("Gasto anulado. Se revirtieron los movimientos de caja y de cuenta corriente.")
            : ServiceResult.Error("No se encontró el gasto o ya estaba anulado.", "validacion");
    }

    public async Task<ServiceResult> Eliminar(int id)
    {
        var result = await _repo.Eliminar(id);
        return ServiceResult.FromDelete(result);
    }

    // ═════════════════════════════════════ Pagos ═════════════════════════════════

    public async Task<ServiceResult> RegistrarPago(GastosPago pago, int idUsuario)
    {
        if (pago.IdGasto <= 0)
            return ServiceResult.Error("Gasto inválido.", "validacion");
        if (pago.Importe <= 0)
            return ServiceResult.Error("El importe debe ser mayor a cero.", "validacion");

        var gasto = await _repo.Obtener(pago.IdGasto);
        if (gasto == null)
            return ServiceResult.Error("No se encontró el gasto.", "validacion");
        if (gasto.Anulado)
            return ServiceResult.Error("El gasto está anulado.", "validacion");

        var pendiente = await _repo.SaldoPendiente(pago.IdGasto);
        if (pendiente <= 0)
            return ServiceResult.Error("El gasto ya está totalmente pagado.", "validacion");
        if (pago.Importe > pendiente)
            return ServiceResult.Error($"El importe supera el saldo pendiente de {pendiente:C2}.", "validacion");

        var validacion = await ValidarCuentaPago(pago.IdCuenta, pago.Importe);
        if (!validacion.Ok) return validacion;

        var id = await _repo.RegistrarPago(pago, idUsuario);
        if (id <= 0) return ServiceResult.Error("No se pudo registrar el pago.");

        var restante = pendiente - pago.Importe;
        var mensaje = restante <= 0
            ? "Gasto pagado por completo. Egreso registrado en caja."
            : $"Pago registrado. Queda un saldo pendiente de {restante:C2}.";

        return new ServiceResult { Ok = true, Mensaje = mensaje, Tipo = "success", IdReferencia = id };
    }

    public async Task<ServiceResult> AnularPago(int idPago, string? motivo, int idUsuario)
    {
        if (idPago <= 0) return ServiceResult.Error("Pago inválido.", "validacion");

        var ok = await _repo.AnularPago(idPago, idUsuario, motivo);
        return ok
            ? ServiceResult.Success("Pago anulado. Se revirtió el egreso de caja.")
            : ServiceResult.Error("No se encontró el pago o ya estaba anulado.", "validacion");
    }

    // ═══════════════════════════════════ Helpers ═════════════════════════════════

    private async Task<ServiceResult> ValidarCuentaPago(int idCuenta, decimal importe)
    {
        if (idCuenta <= 0)
            return ServiceResult.Error("Seleccione la cuenta desde la que se paga.", "validacion");

        var cuenta = await _cuentas.Obtener(idCuenta);
        if (cuenta == null)
            return ServiceResult.Error("La cuenta seleccionada no existe.", "validacion");
        if (!cuenta.Activa)
            return ServiceResult.Error($"La cuenta \"{cuenta.Nombre}\" está desactivada.", "validacion");

        if (!cuenta.PermiteNegativo)
        {
            var saldo = await _cajas.SaldoCuenta(idCuenta);
            if (importe > saldo)
            {
                return ServiceResult.Error(
                    $"La cuenta \"{cuenta.Nombre}\" tiene {saldo:C2} disponibles y no admite saldo negativo.",
                    "validacion");
            }
        }

        return ServiceResult.Success();
    }

    private static string? Vacio(string? valor)
        => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
}
