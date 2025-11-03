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
    public class RecetasCategoriaController : Controller
    {
        private readonly IRecetasCategoriaService _RecetasCategoriaService;

        public RecetasCategoriaController(IRecetasCategoriaService RecetasCategoriaService)
        {
            _RecetasCategoriaService = RecetasCategoriaService;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var RecetasCategoria = await _RecetasCategoriaService.ObtenerTodos();

            var lista = RecetasCategoria.Select(c => new VMRecetasCategoria
            {
                Id = c.Id,
                Nombre = c.Nombre,
            }).ToList();

            return Ok(lista);
        }


        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMRecetasCategoria model)
        {
            var RecetasCategoria = new RecetasCategoria
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _RecetasCategoriaService.Insertar(RecetasCategoria);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMRecetasCategoria model)
        {
            var RecetasCategoria = new RecetasCategoria
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _RecetasCategoriaService.Actualizar(RecetasCategoria);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _RecetasCategoriaService.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var EstadosUsuario = await _RecetasCategoriaService.Obtener(id);

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
            return View(new ErrorViewModel
            {
                RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier
            });
        }

    }
}