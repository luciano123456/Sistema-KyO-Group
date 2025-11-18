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
        public async Task<IActionResult> ListaPendientes()
        {
            try
            {
                var userId = User.GetUserId();

                // 1) Obtener los registros ya INCLUYENDO las relaciones
                var data = await _svc.ObtenerPendientes();

                // 2) MATERIALIZAR (si el servicio devuelve IQueryable)
                var listaRaw = data.ToList();

                // 3) Proyectar en memoria con ?
                var lista = listaRaw.Select(o => new VMOrdenCompra
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
                return StatusCode(500, new
                {
                    mensaje = "Error al obtener las órdenes de compra pendientes",
                    detalle = ex.Message
                });
            }
        }



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

                var lista = data.Select(o =>
                {
                    var compras = o.Compras ?? new List<Compra>();

                    // Podés elegir “primera”, “última”, o la más reciente por fecha
                    var compraDestino = compras
                        .OrderByDescending(c => c.Fecha)   // o FechaCompra / FechaEmision según tu modelo
                        .FirstOrDefault();

                    return new VMOrdenCompra
                    {
                        Id = o.Id,
                        UnidadNegocio = o.IdUnidadNegocioNavigation?.Nombre,
                        Local = o.IdLocalNavigation?.Nombre,
                        Proveedor = o.IdProveedorNavigation?.Nombre,
                        Estado = o.IdEstadoNavigation?.Nombre,
                        FechaEmision = o.FechaEmision,
                        FechaEntrega = o.FechaEntrega,
                        CostoTotal = o.CostoTotal,
                        NotaInterna = o.NotaInterna,
                        CantCompras = compras.Count,
                        IdCompraPrimera = compraDestino?.Id
                    };
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
            if (id <= 0)
                return Ok(new { });

            var oc = await _svc.Obtener(id);
            if (oc == null) return NotFound();

            // ===== CABECERA (usa tu VMOrdenCompra tal cual está) =====
            var vm = new VMOrdenCompra
            {
                Id = oc.Id,

                IdUnidadNegocio = oc.IdUnidadNegocio,
                UnidadNegocio = oc.IdUnidadNegocioNavigation?.Nombre,

                IdLocal = oc.IdLocal,
                Local = oc.IdLocalNavigation?.Nombre,

                IdProveedor = oc.IdProveedor,
                Proveedor = oc.IdProveedorNavigation?.Nombre,

                FechaEmision = oc.FechaEmision,
                FechaEntrega = oc.FechaEntrega,

                CostoTotal = oc.CostoTotal,

                IdEstado = oc.IdEstado,
                Estado = oc.IdEstadoNavigation?.Nombre,

                NotaInterna = oc.NotaInterna,

                // estos dos por si los querés usar en el front
                CantCompras = oc.Compras?.Count ?? 0,
                IdCompraPrimera = oc.Compras?
                    .OrderBy(c => c.Id)
                    .FirstOrDefault()?.Id
            };

            // ===== DETALLE (lista de VMOrdenCompraInsumo) =====
            var detalle = oc.OrdenesComprasInsumos.Select(d => new VMOrdenCompraInsumo
            {
                Id = d.Id,
                IdOrdenCompra = d.IdOrdenCompra,

                IdInsumo = d.IdInsumo,
                IdProveedorLista = d.IdProveedorLista,

                CantidadPedida = d.CantidadPedida,
                CantidadEntregada = d.CantidadEntregada,
                CantidadRestante = d.CantidadRestante,

                PrecioLista = d.PrecioLista,

                IdEstado = d.IdEstado,
                NotaInterna = d.NotaInterna,

                IdUsuarioRegistra = d.IdUsuarioRegistra,
                FechaRegistra = d.FechaRegistra,
                IdUsuarioModifica = d.IdUsuarioModifica,
                FechaModifica = d.FechaModifica,

                // extras “solo vista”
                Estado = d.IdEstadoNavigation?.Nombre,
                Sku = d.IdInsumoNavigation?.Sku,
                Nombre = d.IdInsumoNavigation?.Descripcion,

                // tu campo “de vista”
                SubTotal = d.Subtotal
            }).ToList();

            // ===== RESPUESTA (cab + detalle separados) =====
            return Ok(new
            {
                OrdenCompra = vm,
                OrdenesComprasInsumos = detalle
            });
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

                    // Si querés que siempre sea Pendiente podés forzar acá:
                    // IdEstado = (int)EstadosOC.Pendiente,
                    IdEstado = model.IdEstado,

                    FechaEmision = model.FechaEmision == default ? DateTime.Now : model.FechaEmision,
                    FechaEntrega = model.FechaEntrega,
                    NotaInterna = model.NotaInterna,
                    CostoTotal = model.CostoTotal, // el service puede recalcular por seguridad

                    IdUsuarioRegistra = (int)userId,
                    FechaRegistra = DateTime.Now,

                    // 🔥 ACA ES LA CLAVE: mapear a OrdenesComprasInsumo, NO a VMOrdenCompraInsumo
                    OrdenesComprasInsumos = model.OrdenesComprasInsumos?
                        .Select(d => new OrdenesComprasInsumo
                        {
                            // Id = 0 en alta (identity)
                            IdInsumo = d.IdInsumo,
                            IdProveedorLista = d.IdProveedorLista,

                            CantidadPedida = d.CantidadPedida,
                            CantidadEntregada = d.CantidadEntregada,
                            CantidadRestante = d.CantidadRestante,

                            PrecioLista = d.PrecioLista,
                            Subtotal = d.Subtotal,   // en la entidad se llama Subtotal

                            IdEstado = d.IdEstado,
                            NotaInterna = d.NotaInterna,

                            IdUsuarioRegistra = (int)userId,
                            FechaRegistra = DateTime.Now
                        })
                        .ToList() ?? new List<OrdenesComprasInsumo>()
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
            if (model.Id <= 0)
                return BadRequest(new { valor = false, mensaje = "Id inválido." });

            try
            {
                var userId = User.GetUserId() ?? 0;

                var entity = new OrdenesCompra
                {
                    Id = model.Id,
                    IdUnidadNegocio = model.IdUnidadNegocio,
                    IdLocal = model.IdLocal,
                    IdProveedor = model.IdProveedor,

                    // si querés, acá podrías forzar siempre "Pendiente"
                    IdEstado = model.IdEstado,

                    FechaEmision = model.FechaEmision,
                    FechaEntrega = model.FechaEntrega,
                    NotaInterna = model.NotaInterna,
                    CostoTotal = model.CostoTotal, // el service puede recalcular

                    IdUsuarioModifica = (int)userId,
                    FechaModifica = DateTime.Now,

                    // 🔥 detalle mapeado a entidad, NO al VM
                    OrdenesComprasInsumos = model.OrdenesComprasInsumos?
                        .Select(d => new OrdenesComprasInsumo
                        {
                            Id = d.Id,                          // importante para el diff (update/delete)
                            IdOrdenCompra = d.IdOrdenCompra,   // o model.Id

                            IdInsumo = d.IdInsumo,
                            IdProveedorLista = d.IdProveedorLista,

                            CantidadPedida = d.CantidadPedida,
                            CantidadEntregada = d.CantidadEntregada,
                            CantidadRestante = d.CantidadRestante,

                            PrecioLista = d.PrecioLista,
                            Subtotal = d.Subtotal,             // en la entidad se llama Subtotal

                            IdEstado = d.IdEstado,
                            NotaInterna = d.NotaInterna,

                            IdUsuarioModifica = (int)userId,
                            FechaModifica = DateTime.Now
                        })
                        .ToList() ?? new List<OrdenesComprasInsumo>()
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
