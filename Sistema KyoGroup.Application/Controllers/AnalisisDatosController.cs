using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.BLL.Service;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class AnalisisDatosController : Controller
{
    private readonly IAnalisisDatosService _service;

    public AnalisisDatosController(IAnalisisDatosService service)
    {
        _service = service;
    }

    [AllowAnonymous]
    public IActionResult Index() => View();

    [HttpGet]
    public async Task<IActionResult> Compras(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
        => Ok(await _service.ObtenerCompras(fechaDesde, fechaHasta, idUnidadNegocio));

    [HttpGet]
    public async Task<IActionResult> Costos(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
        => Ok(await _service.ObtenerCostos(fechaDesde, fechaHasta, idUnidadNegocio));

    [HttpGet]
    public async Task<IActionResult> Insumos(DateTime? fechaDesde, DateTime? fechaHasta)
        => Ok(await _service.ObtenerInsumos(fechaDesde, fechaHasta));

    [HttpGet]
    public async Task<IActionResult> Recetas(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
        => Ok(await _service.ObtenerRecetas(fechaDesde, fechaHasta, idUnidadNegocio));

    [HttpGet]
    public async Task<IActionResult> CuentaCorriente(DateTime? fechaDesde, DateTime? fechaHasta)
        => Ok(await _service.ObtenerCuentaCorriente(fechaDesde, fechaHasta));
}
