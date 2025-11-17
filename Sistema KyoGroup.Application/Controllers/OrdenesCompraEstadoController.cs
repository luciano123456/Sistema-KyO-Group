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
    public class OrdenesComprasEstadoController : Controller
    {
        private readonly IOrdenesComprasEstadoservice _OrdenesComprasEstadoservice;

        public OrdenesComprasEstadoController(IOrdenesComprasEstadoservice OrdenesComprasEstadoservice)
        {
            _OrdenesComprasEstadoservice = OrdenesComprasEstadoservice;
        }


        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var OrdenesComprasEstado = await _OrdenesComprasEstadoservice.ObtenerTodos();

            var lista = OrdenesComprasEstado.Select(c => new VMOrdenesComprasEstado
            {
                Id = c.Id,
                Nombre = c.Nombre,
            }).ToList();

            return Ok(lista);
        }


        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMOrdenesComprasEstado model)
        {
            var OrdenesComprasEstado = new OrdenesComprasEstado
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _OrdenesComprasEstadoservice.Insertar(OrdenesComprasEstado);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMOrdenesComprasEstado model)
        {
            var OrdenesComprasEstado = new OrdenesComprasEstado
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _OrdenesComprasEstadoservice.Actualizar(OrdenesComprasEstado);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _OrdenesComprasEstadoservice.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var EstadosUsuario = await _OrdenesComprasEstadoservice.Obtener(id);

            if (EstadosUsuario != null)
            {
                return StatusCode(StatusCodes.Status200OK, EstadosUsuario);
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
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}