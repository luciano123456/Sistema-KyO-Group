using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class CuentasTiposController : ConfiguracionNombreControllerBase<CuentasTipo>
{
    private readonly ICuentasTiposService _service;

    public CuentasTiposController(ICuentasTiposService service)
    {
        _service = service;
    }

    protected override IConfiguracionNombreService<CuentasTipo> Service => _service;

    [AllowAnonymous]
    [HttpGet]
    public override async Task<IActionResult> Lista()
    {
        var items = await _service.Listar();
        return Ok(items.Select(t => new { t.Id, t.Nombre, t.EsEfectivo }));
    }

    [HttpPost]
    public async Task<IActionResult> Guardar([FromBody] CuentasTipo model)
    {
        if (string.IsNullOrWhiteSpace(model?.Nombre))
            return Ok(new { valor = false, mensaje = "El nombre es obligatorio.", tipo = "validacion" });

        var duplicado = await _service.BuscarDuplicado(model, model.Id);
        if (duplicado != null)
        {
            return Ok(new
            {
                valor = false,
                tipo = "duplicado",
                idReferencia = duplicado.Id,
                mensaje = $"Ya existe un tipo de cuenta con el nombre '{duplicado.Nombre}'."
            });
        }

        var ok = model.Id > 0
            ? await _service.Actualizar(model)
            : await _service.Insertar(model);

        return Ok(new
        {
            valor = ok,
            mensaje = ok
                ? (model.Id > 0 ? "Tipo de cuenta actualizado." : "Tipo de cuenta creado.")
                : "No se pudo guardar el tipo de cuenta.",
            tipo = ok ? "success" : "error",
            id = model.Id
        });
    }

    [HttpDelete]
    public override async Task<IActionResult> Eliminar(int id, bool cascade = false)
    {
        var result = await _service.EliminarConDependencias(id);
        return Ok(BLL.Common.ServiceResult.FromDelete(result).ToEliminarJson());
    }
}
