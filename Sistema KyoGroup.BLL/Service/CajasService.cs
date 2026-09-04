using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service;

public interface ICajasService
{
    Task<List<Caja>> Movimientos(CajaFiltro filtro);
    Task<CajaResumen> Resumen(CajaFiltro filtro);
    Task<List<CuentaSaldo>> SaldosPorCuenta(bool soloActivas, int? idLocal);
    Task<decimal> SaldoCuenta(int idCuenta);

    Task<ServiceResult> RegistrarMovimiento(Caja model, int idUsuario);
    Task<ServiceResult> ActualizarMovimiento(Caja model, int idUsuario);
    Task<ServiceResult> AnularMovimiento(int id, string? motivo, int idUsuario);

    Task<ServiceResult> Transferir(CajasTransferenciasCuenta model, int idUsuario);
    Task<List<CajasTransferenciasCuenta>> ListarTransferencias(DateTime? desde, DateTime? hasta, int? idCuenta);
    Task<ServiceResult> AnularTransferencia(int id, string? motivo, int idUsuario);

    Task<ServiceResult> AbrirSesion(CajasSesion model, int idUsuario);
    Task<ServiceResult> CerrarSesion(int idSesion, decimal saldoDeclarado, string? nota, bool generarAjuste, int idUsuario);
    Task<List<CajasSesion>> ListarSesiones(int? idCuenta, int? idEstado, DateTime? desde, DateTime? hasta);
    Task<object?> DetalleSesion(int idSesion);
}

public class CajasService : ICajasService
{
    private readonly ICajasRepository _repo;
    private readonly ICuentasRepository _cuentas;

    public CajasService(ICajasRepository repo, ICuentasRepository cuentas)
    {
        _repo = repo;
        _cuentas = cuentas;
    }

    public Task<List<Caja>> Movimientos(CajaFiltro filtro) => _repo.Movimientos(filtro);
    public Task<CajaResumen> Resumen(CajaFiltro filtro) => _repo.Resumen(filtro);
    public Task<List<CuentaSaldo>> SaldosPorCuenta(bool soloActivas, int? idLocal) => _repo.SaldosPorCuenta(soloActivas, idLocal);
    public Task<decimal> SaldoCuenta(int idCuenta) => _repo.SaldoCuenta(idCuenta);

    // ═══════════════════════════ Movimientos manuales ════════════════════════════

    public async Task<ServiceResult> RegistrarMovimiento(Caja model, int idUsuario)
    {
        var ingreso = Math.Max(0, model.Ingreso);
        var egreso = Math.Max(0, model.Egreso);

        if (ingreso > 0 && egreso > 0)
            return ServiceResult.Error("Un movimiento es ingreso o egreso, no los dos.", "validacion");
        if (ingreso == 0 && egreso == 0)
            return ServiceResult.Error("El importe debe ser mayor a cero.", "validacion");
        if (string.IsNullOrWhiteSpace(model.Concepto))
            return ServiceResult.Error("Indique un concepto.", "validacion");

        var validacion = await ValidarCuenta(model.IdCuenta, egreso);
        if (!validacion.Ok) return validacion;

        var tipoMov = ingreso > 0 ? CajaTipoMov.Ingreso : CajaTipoMov.Egreso;
        var asiento = await _repo.Registrar(new CajaAsiento
        {
            IdCuenta = model.IdCuenta,
            Fecha = model.Fecha == default ? DateTime.Today : model.Fecha,
            TipoMov = tipoMov,
            Concepto = model.Concepto.Trim(),
            Ingreso = ingreso,
            Egreso = egreso,
            IdLocal = model.IdLocal is > 0 ? model.IdLocal : null,
            IdUnidadNegocio = model.IdUnidadNegocio is > 0 ? model.IdUnidadNegocio : null,
            IdMedioPago = model.IdMedioPago is > 0 ? model.IdMedioPago : null,
            NotaInterna = model.NotaInterna,
            IdUsuario = idUsuario
        });

        return new ServiceResult
        {
            Ok = true,
            Mensaje = ingreso > 0 ? "Ingreso registrado en caja." : "Egreso registrado en caja.",
            Tipo = "success",
            IdReferencia = asiento.Id
        };
    }

