using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class FinanzasController : Controller
{
    private readonly ITesoreriaService _service;

    public FinanzasController(ITesoreriaService service)
    {
        _service = service;
    }

    [AllowAnonymous]
    public IActionResult Index() => View();

    [HttpPost]
    public async Task<IActionResult> ControlMensual([FromBody] FinanzasControlFiltro? filtro)
        => Ok(await _service.ControlMensual(filtro ?? new FinanzasControlFiltro()));
}
