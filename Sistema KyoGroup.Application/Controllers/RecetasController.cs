using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Diagnostics;
using System.Text.Json.Serialization;
using System.Text.Json;
using SistemaKyoGroup.Application.Extensions;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class RecetasController : Controller
    {
        private readonly IRecetaService _RecetasService;

        public RecetasController(IRecetaService RecetasService)
        {
            _RecetasService = RecetasService;
        }

        [AllowAnonymous]
        public IActionResult Index()
        {
            return View();
        }

        [HttpGet]
        public async Task<IActionResult> Lista(int IdUnidadNegocio)
        {
            try
            {

                var userId = User.GetUserId();

                var Recetas = await _RecetasService.ObtenerTodosUnidadNegocio(IdUnidadNegocio, (int)userId);

                var lista = Recetas
                    .Select(c => new VMReceta
                    {
                        Id = c.Id,
                        FechaActualizacion = c.FechaActualizacion,
                        IdCategoria = c.IdCategoria,
                        IdUnidadMedida = c.IdUnidadMedida,
                        IdUnidadNegocio = c.IdUnidadNegocio,
                        Sku = c.Sku,
                        Categoria = c.IdCategoriaNavigation.Nombre,
                        UnidadMedida = c.IdUnidadMedidaNavigation.Nombre,
                        UnidadNegocio = c.IdUnidadNegocioNavigation.Nombre,
                        Descripcion = c.Descripcion,
                        CostoSubRecetas = c.CostoSubRecetas,
                        CostoInsumos = c.CostoInsumos,
                        CostoPorcion = c.CostoPorcion,
                        Rendimiento = c.Rendimiento,
                        CostoUnitario = c.CostoUnitario
                    })
                    .ToList();

                return Ok(lista);
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Error al obtener las Recetas." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMReceta model)
        {

            var userId = User.GetUserId();

            var Receta = new Receta
            {
                IdUnidadNegocio = model.IdUnidadNegocio,
                Sku = model.Sku,
                Descripcion = model.Descripcion,
                IdUnidadMedida = model.IdUnidadMedida,
                IdCategoria = model.IdCategoria,
                CostoSubRecetas = model.CostoSubRecetas,
                CostoInsumos = model.CostoInsumos,
                CostoPorcion = (decimal)model.CostoPorcion,
                CostoUnitario = model.CostoUnitario,
                Rendimiento = model.Rendimiento,
                FechaActualizacion = DateTime.Now,
                IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                FechaRegistra = DateTime.Now,

                RecetasInsumos = model.RecetasInsumos?.Select(i => new RecetasInsumo
                {
                    IdInsumo = i.IdInsumo,
                    Cantidad = i.Cantidad,
                    CostoUnitario = i.CostoUnitario,
                    SubTotal = i.SubTotal,
                    IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                    FechaRegistra = DateTime.Now,
                }).ToList(),

                RecetasSubReceta = model.RecetasSubReceta?.Select(s => new RecetasSubReceta
                {
                    IdSubReceta = s.IdSubReceta,
                    Cantidad = s.Cantidad,
                    CostoUnitario = s.CostoUnitario,
                    SubTotal = s.SubTotal,
                    IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                    FechaRegistra = DateTime.Now,
                }).ToList()
            };

            var resultado = await _RecetasService.Insertar(Receta);
            return Ok(new { valor = resultado });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMReceta model)
        {

            var userId = User.GetUserId();

            var Receta = new Receta
            {
                Id = model.Id,
                IdUnidadNegocio = model.IdUnidadNegocio,
                Sku = model.Sku,
                Descripcion = model.Descripcion,
                IdUnidadMedida = model.IdUnidadMedida,
                IdCategoria = model.IdCategoria,
                CostoSubRecetas = model.CostoSubRecetas,
                CostoInsumos = model.CostoInsumos,
                CostoPorcion = (decimal)model.CostoPorcion,
                CostoUnitario = model.CostoUnitario,
                Rendimiento = model.Rendimiento,
                FechaActualizacion = DateTime.Now,
                IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                FechaModifica = DateTime.Now,

                RecetasInsumos = model.RecetasInsumos?.Select(i => new RecetasInsumo
                {
                    IdInsumo = i.IdInsumo,
                    Cantidad = i.Cantidad,
                    CostoUnitario = i.CostoUnitario,
                    SubTotal = i.SubTotal,
                    IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                    FechaModifica = DateTime.Now,
                }).ToList(),

                RecetasSubReceta = model.RecetasSubReceta?.Select(s => new RecetasSubReceta
                {
                    IdReceta = model.Id,
                    IdSubReceta = s.IdSubReceta,
                    Cantidad = s.Cantidad,
                    CostoUnitario = s.CostoUnitario,
                    SubTotal = s.SubTotal,
                    IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                    FechaModifica = DateTime.Now,
                }).ToList()
            };

            var resultado = await _RecetasService.Actualizar(Receta);
            return Ok(new { valor = resultado });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _RecetasService.Eliminar(id);
            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            if (id <= 0)
                return Ok(new { });

            var model = await _RecetasService.Obtener(id);

            var Receta = new VMReceta
            {
                Id = model.Id,
                IdUnidadMedida = model.IdUnidadMedida,
                Sku = model.Sku,
                IdUnidadNegocio = model.IdUnidadNegocio,
                FechaActualizacion = model.FechaActualizacion,
                IdCategoria = model.IdCategoria,
                Descripcion = model.Descripcion,
                CostoUnitario = model.CostoUnitario,
                CostoInsumos = model.CostoInsumos,
                CostoSubRecetas = model.CostoSubRecetas,
                Rendimiento = model.Rendimiento,
            };

            var insumos = model.RecetasInsumos.Select(p => new VMRecetasInsumo
            {
                Id = p.Id,
                IdReceta = p.IdReceta,
                IdInsumo = p.IdInsumo,
                Nombre = p.IdInsumoNavigation.Descripcion,
                Cantidad = p.Cantidad,
                CostoUnitario = p.CostoUnitario,
                SubTotal = p.SubTotal
            }).ToList();

            var subRecetas = model.RecetasSubReceta.Select(p => new VMRecetasSubReceta
            {
                Id = p.Id,
                IdReceta = p.IdReceta,
                IdSubReceta = p.IdSubReceta,
                Cantidad = p.Cantidad,
                CostoUnitario = p.CostoUnitario,
                SubTotal = p.SubTotal,
                Nombre = p.IdSubRecetaNavigation?.Descripcion,
                IdSubRecetaNavigation = p.IdSubRecetaNavigation
            }).ToList();

            var result = new Dictionary<string, object>
            {
                ["Receta"] = Receta,
                ["Insumos"] = insumos,
                ["SubRecetas"] = subRecetas
            };

            var jsonOptions = new JsonSerializerOptions
            {
                ReferenceHandler = ReferenceHandler.Preserve
            };

            return Ok(System.Text.Json.JsonSerializer.Serialize(result, jsonOptions));
        }

        [AllowAnonymous]
        public async Task<IActionResult> NuevoModif(int? id)
        {
            if (id != null)
            {
                ViewBag.data = id;
            }
            return View();
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