    public async Task<ServiceResult> ActualizarMovimiento(Caja model, int idUsuario)
    {
        var actual = await _repo.Obtener(model.Id);
        if (actual == null)
            return ServiceResult.Error("No se encontró el movimiento.", "validacion");
        if (actual.Anulado)
            return ServiceResult.Error("El movimiento está anulado y no se puede editar.", "validacion");
        if (!CajaTipoMov.EsManual(actual.TipoMov))
            return ServiceResult.Error(
                $"Este movimiento lo generó otro módulo ({CajaTipoMov.Etiqueta(actual.TipoMov)}). Modifíquelo desde su origen.",
                "validacion");

        var ingreso = Math.Max(0, model.Ingreso);
        var egreso = Math.Max(0, model.Egreso);
        if (ingreso > 0 && egreso > 0)
            return ServiceResult.Error("Un movimiento es ingreso o egreso, no los dos.", "validacion");
        if (ingreso == 0 && egreso == 0)
            return ServiceResult.Error("El importe debe ser mayor a cero.", "validacion");
        if (string.IsNullOrWhiteSpace(model.Concepto))
            return ServiceResult.Error("Indique un concepto.", "validacion");

        // Al editar sólo hace falta cubrir el incremento del egreso.
        var deltaEgreso = egreso - actual.Egreso - (ingreso - actual.Ingreso);
        var validacion = await ValidarCuenta(actual.IdCuenta, Math.Max(0, deltaEgreso));
        if (!validacion.Ok) return validacion;

        var ok = await _repo.ActualizarManual(
            model.Id,
            model.Fecha == default ? actual.Fecha : model.Fecha,
            model.Concepto.Trim(),
            ingreso,
            egreso,
            model.NotaInterna,
            model.IdMedioPago is > 0 ? model.IdMedioPago : null,
            idUsuario);

        return ok
            ? ServiceResult.Success("Movimiento actualizado.")
            : ServiceResult.Error("No se pudo actualizar el movimiento.");
    }

    public async Task<ServiceResult> AnularMovimiento(int id, string? motivo, int idUsuario)
    {
        var actual = await _repo.Obtener(id);
        if (actual == null)
            return ServiceResult.Error("No se encontró el movimiento.", "validacion");
        if (actual.Anulado)
            return ServiceResult.Error("El movimiento ya estaba anulado.", "validacion");

        if (!CajaTipoMov.EsManual(actual.TipoMov))
        {
            return ServiceResult.Error(
                $"Este movimiento es el reflejo de un {CajaTipoMov.Etiqueta(actual.TipoMov).ToLowerInvariant()}. " +
                "Anúlelo desde su módulo de origen para que ambos libros queden consistentes.",
                "validacion");
        }

        var ok = await _repo.AnularPorId(id, idUsuario, motivo);
        return ok
            ? ServiceResult.Success("Movimiento anulado. El saldo de la cuenta ya lo refleja.")
            : ServiceResult.Error("No se pudo anular el movimiento.");
    }

    // ═════════════════════════════ Transferencias ════════════════════════════════

    public async Task<ServiceResult> Transferir(CajasTransferenciasCuenta model, int idUsuario)
    {
        if (model.IdCuentaOrigen <= 0 || model.IdCuentaDestino <= 0)
            return ServiceResult.Error("Seleccione la cuenta de origen y la de destino.", "validacion");
        if (model.IdCuentaOrigen == model.IdCuentaDestino)
            return ServiceResult.Error("La cuenta de origen y la de destino deben ser distintas.", "validacion");
        if (model.ImporteOrigen <= 0)
            return ServiceResult.Error("El importe debe ser mayor a cero.", "validacion");
        if (model.ImporteDestino < 0)
            return ServiceResult.Error("El importe acreditado no puede ser negativo.", "validacion");
        if (string.IsNullOrWhiteSpace(model.Concepto))
            return ServiceResult.Error("Indique un concepto.", "validacion");

        var origen = await ValidarCuenta(model.IdCuentaOrigen, model.ImporteOrigen);
        if (!origen.Ok) return origen;

        var destino = await _cuentas.Obtener(model.IdCuentaDestino);
        if (destino == null)
            return ServiceResult.Error("La cuenta de destino no existe.", "validacion");
        if (!destino.Activa)
            return ServiceResult.Error($"La cuenta \"{destino.Nombre}\" está desactivada.", "validacion");

        if (model.Fecha == default) model.Fecha = DateTime.Today;
        var id = await _repo.Transferir(model, idUsuario);

        return new ServiceResult
        {
            Ok = true,
            Mensaje = "Transferencia registrada. Se generó el egreso en origen y el ingreso en destino.",
            Tipo = "success",
            IdReferencia = id
        };
    }

    public Task<List<CajasTransferenciasCuenta>> ListarTransferencias(DateTime? desde, DateTime? hasta, int? idCuenta)
        => _repo.ListarTransferencias(desde, hasta, idCuenta);

    public async Task<ServiceResult> AnularTransferencia(int id, string? motivo, int idUsuario)
    {
        var ok = await _repo.AnularTransferencia(id, idUsuario, motivo);
        return ok
            ? ServiceResult.Success("Transferencia anulada. Se revirtieron los dos asientos.")
            : ServiceResult.Error("No se encontró la transferencia.", "validacion");
    }

    // ══════════════════════════ Sesiones de caja / arqueo ════════════════════════

