using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Diagnostics;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class RolesController : Controller
    {
        private readonly IRolesService _RolesService;

        public RolesController(IRolesService RolesService)
        {
            _RolesService = RolesService;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var Roles = await _RolesService.ObtenerTodos();

            var lista = Roles.Select(c => new VMRoles
            {
                Id = c.Id,
                Nombre = c.Nombre,
            }).ToList();

            return Ok(lista);
        }


        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMRoles model)
        {
            var Rol = new Rol
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _RolesService.Insertar(Rol);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMRoles model)
        {
            var Rol = new Rol
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _RolesService.Actualizar(Rol);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _RolesService.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
             var Rol = await _RolesService.Obtener(id);

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