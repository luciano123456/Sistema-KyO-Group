using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class RubrosController : Controller
{
    private readonly IRubrosService _service;

    public RubrosController(IRubrosService service)
    {
        _service = service;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> Lista()
    {
        var items = await _service.Listar();
        return Ok(items.Select(c => new VMRubro { Id = c.Id, Nombre = c.Nombre }).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Insertar([FromBody] VMRubro model)
    {
        if (string.IsNullOrWhiteSpace(model?.Nombre))
            return Ok(new { valor = false, mensaje = "El nombre es obligatorio." });

        var todos = await _service.Listar();
        var dup = todos.FirstOrDefault(x =>
            string.Equals(x.Nombre?.Trim(), model.Nombre.Trim(), StringComparison.OrdinalIgnoreCase));
        if (dup != null)
        {
            return Ok(new
            {
                valor = false,
                tipo = "duplicado",
                idReferencia = dup.Id,
                mensaje = $"Ya existe un rubro con el nombre '{dup.Nombre}'."
            });
        }

        var ok = await _service.Insertar(new Rubro { Nombre = model.Nombre.Trim() });
        return Ok(new { valor = ok });
    }

    [HttpPut]
    public async Task<IActionResult> Actualizar([FromBody] VMRubro model)
    {
        if (model == null || model.Id <= 0 || string.IsNullOrWhiteSpace(model.Nombre))
            return Ok(new { valor = false, mensaje = "Datos inválidos." });

        var todos = await _service.Listar();
        var dup = todos.FirstOrDefault(x =>
            x.Id != model.Id &&
            string.Equals(x.Nombre?.Trim(), model.Nombre.Trim(), StringComparison.OrdinalIgnoreCase));
        if (dup != null)
        {
            return Ok(new
            {
                valor = false,
                tipo = "duplicado",
                idReferencia = dup.Id,
                mensaje = $"Ya existe otro rubro con el nombre '{dup.Nombre}'."
            });
        }

        var ok = await _service.Actualizar(new Rubro { Id = model.Id, Nombre = model.Nombre.Trim() });
        return Ok(new { valor = ok });
    }

    [HttpDelete]
    public async Task<IActionResult> Eliminar(int id, bool cascade = false)
    {
        var sr = await DeleteOperationHelper.ExecuteAsync(
            () => _service.Eliminar(id),
            "el rubro",
            "Rubro eliminado correctamente.",
            id);
        return Ok(sr.ToEliminarJson());
    }

    [HttpGet]
    public async Task<IActionResult> EditarInfo(int id)
    {
        var item = await _service.Obtener(id);
        if (item == null) return NotFound();
        return Ok(new VMRubro { Id = item.Id, Nombre = item.Nombre });
    }
}
