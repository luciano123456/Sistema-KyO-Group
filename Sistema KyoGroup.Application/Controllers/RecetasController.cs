using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System.Diagnostics;
using System.Text.Json.Serialization;
using System.Text.Json;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class RecetasController : Controller
    {
        private readonly IRecetaService _RecetasService;
        private readonly SistemaKyoGroupContext _db;

        public RecetasController(IRecetaService RecetasService, SistemaKyoGroupContext db)
        {
            _RecetasService = RecetasService;
            _db = db;
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
                        CostoUnitario = c.CostoUnitario,
                        FechaRegistra = c.FechaRegistra,
                        UsuarioRegistra = c.IdUsuarioRegistraNavigation != null ? c.IdUsuarioRegistraNavigation.Usuario : null,
                        FechaModifica = c.FechaModifica,
                        UsuarioModifica = c.IdUsuarioModificaNavigation != null ? c.IdUsuarioModificaNavigation.Usuario : null
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
            var userId = User.GetUserId() ?? 0;
            if (userId <= 0)
                return Ok(new { valor = false, mensaje = "Sesión inválida. Volvé a iniciar sesión." });

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
                IdUsuarioRegistra = userId,
                FechaRegistra = DateTime.Now,

                RecetasInsumos = model.RecetasInsumos?.Select(i => new RecetasInsumo
                {
                    IdInsumo = i.IdInsumo,
                    Cantidad = i.Cantidad,
                    CostoUnitario = i.CostoUnitario,
                    SubTotal = i.SubTotal,
                    IdUsuarioRegistra = userId,
                    FechaRegistra = DateTime.Now,
                }).ToList(),

                RecetasSubReceta = model.RecetasSubReceta?.Select(s => new RecetasSubReceta
                {
                    IdSubReceta = s.IdSubReceta,
                    Cantidad = s.Cantidad,
                    CostoUnitario = s.CostoUnitario,
                    SubTotal = s.SubTotal,
                    IdUsuarioRegistra = userId,
                    FechaRegistra = DateTime.Now,
                }).ToList()
            };

            var (ok, mensaje) = await _RecetasService.Insertar(Receta);
            return Ok(new { valor = ok, mensaje });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMReceta model)
        {
            var userId = User.GetUserId() ?? 0;
            if (userId <= 0)
                return Ok(new { valor = false, mensaje = "Sesión inválida. Volvé a iniciar sesión." });

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
                IdUsuarioModifica = userId,
                FechaModifica = DateTime.Now,

                RecetasInsumos = model.RecetasInsumos?.Select(i => new RecetasInsumo
                {
                    IdInsumo = i.IdInsumo,
                    Cantidad = i.Cantidad,
                    CostoUnitario = i.CostoUnitario,
                    SubTotal = i.SubTotal,
                    IdUsuarioModifica = userId,
                    FechaModifica = DateTime.Now,
                }).ToList(),

                RecetasSubReceta = model.RecetasSubReceta?.Select(s => new RecetasSubReceta
                {
                    IdReceta = model.Id,
                    IdSubReceta = s.IdSubReceta,
                    Cantidad = s.Cantidad,
                    CostoUnitario = s.CostoUnitario,
                    SubTotal = s.SubTotal,
                    IdUsuarioModifica = userId,
                    FechaModifica = DateTime.Now,
                }).ToList()
            };

            var (ok, mensaje) = await _RecetasService.Actualizar(Receta);
            return Ok(new { valor = ok, mensaje });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id, bool cascade = false)
        {
            var r = await _RecetasService.Eliminar(id, cascade);
            return Ok(new
            {
                valor = r.Ok,
                mensaje = r.Mensaje,
                tipo = r.Tipo,
                cascadeDisponible = r.CascadeDisponible,
                dependencias = r.Dependencias.Select(d => new
                {
                    entidad = d.Entidad,
                    cantidad = d.Cantidad,
                    detalle = d.Detalle,
                    cascadeable = d.Cascadeable
                })
            });
        }

        [HttpGet]
        public async Task<IActionResult> Historial(int id)
        {
            if (id <= 0)
                return Ok(Array.Empty<object>());

            var items = await RecetaHistorialHelper.ListarAsync(_db, RecetaHistorialHelper.TipoReceta, id);
            return Ok(items.Select(h => new
            {
                h.Id,
                h.Accion,
                h.Resumen,
                h.Detalle,
                h.IdUsuario,
                h.UsuarioNombre,
                h.Fecha
            }));
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
