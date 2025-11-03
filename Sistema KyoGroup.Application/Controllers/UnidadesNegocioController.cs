using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Diagnostics;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class UnidadesNegocioController : Controller
    {
        private readonly IUnidadesNegocioService _UnidadesNegocioService;

        public UnidadesNegocioController(IUnidadesNegocioService UnidadesNegocioService)
        {
            _UnidadesNegocioService = UnidadesNegocioService;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> ListaUsuario()
        {
            var userId = User.GetUserId();

            var UnidadesNegocio = await _UnidadesNegocioService.ObtenerTodosUsuario((int)userId);

            var lista = UnidadesNegocio.Select(c => new VMGenerico
            {
                Id = c.Id,
                Nombre = c.Nombre,
            }).ToList();

            return Ok(lista);
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var UnidadesNegocio = await _UnidadesNegocioService.ObtenerTodos();

            var lista = UnidadesNegocio.Select(c => new VMGenerico
            {
                Id = c.Id,
                Nombre = c.Nombre,
            }).ToList();

            return Ok(lista);
        }


        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMGenerico model)
        {
            var Rol = new UnidadesNegocio
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _UnidadesNegocioService.Insertar(Rol);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMGenerico model)
        {
            var Rol = new UnidadesNegocio
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _UnidadesNegocioService.Actualizar(Rol);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _UnidadesNegocioService.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
             var Rol = await _UnidadesNegocioService.Obtener(id);

            if (Rol != null)
            {
                return StatusCode(StatusCodes.Status200OK, Rol);
            }
            else
            {
                return StatusCode(StatusCodes.Status404NotFound);
            }
        }
        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel
            {
                RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier
            });
        }

    }
}