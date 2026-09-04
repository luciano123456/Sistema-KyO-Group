using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class MediosPagoController : ConfiguracionNombreControllerBase<MediosPago>
{
    private readonly IMediosPagoService _service;

    public MediosPagoController(IMediosPagoService service)
    {
        _service = service;
    }

    protected override IConfiguracionNombreService<MediosPago> Service => _service;

    [AllowAnonymous]
    [HttpGet]
    public override async Task<IActionResult> Lista()
    {
        var items = await _service.Listar(false);
        return Ok(items.Select(m => new
        {
            m.Id,
            m.Nombre,
            m.IdCuentaDefecto,
            CuentaDefecto = m.IdCuentaDefectoNavigation?.Nombre,
            m.AfectaCaja,
            m.Activo,
            m.Orden
        }));
    }

    [HttpGet]
    public async Task<IActionResult> Activos()
    {
        var items = await _service.Listar(true);
        return Ok(items.Select(m => new { m.Id, m.Nombre, m.IdCuentaDefecto, m.AfectaCaja }));
    }

    [HttpPost]
    public async Task<IActionResult> Guardar([FromBody] MediosPago model)
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
                mensaje = $"Ya existe un medio de pago con el nombre '{duplicado.Nombre}'."
            });
        }

        var ok = model.Id > 0
            ? await _service.Actualizar(model)
            : await _service.Insertar(model);

        return Ok(new
        {
            valor = ok,
            mensaje = ok
                ? (model.Id > 0 ? "Medio de pago actualizado." : "Medio de pago creado.")
                : "No se pudo guardar el medio de pago.",
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
