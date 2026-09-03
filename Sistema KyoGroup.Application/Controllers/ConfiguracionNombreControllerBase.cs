using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.BLL.Service;

namespace SistemaKyoGroup.Application.Controllers
{
    public abstract class ConfiguracionNombreControllerBase<T> : Controller where T : class
    {
        protected abstract IConfiguracionNombreService<T> Service { get; }

        [HttpGet]
        public virtual async Task<IActionResult> Lista()
            => Ok(await Service.Listar());

        [HttpPost]
        public virtual async Task<IActionResult> Insertar([FromBody] T model)
        {
            var dup = await Service.BuscarDuplicado(model, 0);
            if (dup != null)
            {
                return Ok(new
                {
                    valor = false,
                    tipo = "duplicado",
                    idReferencia = Service.GetId(dup),
                    mensaje = $"Ya existe un registro con el nombre '{Service.GetNombre(dup)}'."
                });
            }

            var ok = await Service.Insertar(model);
            return Ok(new { valor = ok });
        }

        [HttpPut]
        public virtual async Task<IActionResult> Actualizar([FromBody] T model)
        {
            var dup = await Service.BuscarDuplicado(model, Service.GetId(model));
            if (dup != null)
            {
                return Ok(new
                {
                    valor = false,
                    tipo = "duplicado",
                    idReferencia = Service.GetId(dup),
                    mensaje = $"Ya existe otro registro con el nombre '{Service.GetNombre(dup)}'."
                });
            }

            var ok = await Service.Actualizar(model);
            return Ok(new { valor = ok });
        }

        [HttpDelete]
        public virtual async Task<IActionResult> Eliminar(int id, bool cascade = false)
        {
            // Los catálogos no implementan cascada segura: se informa la relación FK.
            var result = await DeleteOperationHelper.ExecuteAsync(
                () => Service.Eliminar(id),
                "el registro",
                "Registro eliminado correctamente.",
                id);
            return Ok(result.ToEliminarJson());
        }
    }
}
