using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Controllers;

/// <summary>
/// Categorías de gasto. Hereda el ABM genérico (Id + Nombre) para el modal de
/// configuraciones y agrega los endpoints con jerarquía, color e icono.
/// </summary>
[Authorize]
public class GastosCategoriasController : ConfiguracionNombreControllerBase<GastosCategoria>
{
    private readonly IGastosCategoriasService _service;

    public GastosCategoriasController(IGastosCategoriasService service)
    {
        _service = service;
    }

    protected override IConfiguracionNombreService<GastosCategoria> Service => _service;

    [AllowAnonymous]
    [HttpGet]
    public override async Task<IActionResult> Lista()
    {
        var items = await _service.Listar(false);
        return Ok(items.Select(c => new
        {
            c.Id,
            c.Nombre,
            c.IdPadre,
            Padre = c.IdPadreNavigation?.Nombre,
            // Etiqueta lista para combos: "Servicios › Luz".
            NombreCompleto = c.IdPadreNavigation != null ? $"{c.IdPadreNavigation.Nombre} › {c.Nombre}" : c.Nombre,
            c.Color,
            c.Icono,
            c.Activa,
            c.Orden
        }));
    }

    [HttpGet]
    public async Task<IActionResult> Activas()
    {
        var items = await _service.Listar(true);
        return Ok(items.Select(c => new
        {
            c.Id,
            Nombre = c.IdPadreNavigation != null ? $"{c.IdPadreNavigation.Nombre} › {c.Nombre}" : c.Nombre,
            c.IdPadre,
            c.Color,
            c.Icono
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Guardar([FromBody] GastosCategoria model)
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
                mensaje = $"Ya existe una categoría con el nombre '{duplicado.Nombre}'."
            });
        }

        var ok = model.Id > 0
            ? await _service.Actualizar(model)
            : await _service.Insertar(model);

        return Ok(new
        {
            valor = ok,
            mensaje = ok
                ? (model.Id > 0 ? "Categoría actualizada." : "Categoría creada.")
                : "No se pudo guardar la categoría.",
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
