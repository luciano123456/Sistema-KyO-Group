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
    public class LocalesController : Controller
    {
        private readonly ILocalesService _LocalesService;

        public LocalesController(ILocalesService LocalesService)
        {
            _LocalesService = LocalesService;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            try
            {
                var Locales = await _LocalesService.ObtenerTodos();

                var lista = Locales.Select(c => new VMGenericModelConfCombo
                {
                    Id = c.Id,
                    IdCombo = c.IdUnidadNegocio != null ? (int)c.IdUnidadNegocio : 0,
                    NombreCombo = c.IdUnidadNegocioNavigation != null ? c.IdUnidadNegocioNavigation.Nombre : null,
                    Nombre = c.Nombre,

                }).ToList();

                return Ok(lista);
            } catch (Exception ex)
            {
                return null;
            }
        }

        [HttpGet]
        public async Task<IActionResult> ListaPorUnidad(int idUnidadNegocio)
        {
            try
            {
                var Locales = await _LocalesService.ObtenerPorUnidad(idUnidadNegocio);

                var lista = Locales.Select(c => new VMGenericModelConfCombo
                {
                    Id = c.Id,
                    IdCombo = c.IdUnidadNegocio != null ? (int)c.IdUnidadNegocio : 0,
                    NombreCombo = c.IdUnidadNegocioNavigation != null ? c.IdUnidadNegocioNavigation.Nombre : null,
                    Nombre = c.Nombre,

                }).ToList();

                return Ok(lista);
            }
            catch (Exception ex)
            {
                return null;
            }
        }


        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMGenericModelConfCombo model)
        {
            var Local = new Local
            {
                Id = model.Id,
                IdUnidadNegocio = model.IdCombo,
                Nombre = model.Nombre,
            };

            bool respuesta = await _LocalesService.Insertar(Local);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMGenericModelConfCombo model)
        {
            var Local = new Local
            {
                Id = model.Id,
                IdUnidadNegocio = model.IdCombo,
                Nombre = model.Nombre,
            };

            bool respuesta = await _LocalesService.Actualizar(Local);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _LocalesService.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
             var Local = await _LocalesService.Obtener(id);

            if (Local != null)
            {
                return StatusCode(StatusCodes.Status200OK, Local);
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