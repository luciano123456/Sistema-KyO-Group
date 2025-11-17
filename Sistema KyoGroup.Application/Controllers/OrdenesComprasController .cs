using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Diagnostics;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class OrdenesComprasController : Controller
    {
        private readonly IOrdenCompraService _svc; // <- tu service para OCs (similar a SubRecetasService)

        public OrdenesComprasController(IOrdenCompraService svc)
        {
            _svc = svc;
        }

        [AllowAnonymous]
        public IActionResult Index() => View();

        [HttpGet]
        public async Task<IActionResult> Lista(
         int? IdUnidadNegocio = null,
         int? IdLocal = null,
         int? IdProveedor = null,
         int? IdEstado = null,
         DateTime? FechaDesde = null,
         DateTime? FechaHasta = null)
            {
                try
                {
                    var userId = User.GetUserId();

                    var data = await _svc.ObtenerTodosConFiltros(
                        IdUnidadNegocio, IdLocal, IdProveedor, IdEstado,
                        FechaDesde, FechaHasta, userId);

                    var lista = data.Select(o => new VMOrdenCompra
                    {
                        Id = o.Id,
                        UnidadNegocio = o.IdUnidadNegocioNavigation?.Nombre,
                        Local = o.IdLocalNavigation?.Nombre,
                        Proveedor = o.IdProveedorNavigation?.Nombre,
                        Estado = o.IdEstadoNavigation?.Nombre,
                        FechaEmision = o.FechaEmision,
                        FechaEntrega = o.FechaEntrega,
                        CostoTotal = o.CostoTotal,
                        NotaInterna = o.NotaInterna
                    }).ToList();

                    return Ok(lista);
                }
                catch (Exception ex)
                {
                    return StatusCode(500, new { mensaje = "Error al obtener las órdenes de compra", detalle = ex.Message });
                }
            }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            if (id <= 0) return Ok(new { });

            var model = await _svc.Obtener(id);
            if (model == null) return NotFound();

            var vm = new VMOrdenCompra
            {
                Id = model.Id,
                IdUnidadNegocio = model.IdUnidadNegocio,
                UnidadNegocio = model.IdUnidadNegocioNavigation?.Nombre,
                IdLocal = model.IdLocal,
                Local = model.IdLocalNavigation?.Nombre,
                IdProveedor = model.IdProveedor,
                Proveedor = model.IdProveedorNavigation?.Nombre,
                IdEstado = model.IdEstado,
                Estado = model.IdEstadoNavigation?.Nombre,
                FechaEmision = model.FechaEmision,
                FechaEntrega = model.FechaEntrega,
                CostoTotal = model.CostoTotal,
                NotaInterna = model.NotaInterna,
                OrdenesComprasInsumos = model.OrdenesComprasInsumos.Select(d => new VMOrdenCompraInsumo
                {
                    Id = d.Id,
                    IdOrdenCompra = d.IdOrdenCompra,
                    // En tu BD IdInsumo es string:
                    IdInsumo = d.IdInsumo,
                    // Nombre: tratamos de sacar algo legible si lo tenés por la lista del proveedor
                    Nombre = d.IdProveedorListaNavigation?.Descripcion // o el campo que uses para mostrar
                              ?? d.IdInsumo, // fallback al mismo código/string
                    // Campos económicos/estado (named igual que la BD)
                    CantidadPedida = d.CantidadPedida,
                    CantidadEntregada = d.CantidadEntregada,
                    CantidadRestante = d.CantidadRestante,
                    PrecioLista = d.PrecioLista,
                    SubTotal = d.Subtotal, // VM usa SubTotal (T mayúscula) para la vista
                    IdEstado = d.IdEstado,
                    NotaInterna = d.NotaInterna
                }).ToList()
            };

            return Ok(vm);
        }

        /// <summary>
        /// Inserta una nueva OC con su detalle
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMOrdenCompra model)
        {
            try
            {
                var userId = User.GetUserId() ?? 0;

                var entity = new OrdenesCompra
                {
                    IdUnidadNegocio = model.IdUnidadNegocio,
                    IdLocal = model.IdLocal,
                    IdProveedor = model.IdProveedor,
                    IdEstado = model.IdEstado,
                    FechaEmision = model.FechaEmision == default ? DateTime.Now : model.FechaEmision,
                    FechaEntrega = model.FechaEntrega,
                    NotaInterna = model.NotaInterna,
                    CostoTotal = model.CostoTotal, // el service puede recalcular por seguridad
                    IdUsuarioRegistra = (int)userId,
                    FechaRegistra = DateTime.Now,

                    OrdenesComprasInsumos = (model.OrdenesComprasInsumos ?? new List<VMOrdenCompraInsumo>()).Select(d => new OrdenesComprasInsumo
                    {
                        // d.Id = 0 en alta
                        IdInsumo = d.IdInsumo, // string
                        IdProveedorLista = d.IdProveedorLista,
                        CantidadPedida = d.CantidadPedida,
                        CantidadEntregada = d.CantidadEntregada,
                        CantidadRestante = d.CantidadRestante,
                        PrecioLista = d.PrecioLista,
                        Subtotal = d.SubTotal, // map a BD "Subtotal"
                        IdEstado = d.IdEstado,
                        NotaInterna = d.NotaInterna,
                        IdUsuarioRegistra = (int)userId,
                        FechaRegistra = DateTime.Now
                    }).ToList()
                };

                var ok = await _svc.Insertar(entity);
                return Ok(new { valor = ok });
            }
            catch (Exception)
            {
                return StatusCode(500, new { valor = false, mensaje = "Error al registrar la orden de compra." });
            }
        }

        /// <summary>
        /// Actualiza cabecera + hace upsert/diff de detalle (lo resuelve el service/repo)
        /// </summary>
        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMOrdenCompra model)
        {
            if (model.Id <= 0) return BadRequest(new { valor = false, mensaje = "Id inválido." });

            try
            {
                var userId = User.GetUserId() ?? 0;

                var entity = new OrdenesCompra
                {
                    Id = model.Id,
                    IdUnidadNegocio = model.IdUnidadNegocio,
                    IdLocal = model.IdLocal,
                    IdProveedor = model.IdProveedor,
                    IdEstado = model.IdEstado,
                    FechaEmision = model.FechaEmision,
                    FechaEntrega = model.FechaEntrega,
                    NotaInterna = model.NotaInterna,
                    CostoTotal = model.CostoTotal, // el service puede recalcular
                    IdUsuarioModifica = (int)userId,
                    FechaModifica = DateTime.Now,

                    // El service debe encargarse del DIFF (agregar/actualizar/eliminar)
                    OrdenesComprasInsumos = (model.OrdenesComprasInsumos ?? new List<VMOrdenCompraInsumo>()).Select(d => new OrdenesComprasInsumo
                    {
                        Id = d.Id,
                        IdOrdenCompra = model.Id,
                        IdInsumo = d.IdInsumo,
                        IdProveedorLista = d.IdProveedorLista,
                        CantidadPedida = d.CantidadPedida,
                        CantidadEntregada = d.CantidadEntregada,
                        CantidadRestante = d.CantidadRestante,
                        PrecioLista = d.PrecioLista,
                        Subtotal = d.SubTotal,
                        IdEstado = d.IdEstado,
                        NotaInterna = d.NotaInterna,
                        IdUsuarioModifica = (int)userId,
                        FechaModifica = DateTime.Now
                    }).ToList()
                };

                var ok = await _svc.Actualizar(entity);
                return Ok(new { valor = ok });
            }
            catch (Exception)
            {
                return StatusCode(500, new { valor = false, mensaje = "Error al actualizar la orden de compra." });
            }
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            var (eliminado, mensaje) = await _svc.Eliminar(id);
            return Ok(new { valor = eliminado, mensaje });
        }

        [AllowAnonymous]
        public async Task<IActionResult> NuevoModif(int? id)
        {
            if (id != null) ViewBag.data = id;
            return View();
        }

        public IActionResult Privacy() => View();

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