    public async Task<ServiceResult> AbrirSesion(CajasSesion model, int idUsuario)
    {
        var cuenta = await _cuentas.Obtener(model.IdCuenta);
        if (cuenta == null)
            return ServiceResult.Error("Seleccione una cuenta válida.", "validacion");
        if (!cuenta.Activa)
            return ServiceResult.Error($"La cuenta \"{cuenta.Nombre}\" está desactivada.", "validacion");

        var abierta = await _repo.SesionAbierta(model.IdCuenta);
        if (abierta != null)
        {
            return ServiceResult.Error(
                $"La caja \"{cuenta.Nombre}\" ya tiene un turno abierto desde el {abierta.FechaApertura:dd/MM/yyyy HH:mm}. Ciérrelo antes de abrir otro.",
                "validacion",
                abierta.Id);
        }

        if (model.SaldoInicial < 0)
            return ServiceResult.Error("El saldo inicial no puede ser negativo.", "validacion");

        model.IdUsuarioAbre = idUsuario;
        model.IdLocal = model.IdLocal is > 0 ? model.IdLocal : cuenta.IdLocal;
        var sesion = await _repo.AbrirSesion(model);

        return new ServiceResult
        {
            Ok = true,
            Mensaje = $"Caja \"{cuenta.Nombre}\" abierta con {sesion.SaldoInicial:C0}.",
            Tipo = "success",
            IdReferencia = sesion.Id
        };
    }

    public async Task<ServiceResult> CerrarSesion(
        int idSesion, decimal saldoDeclarado, string? nota, bool generarAjuste, int idUsuario)
    {
        if (saldoDeclarado < 0)
            return ServiceResult.Error("El saldo contado no puede ser negativo.", "validacion");

        var sesion = await _repo.CerrarSesion(idSesion, saldoDeclarado, nota, idUsuario, generarAjuste);
        if (sesion == null)
            return ServiceResult.Error("No se encontró un turno abierto con ese identificador.", "validacion");

        var dif = sesion.Diferencia ?? 0m;
        var mensaje = dif == 0
            ? "Caja cerrada sin diferencias. Arqueo perfecto."
            : dif > 0
                ? $"Caja cerrada con un sobrante de {dif:C2}." + (generarAjuste ? " Se registró el ajuste." : "")
                : $"Caja cerrada con un faltante de {Math.Abs(dif):C2}." + (generarAjuste ? " Se registró el ajuste." : "");

        return new ServiceResult
        {
            Ok = true,
            Mensaje = mensaje,
            Tipo = dif == 0 ? "success" : "info",
            IdReferencia = sesion.Id
        };
    }

    public Task<List<CajasSesion>> ListarSesiones(int? idCuenta, int? idEstado, DateTime? desde, DateTime? hasta)
        => _repo.ListarSesiones(idCuenta, idEstado, desde, hasta);

    public async Task<object?> DetalleSesion(int idSesion)
    {
        var sesion = await _repo.ObtenerSesion(idSesion);
        if (sesion == null) return null;

        var (ingresos, egresos, cantidad) = await _repo.TotalesSesion(idSesion);
        var teorico = sesion.SaldoTeorico ?? sesion.SaldoInicial + ingresos - egresos;

        return new
        {
            sesion.Id,
            sesion.IdCuenta,
            Cuenta = sesion.IdCuentaNavigation?.Nombre,
            sesion.IdLocal,
            Local = sesion.IdLocalNavigation?.Nombre,
            sesion.IdEstado,
            Estado = CajaSesionEstado.Etiqueta(sesion.IdEstado),
            sesion.FechaApertura,
            sesion.FechaCierre,
            sesion.SaldoInicial,
            Ingresos = ingresos,
            Egresos = egresos,
            Movimientos = cantidad,
            SaldoTeorico = teorico,
            sesion.SaldoDeclarado,
            sesion.Diferencia,
            sesion.NotaApertura,
            sesion.NotaCierre,
            UsuarioAbre = UsuarioNombre.Mostrar(sesion.IdUsuarioAbreNavigation),
            UsuarioCierra = UsuarioNombre.Mostrar(sesion.IdUsuarioCierraNavigation)
        };
    }

    // ═══════════════════════════════════ Helpers ═════════════════════════════════

    /// <summary>Chequea que la cuenta exista, esté activa y soporte el egreso pedido.</summary>
    private async Task<ServiceResult> ValidarCuenta(int idCuenta, decimal egreso)
    {
        if (idCuenta <= 0)
            return ServiceResult.Error("Seleccione una cuenta.", "validacion");

        var cuenta = await _cuentas.Obtener(idCuenta);
        if (cuenta == null)
            return ServiceResult.Error("La cuenta seleccionada no existe.", "validacion");
        if (!cuenta.Activa)
            return ServiceResult.Error($"La cuenta \"{cuenta.Nombre}\" está desactivada.", "validacion");

        if (egreso > 0 && !cuenta.PermiteNegativo)
        {
            var saldo = await _repo.SaldoCuenta(idCuenta);
            if (egreso > saldo)
            {
                return ServiceResult.Error(
                    $"La cuenta \"{cuenta.Nombre}\" tiene {saldo:C2} disponibles y no admite saldo negativo.",
                    "validacion");
            }
        }

        return ServiceResult.Success();
    }

}
