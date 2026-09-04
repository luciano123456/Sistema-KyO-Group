using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class CajasController : Controller
{
    private readonly ICajasService _service;

    public CajasController(ICajasService service)
    {
        _service = service;
    }

    [AllowAnonymous]
    public IActionResult Index(int? idCuenta)
    {
        var qs = idCuenta is > 0 ? $"&idCuenta={idCuenta}" : "";
        return Redirect($"/Finanzas?tab=cajas{qs}");
    }

    [AllowAnonymous]
    public IActionResult Sesiones() => Redirect("/Finanzas?tab=cajas");

    // ═════════════════════════════════ Cuentas / saldos ═════════════════════════

    [HttpGet]
    public async Task<IActionResult> Saldos(bool soloActivas = true, int? idLocal = null)
        => Ok(await _service.SaldosPorCuenta(soloActivas, idLocal));

    [HttpGet]
    public async Task<IActionResult> Saldo(int idCuenta)
        => Ok(new { IdCuenta = idCuenta, Saldo = await _service.SaldoCuenta(idCuenta) });

    // ═══════════════════════════════════ Movimientos ════════════════════════════

    [HttpGet]
    public async Task<IActionResult> Movimientos(
        int? idCuenta, int? idLocal, int? idUnidadNegocio, int? idSesion,
        DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto,
        bool incluirAnulados = false)
    {
        var movs = await _service.Movimientos(ArmarFiltro(
            idCuenta, idLocal, idUnidadNegocio, idSesion, fechaDesde, fechaHasta, tipoMov, texto, incluirAnulados));

        return Ok(movs.Select(m => new
        {
            m.Id,
            m.IdCuenta,
            Cuenta = m.IdCuentaNavigation?.Nombre,
            m.Fecha,
            m.TipoMov,
            TipoMovNombre = CajaTipoMov.Etiqueta(m.TipoMov),
            EsManual = CajaTipoMov.EsManual(m.TipoMov),
            m.IdMov,
            m.Concepto,
            m.Ingreso,
            m.Egreso,
            Neto = m.Ingreso - m.Egreso,
            m.IdMedioPago,
            MedioPago = m.IdMedioPagoNavigation?.Nombre,
            m.IdLocal,
            Local = m.IdLocalNavigation?.Nombre,
            m.IdSesion,
            m.NotaInterna,
            m.Anulado,
            m.MotivoAnula,
            m.FechaRegistra,
            UsuarioRegistra = UsuarioNombre.Mostrar(m.IdUsuarioRegistraNavigation)
        }));
    }

    [HttpGet]
    public async Task<IActionResult> Resumen(
        int? idCuenta, int? idLocal, int? idUnidadNegocio, int? idSesion,
        DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto,
        bool incluirAnulados = false)
    {
        var resumen = await _service.Resumen(ArmarFiltro(
            idCuenta, idLocal, idUnidadNegocio, idSesion, fechaDesde, fechaHasta, tipoMov, texto, incluirAnulados));

        return Ok(new
        {
            resumen.SaldoAnterior,
            resumen.Ingresos,
            resumen.Egresos,
            resumen.Cantidad,
            resumen.SaldoFinal,
            Neto = resumen.Ingresos - resumen.Egresos
        });
    }

    [HttpPost]
    public async Task<IActionResult> RegistrarMovimiento([FromBody] Caja model)
    {
        var result = await _service.RegistrarMovimiento(model, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo, id = result.IdReferencia });
    }

    [HttpPut]
    public async Task<IActionResult> ActualizarMovimiento([FromBody] Caja model)
    {
        var result = await _service.ActualizarMovimiento(model, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo });
    }

    [HttpDelete]
    public async Task<IActionResult> AnularMovimiento(int id, string? motivo)
    {
        var result = await _service.AnularMovimiento(id, motivo, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo });
    }

    // ═════════════════════════════════ Transferencias ═══════════════════════════

    [HttpGet]
    public async Task<IActionResult> Transferencias(DateTime? fechaDesde, DateTime? fechaHasta, int? idCuenta)
    {
        var lista = await _service.ListarTransferencias(fechaDesde, fechaHasta, idCuenta);
        return Ok(lista.Select(t => new
        {
            t.Id,
            t.Fecha,
            t.IdCuentaOrigen,
            CuentaOrigen = t.IdCuentaOrigenNavigation?.Nombre,
            t.IdCuentaDestino,
            CuentaDestino = t.IdCuentaDestinoNavigation?.Nombre,
            t.Concepto,
            t.ImporteOrigen,
            t.ImporteDestino,
            Comision = t.ImporteOrigen - t.ImporteDestino,
            t.NotaInterna,
            t.FechaRegistra,
            UsuarioRegistra = UsuarioNombre.Mostrar(t.IdUsuarioRegistraNavigation)
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Transferir([FromBody] CajasTransferenciasCuenta model)
    {
        var result = await _service.Transferir(model, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo, id = result.IdReferencia });
    }

    [HttpDelete]
    public async Task<IActionResult> AnularTransferencia(int id, string? motivo)
    {
        var result = await _service.AnularTransferencia(id, motivo, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo });
    }

    // ══════════════════════════════ Sesiones / arqueo ═══════════════════════════

    [HttpGet]
    public async Task<IActionResult> ListaSesiones(int? idCuenta, int? idEstado, DateTime? fechaDesde, DateTime? fechaHasta)
    {
        var sesiones = await _service.ListarSesiones(idCuenta, idEstado, fechaDesde, fechaHasta);
        return Ok(sesiones.Select(s => new
        {
            s.Id,
            s.IdCuenta,
            Cuenta = s.IdCuentaNavigation?.Nombre,
            s.IdLocal,
            Local = s.IdLocalNavigation?.Nombre,
            s.IdEstado,
            Estado = CajaSesionEstado.Etiqueta(s.IdEstado),
            s.FechaApertura,
            s.FechaCierre,
            s.SaldoInicial,
            s.SaldoTeorico,
            s.SaldoDeclarado,
            s.Diferencia,
            s.NotaApertura,
            s.NotaCierre,
            UsuarioAbre = UsuarioNombre.Mostrar(s.IdUsuarioAbreNavigation),
            UsuarioCierra = UsuarioNombre.Mostrar(s.IdUsuarioCierraNavigation)
        }));
    }

    [HttpGet]
    public async Task<IActionResult> Sesion(int id)
    {
        var detalle = await _service.DetalleSesion(id);
        return detalle == null ? NotFound() : Ok(detalle);
    }

    [HttpPost]
    public async Task<IActionResult> AbrirSesion([FromBody] CajasSesion model)
    {
        var result = await _service.AbrirSesion(model, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo, id = result.IdReferencia });
    }

    [HttpPost]
    public async Task<IActionResult> CerrarSesion([FromBody] VMCierreCaja model)
    {
        var result = await _service.CerrarSesion(
            model.IdSesion, model.SaldoDeclarado, model.Nota, model.GenerarAjuste, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo, id = result.IdReferencia });
    }

    private static CajaFiltro ArmarFiltro(
        int? idCuenta, int? idLocal, int? idUnidadNegocio, int? idSesion,
        DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto, bool incluirAnulados)
        => new()
        {
            IdCuenta = idCuenta,
            IdLocal = idLocal,
            IdUnidadNegocio = idUnidadNegocio,
            IdSesion = idSesion,
            FechaDesde = fechaDesde,
            FechaHasta = fechaHasta,
            TipoMov = tipoMov,
            Texto = texto,
            IncluirAnulados = incluirAnulados
        };
}

public class VMCierreCaja
{
    public int IdSesion { get; set; }
    public decimal SaldoDeclarado { get; set; }
    public string? Nota { get; set; }
    public bool GenerarAjuste { get; set; } = true;
}
