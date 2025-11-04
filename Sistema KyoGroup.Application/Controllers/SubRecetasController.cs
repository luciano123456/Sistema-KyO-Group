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
    public class SubRecetasController : Controller
    {
        private readonly ISubRecetaService _SubRecetasService;

        public SubRecetasController(ISubRecetaService SubRecetasService)
        {
            _SubRecetasService = SubRecetasService;
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

                var SubRecetas = await _SubRecetasService.ObtenerTodosUnidadNegocio(IdUnidadNegocio, (int)userId);

                var lista = SubRecetas
                    .Select(c => new VMSubReceta
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
            catch (Exception ex)
            {
                // Idealmente, loguear el error con un logger
                return StatusCode(500, new { error = "Error al obtener las SubRecetas." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMSubReceta model)
        {
            var userId = User.GetUserId();

            var SubReceta = new SubReceta
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

                SubRecetasInsumos = model.SubRecetasInsumos?.Select(i => new SubRecetasInsumo
                {
                    IdInsumo = i.IdInsumo,
                    Cantidad = i.Cantidad,
                    CostoUnitario = i.CostoUnitario,
                    SubTotal = i.SubTotal,
                    IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                    FechaRegistra = DateTime.Now,
                }).ToList(),

                SubRecetasSubRecetaIdSubRecetaHijaNavigations = model.SubRecetasSubRecetaIdSubRecetaPadreNavigations?.Select(s => new SubRecetasSubReceta
                {
                    IdSubRecetaHija = s.IdSubRecetaHija,
                    Cantidad = s.Cantidad,
                    CostoUnitario = s.CostoUnitario,
                    Subtotal = s.Subtotal,
                    IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                    FechaRegistra = DateTime.Now,
                }).ToList()
            };

            var resultado = await _SubRecetasService.Insertar(SubReceta);
            return Ok(new { valor = resultado });
        }



        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMSubReceta model)
        {

            var userId = User.GetUserId();

            var SubReceta = new SubReceta
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

                SubRecetasInsumos = model.SubRecetasInsumos?.Select(i => new SubRecetasInsumo
                {
                    IdInsumo = i.IdInsumo,
                    Cantidad = i.Cantidad,
                    CostoUnitario = i.CostoUnitario,
                    SubTotal = i.SubTotal,
                    IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                    FechaModifica = DateTime.Now,
                }).ToList(),

                SubRecetasSubRecetaIdSubRecetaPadreNavigations = model.SubRecetasSubRecetaIdSubRecetaPadreNavigations?.Select(s => new SubRecetasSubReceta
                {
                    IdSubRecetaPadre = model.Id,
                    IdSubRecetaHija = s.IdSubRecetaHija,
                    Cantidad = s.Cantidad,
                    CostoUnitario = s.CostoUnitario,
                    Subtotal = s.Subtotal,
                    IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                    FechaModifica = DateTime.Now,
                }).ToList()


            };

            var resultado = await _SubRecetasService.Actualizar(SubReceta);
            return Ok(new { valor = resultado });
        }




        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            var (eliminado, mensaje) = await _SubRecetasService.Eliminar(id);
            return Ok(new { valor = eliminado, mensaje });
        }


        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            if (id <= 0)
                return Ok(new { });

            var model = await _SubRecetasService.Obtener(id);

            var SubReceta = new VMSubReceta
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

            var insumos = model.SubRecetasInsumos.Select(p => new VMSubRecetasInsumo
            {
                Id = p.Id,
                IdSubReceta = p.IdSubReceta,
                IdInsumo = p.IdInsumo,
                Nombre = p.IdInsumoNavigation.Descripcion,
                Cantidad = p.Cantidad,
                CostoUnitario = p.CostoUnitario,
                SubTotal = p.SubTotal
            }).ToList();

            var SubRecetas = model.SubRecetasSubRecetaIdSubRecetaPadreNavigations.Select(p => new VMSubRecetasSubReceta
            {
                Id = p.Id,
                IdSubRecetaPadre = p.IdSubRecetaPadre,
                IdSubRecetaHija = p.IdSubRecetaHija,
                Cantidad = p.Cantidad,
                CostoUnitario = p.CostoUnitario,
                SubTotal = p.Subtotal,
                Nombre = p.IdSubRecetaHijaNavigation?.Descripcion,
                IdSubRecetaHijaNavigation = p.IdSubRecetaHijaNavigation,
                IdSubRecetaPadreNavigation = p.IdSubRecetaPadreNavigation
            }).ToList();


            var result = new Dictionary<string, object>
            {
                ["SubReceta"] = SubReceta,
                ["Insumos"] = insumos,
                ["SubRecetas"] = SubRecetas
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