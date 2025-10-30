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
    public class UnidadesMedidaController : Controller
    {
        private readonly IUnidadesMedidaService _UnidadesMedidaService;

        public UnidadesMedidaController(IUnidadesMedidaService UnidadesMedidaService)
        {
            _UnidadesMedidaService = UnidadesMedidaService;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var UnidadesMedida = await _UnidadesMedidaService.ObtenerTodos();

            var lista = UnidadesMedida.Select(c => new VMUnidadesMedida
            {
                Id = c.Id,
                Nombre = c.Nombre,
            }).ToList();

            return Ok(lista);
        }


        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMUnidadesMedida model)
        {
            var UnidadesMedida = new UnidadesMedida
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _UnidadesMedidaService.Insertar(UnidadesMedida);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMUnidadesMedida model)
        {
            var UnidadesMedida = new UnidadesMedida
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _UnidadesMedidaService.Actualizar(UnidadesMedida);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _UnidadesMedidaService.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
             var EstadosUsuario = await _UnidadesMedidaService.Obtener(id);

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