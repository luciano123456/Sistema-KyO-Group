using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Linq;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class CuentasController : Controller
{
    private readonly ICuentasService _service;

    public CuentasController(ICuentasService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Lista()
    {
        var cuentas = await _service.ObtenerTodos();
        var lista = cuentas.Select(c => new { c.Id, c.Nombre }).ToList();
        return Ok(lista);
    }

    [HttpPost]
    public async Task<IActionResult> Insertar([FromBody] VMGenericModel model)
    {
        var entity = new Cuenta { Nombre = model.Nombre ?? "" };
        bool ok = await _service.Insertar(entity);
        return Ok(new { valor = ok, id = entity.Id });
    }

    [HttpPut]
    public async Task<IActionResult> Actualizar([FromBody] VMGenericModel model)
    {
        var entity = await _service.Obtener(model.Id);
        if (entity == null) return Ok(new { valor = false });
        entity.Nombre = model.Nombre ?? "";
        bool ok = await _service.Actualizar(entity);
        return Ok(new { valor = ok });
    }

    [HttpDelete]
    public async Task<IActionResult> Eliminar(int id, bool cascade = false)
    {
        var sr = await DeleteOperationHelper.ExecuteDeleteAsync(
            c => _service.Eliminar(id, c),
            "la cuenta",
            cascade,
            id);
        return Ok(sr.ToEliminarJson());
    }

    [HttpGet]
    public async Task<IActionResult> EditarInfo(int id)
    {
        var entity = await _service.Obtener(id);
        if (entity == null) return NotFound();
        return Ok(new { entity.Id, entity.Nombre });
    }
}

public class VMGenericModel
{
    public int Id { get; set; }
    public string? Nombre { get; set; }
}
