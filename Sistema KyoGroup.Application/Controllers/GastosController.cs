using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class GastosController : Controller
{
    private readonly IGastosService _service;

    public GastosController(IGastosService service)
    {
        _service = service;
    }

    [AllowAnonymous]
    public IActionResult Index() => Redirect("/Finanzas?tab=gastos");

    [AllowAnonymous]
    public IActionResult NuevoModif(int id = 0)
    {
        ViewData["IdGasto"] = id;
        return View();
    }

    // ═══════════════════════════════════ Consultas ═══════════════════════════════

    [HttpGet]
    public async Task<IActionResult> Lista(
        DateTime? fechaDesde, DateTime? fechaHasta, int? idCategoria, int? idProveedor,
        int? idLocal, int? idUnidadNegocio, int? idEstado, string? texto,
        bool soloVencidos = false, bool soloPendientes = false, bool incluirAnulados = false)
    {
        var gastos = await _service.Listar(ArmarFiltro(
            fechaDesde, fechaHasta, idCategoria, idProveedor, idLocal, idUnidadNegocio,
            idEstado, texto, soloVencidos, soloPendientes, incluirAnulados));

        var hoy = DateTime.Today;
        return Ok(gastos.Select(g => new
        {
            g.Id,
            g.Fecha,
            g.FechaVencimiento,
            g.IdCategoria,
            Categoria = g.IdCategoriaNavigation?.Nombre,
            CategoriaColor = g.IdCategoriaNavigation?.Color,
            CategoriaIcono = g.IdCategoriaNavigation?.Icono,
            g.IdProveedor,
            Proveedor = g.IdProveedorNavigation?.Nombre,
            g.IdLocal,
            Local = g.IdLocalNavigation?.Nombre,
            g.IdUnidadNegocio,
            UnidadNegocio = g.IdUnidadNegocioNavigation?.Nombre,
            g.Concepto,
            g.Detalle,
            g.ComprobanteTipo,
            g.ComprobanteNumero,
            g.Importe,
            g.ImportePagado,
            Pendiente = g.Importe - g.ImportePagado,
            g.IdEstado,
            Estado = GastoEstado.Etiqueta(g.IdEstado),
            g.ImpactaCuentaCorriente,
            Vencido = g.FechaVencimiento != null
                      && g.FechaVencimiento < hoy
                      && (g.IdEstado == GastoEstado.Pendiente || g.IdEstado == GastoEstado.Parcial),
            DiasParaVencer = g.FechaVencimiento != null
                ? (int?)(g.FechaVencimiento.Value.Date - hoy).TotalDays
                : null,
            g.Anulado,
            g.NotaInterna,
            g.FechaRegistra
        }));
    }

    [HttpGet]
    public async Task<IActionResult> Resumen(
        DateTime? fechaDesde, DateTime? fechaHasta, int? idCategoria, int? idProveedor,
        int? idLocal, int? idUnidadNegocio, int? idEstado, string? texto,
        bool soloVencidos = false, bool soloPendientes = false, bool incluirAnulados = false)
    {
        var filtro = ArmarFiltro(
            fechaDesde, fechaHasta, idCategoria, idProveedor, idLocal, idUnidadNegocio,
            idEstado, texto, soloVencidos, soloPendientes, incluirAnulados);

        var resumen = await _service.Resumen(filtro);
        return Ok(new
        {
            resumen.Total,
            resumen.Pagado,
            resumen.Pendiente,
            resumen.Vencido,
            resumen.Cantidad,
            resumen.CantidadPendientes,
            resumen.CantidadVencidos,
            PorCategoria = await _service.PorCategoria(filtro)
        });
    }

    [HttpGet]
    public async Task<IActionResult> Obtener(int id)
    {
        var g = await _service.Obtener(id);
        if (g == null) return NotFound();

        return Ok(new
        {
            g.Id,
            g.IdUnidadNegocio,
            g.IdLocal,
            g.IdCategoria,
            Categoria = g.IdCategoriaNavigation?.Nombre,
            g.IdProveedor,
            Proveedor = g.IdProveedorNavigation?.Nombre,
            g.Fecha,
            g.FechaVencimiento,
            g.Concepto,
            g.Detalle,
            g.ComprobanteTipo,
            g.ComprobanteNumero,
            g.Importe,
            g.ImportePagado,
            Pendiente = g.Importe - g.ImportePagado,
            g.IdEstado,
            Estado = GastoEstado.Etiqueta(g.IdEstado),
            g.ImpactaCuentaCorriente,
            g.Anulado,
            g.MotivoAnula,
            g.NotaInterna,
            g.FechaRegistra,
            g.FechaModifica,
            UsuarioRegistra = UsuarioNombre.Mostrar(g.IdUsuarioRegistraNavigation)
        });
    }

    [HttpGet]
    public async Task<IActionResult> ProximosVencimientos(int dias = 30, int top = 15)
    {
        var gastos = await _service.ProximosVencimientos(dias, top);
        var hoy = DateTime.Today;

        return Ok(gastos.Select(g => new
        {
            g.Id,
            g.Concepto,
            g.FechaVencimiento,
            Categoria = g.IdCategoriaNavigation?.Nombre,
            CategoriaColor = g.IdCategoriaNavigation?.Color,
            Proveedor = g.IdProveedorNavigation?.Nombre,
            Pendiente = g.Importe - g.ImportePagado,
            DiasParaVencer = (int)(g.FechaVencimiento!.Value.Date - hoy).TotalDays,
            Vencido = g.FechaVencimiento!.Value.Date < hoy
        }));
    }

    // ═══════════════════════════════════ Escritura ═══════════════════════════════

    [HttpPost]
    public async Task<IActionResult> Guardar([FromBody] GastoGuardar model)
    {
        var result = await _service.Guardar(model, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo, id = result.IdReferencia });
    }

    [HttpPost]
    public async Task<IActionResult> Anular(int id, string? motivo)
    {
        var result = await _service.Anular(id, motivo, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo });
    }

    [HttpDelete]
    public async Task<IActionResult> Eliminar(int id)
    {
        var result = await _service.Eliminar(id);
        return Ok(result.ToEliminarJson());
    }

    // ═════════════════════════════════════ Pagos ═════════════════════════════════

    [HttpGet]
    public async Task<IActionResult> Pagos(int idGasto)
    {
        var pagos = await _service.ListarPagos(idGasto);
        return Ok(pagos.Select(p => new
        {
            p.Id,
            p.IdGasto,
            p.Fecha,
            p.Importe,
            p.IdCuenta,
            Cuenta = p.IdCuentaNavigation?.Nombre,
            p.IdMedioPago,
            MedioPago = p.IdMedioPagoNavigation?.Nombre,
            p.IdCaja,
            p.NotaInterna,
            p.Anulado,
            p.FechaRegistra,
            UsuarioRegistra = UsuarioNombre.Mostrar(p.IdUsuarioRegistraNavigation)
        }));
    }

    [HttpPost]
    public async Task<IActionResult> RegistrarPago([FromBody] GastosPago model)
    {
        var result = await _service.RegistrarPago(model, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo, id = result.IdReferencia });
    }

    [HttpPost]
    public async Task<IActionResult> AnularPago(int id, string? motivo)
    {
        var result = await _service.AnularPago(id, motivo, User.GetUserId() ?? 1);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo });
    }

    private static GastoFiltro ArmarFiltro(
        DateTime? fechaDesde, DateTime? fechaHasta, int? idCategoria, int? idProveedor,
        int? idLocal, int? idUnidadNegocio, int? idEstado, string? texto,
        bool soloVencidos, bool soloPendientes, bool incluirAnulados)
        => new()
        {
            FechaDesde = fechaDesde,
            FechaHasta = fechaHasta,
            IdCategoria = idCategoria,
            IdProveedor = idProveedor,
            IdLocal = idLocal,
            IdUnidadNegocio = idUnidadNegocio,
            IdEstado = idEstado,
            Texto = texto,
            SoloVencidos = soloVencidos,
            SoloPendientes = soloPendientes,
            IncluirAnulados = incluirAnulados
        };
}
