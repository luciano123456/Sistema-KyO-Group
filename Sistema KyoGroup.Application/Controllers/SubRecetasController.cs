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
    public class SubrecetasController : Controller
    {
        private readonly ISubrecetaService _SubrecetasService;

        public SubrecetasController(ISubrecetaService SubrecetasService)
        {
            _SubrecetasService = SubrecetasService;
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

                var Subrecetas = await _SubrecetasService.ObtenerTodosUnidadNegocio(IdUnidadNegocio, (int)userId);

                var lista = Subrecetas
                    .Select(c => new VMSubreceta
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
                        CostoSubrecetas = c.CostoSubrecetas,
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
                return StatusCode(500, new { error = "Error al obtener las Subrecetas." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMSubreceta model)
        {
            var userId = User.GetUserId();

            var Subreceta = new Subreceta
            {
                IdUnidadNegocio = model.IdUnidadNegocio,
                Sku = model.Sku,
                Descripcion = model.Descripcion,
                IdUnidadMedida = model.IdUnidadMedida,
                IdCategoria = model.IdCategoria,
                CostoSubrecetas = model.CostoSubrecetas,
                CostoInsumos = model.CostoInsumos,
                CostoPorcion = (decimal)model.CostoPorcion,
                CostoUnitario = model.CostoUnitario,
                Rendimiento = model.Rendimiento,
                FechaActualizacion = DateTime.Now,
                IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                FechaRegistra = DateTime.Now,

                SubrecetasInsumos = model.SubrecetasInsumos?.Select(i => new SubrecetasInsumo
                {
                    IdInsumo = i.IdInsumo,
                    Cantidad = i.Cantidad,
                    CostoUnitario = i.CostoUnitario,
                    SubTotal = i.SubTotal,
                    IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                    FechaRegistra = DateTime.Now,
                }).ToList(),

                SubrecetasSubrecetaIdSubrecetaHijaNavigations = model.SubrecetasSubrecetaIdSubrecetaPadreNavigations?.Select(s => new SubrecetasSubreceta
                {
                    IdSubrecetaHija = s.IdSubrecetaHija,
                    Cantidad = s.Cantidad,
                    CostoUnitario = s.CostoUnitario,
                    Subtotal = s.Subtotal,
                    IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                    FechaRegistra = DateTime.Now,
                }).ToList()
            };

            var resultado = await _SubrecetasService.Insertar(Subreceta);
            return Ok(new { valor = resultado });
        }



        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMSubreceta model)
        {

            var userId = User.GetUserId();

            var Subreceta = new Subreceta
            {
                Id = model.Id,
                IdUnidadNegocio = model.IdUnidadNegocio,
                Sku = model.Sku,
                Descripcion = model.Descripcion,
                IdUnidadMedida = model.IdUnidadMedida,
                IdCategoria = model.IdCategoria,
                CostoSubrecetas = model.CostoSubrecetas,
                CostoInsumos = model.CostoInsumos,
                CostoPorcion = (decimal)model.CostoPorcion,
                CostoUnitario = model.CostoUnitario,
                Rendimiento = model.Rendimiento,
                FechaActualizacion = DateTime.Now,
                IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                FechaModifica = DateTime.Now,

                SubrecetasInsumos = model.SubrecetasInsumos?.Select(i => new SubrecetasInsumo
                {
                    IdInsumo = i.IdInsumo,
                    Cantidad = i.Cantidad,
                    CostoUnitario = i.CostoUnitario,
                    SubTotal = i.SubTotal,
                    IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                    FechaModifica = DateTime.Now,
                }).ToList(),

                SubrecetasSubrecetaIdSubrecetaPadreNavigations = model.SubrecetasSubrecetaIdSubrecetaPadreNavigations?.Select(s => new SubrecetasSubreceta
                {
                    IdSubrecetaPadre = model.Id,
                    IdSubrecetaHija = s.IdSubrecetaHija,
                    Cantidad = s.Cantidad,
                    CostoUnitario = s.CostoUnitario,
                    Subtotal = s.Subtotal,
                    IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                    FechaModifica = DateTime.Now,
                }).ToList()


            };

            var resultado = await _SubrecetasService.Actualizar(Subreceta);
            return Ok(new { valor = resultado });
        }




        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            var (eliminado, mensaje) = await _SubrecetasService.Eliminar(id);
            return Ok(new { valor = eliminado, mensaje });
        }


        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            if (id <= 0)
                return Ok(new { });

            var model = await _SubrecetasService.Obtener(id);

            var Subreceta = new VMSubreceta
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
                CostoSubrecetas = model.CostoSubrecetas,
                Rendimiento = model.Rendimiento,
            };

            var insumos = model.SubrecetasInsumos.Select(p => new VMSubrecetasInsumo
            {
                Id = p.Id,
                IdSubreceta = p.IdSubreceta,
                IdInsumo = p.IdInsumo,
                Nombre = p.IdInsumoNavigation.Descripcion,
                Cantidad = p.Cantidad,
                CostoUnitario = p.CostoUnitario,
                SubTotal = p.SubTotal
            }).ToList();

            var Subrecetas = model.SubrecetasSubrecetaIdSubrecetaPadreNavigations.Select(p => new VMSubrecetasSubreceta
            {
                Id = p.Id,
                IdSubrecetaPadre = p.IdSubrecetaPadre,
                IdSubrecetaHija = p.IdSubrecetaHija,
                Cantidad = p.Cantidad,
                CostoUnitario = p.CostoUnitario,
                SubTotal = p.Subtotal,
                Nombre = p.IdSubrecetaHijaNavigation?.Descripcion,
                IdSubrecetaHijaNavigation = p.IdSubrecetaHijaNavigation,
                IdSubrecetaPadreNavigation = p.IdSubrecetaPadreNavigation
            }).ToList();


            var result = new Dictionary<string, object>
            {
                ["Subreceta"] = Subreceta,
                ["Insumos"] = insumos,
                ["Subrecetas"] = Subrecetas
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
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}