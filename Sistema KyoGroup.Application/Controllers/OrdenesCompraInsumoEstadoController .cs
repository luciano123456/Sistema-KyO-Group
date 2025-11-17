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
    public class OrdenesComprasInsumosEstadoController : Controller
    {
        private readonly IOrdenesComprasInsumosEstadoservice _OrdenesComprasInsumosEstadoservice;

        public OrdenesComprasInsumosEstadoController(IOrdenesComprasInsumosEstadoservice OrdenesComprasInsumosEstadoservice)
        {
            _OrdenesComprasInsumosEstadoservice = OrdenesComprasInsumosEstadoservice;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var OrdenesComprasInsumosEstado = await _OrdenesComprasInsumosEstadoservice.ObtenerTodos();

            var lista = OrdenesComprasInsumosEstado.Select(c => new VMOrdenesComprasInsumosEstado
            {
                Id = c.Id,
                Nombre = c.Nombre,
            }).ToList();

            return Ok(lista);
        }


        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMOrdenesComprasInsumosEstado model)
        {
            var OrdenesComprasInsumosEstado = new OrdenesComprasInsumosEstado
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _OrdenesComprasInsumosEstadoservice.Insertar(OrdenesComprasInsumosEstado);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMOrdenesComprasInsumosEstado model)
        {
            var OrdenesComprasInsumosEstado = new OrdenesComprasInsumosEstado
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _OrdenesComprasInsumosEstadoservice.Actualizar(OrdenesComprasInsumosEstado);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _OrdenesComprasInsumosEstadoservice.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var EstadosUsuario = await _OrdenesComprasInsumosEstadoservice.Obtener(id);

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