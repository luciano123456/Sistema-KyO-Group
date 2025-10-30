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
    public class InsumosCategoriaController : Controller
    {
        private readonly IInsumosCategoriaService _InsumosCategoriaService;

        public InsumosCategoriaController(IInsumosCategoriaService InsumosCategoriaService)
        {
            _InsumosCategoriaService = InsumosCategoriaService;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var InsumosCategoria = await _InsumosCategoriaService.ObtenerTodos();

            var lista = InsumosCategoria.Select(c => new VMInsumosCategoria
            {
                Id = c.Id,
                Nombre = c.Nombre,
            }).ToList();

            return Ok(lista);
        }


        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMInsumosCategoria model)
        {
            var InsumosCategoria = new InsumosCategoria
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _InsumosCategoriaService.Insertar(InsumosCategoria);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMInsumosCategoria model)
        {
            var InsumosCategoria = new InsumosCategoria
            {
                Id = model.Id,
                Nombre = model.Nombre,
            };

            bool respuesta = await _InsumosCategoriaService.Actualizar(InsumosCategoria);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _InsumosCategoriaService.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
             var EstadosUsuario = await _InsumosCategoriaService.Obtener(id);

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