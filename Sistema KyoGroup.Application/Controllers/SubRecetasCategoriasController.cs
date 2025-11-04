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
    public class SubRecetasCategoriaController : Controller
    {
        private readonly ISubRecetasCategoriaService _SubRecetasCategoriaService;

        public SubRecetasCategoriaController(ISubRecetasCategoriaService SubRecetasCategoriaService)
        {
            _SubRecetasCategoriaService = SubRecetasCategoriaService;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var SubRecetasCategoria = await _SubRecetasCategoriaService.ObtenerTodos();

            var lista = SubRecetasCategoria.Select(c => new VMSubRecetasCategoria
            {
                Id = c.Id,
                Nombre = c.Nombre,
            }).ToList();

            return Ok(lista);
        }


        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMSubRecetasCategoria model)
        {
            var SubRecetasCategoria = new SubRecetasCategoria
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _SubRecetasCategoriaService.Insertar(SubRecetasCategoria);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMSubRecetasCategoria model)
        {
            var SubRecetasCategoria = new SubRecetasCategoria
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _SubRecetasCategoriaService.Actualizar(SubRecetasCategoria);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _SubRecetasCategoriaService.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var EstadosUsuario = await _SubRecetasCategoriaService.Obtener(id);

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