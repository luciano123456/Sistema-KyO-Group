using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Diagnostics;
using System.Linq;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class OrdenesComprasController : Controller
    {
        private readonly IOrdenCompraService _svc;

        public OrdenesComprasController(IOrdenCompraService svc)
        {
            _svc = svc;
        }

        [AllowAnonymous]
        public IActionResult Index() => View();



        // ======================================================
        // LISTA PENDIENTES
        // ======================================================
        [HttpGet]
        public async Task<IActionResult> ListaPendientes(int? idProveedor = null)
        {
            try
            {
                var userId = User.GetUserId();

                var data = await _svc.ObtenerPendientes();
                var query = data.AsEnumerable();
                if (idProveedor.HasValue && idProveedor.Value > 0)
                    query = query.Where(o => o.IdProveedor == idProveedor.Value);

                var lista = query.Select(o => new VMOrdenCompra
                {
                    Id = o.Id,
                    IdProveedor = o.IdProveedor,
                    IdUnidadNegocio = o.IdUnidadNegocio,
                    IdLocal = o.IdLocal,
                    UnidadNegocio = o.IdUnidadNegocioNavigation?.Nombre,
                    Local = o.IdLocalNavigation?.Nombre,
                    Proveedor = o.IdProveedorNavigation?.Nombre,
                    Estado = o.IdEstadoNavigation?.Nombre,
                    FechaEmision = o.FechaEmision,
                    FechaEntrega = o.FechaEntrega,
                    CostoTotal = o.CostoTotal,
                    NotaInterna = o.NotaInterna,
                    CantCompras = o.Compras?.Count ?? 0,
                    IdCompraPrimera = o.Compras?.OrderByDescending(c => c.Fecha).FirstOrDefault()?.Id,
                    TieneComprasAsociadas = (o.Compras?.Any() ?? false)
                }).ToList();

                return Ok(lista);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error al obtener las órdenes pendientes", detalle = ex.Message });
            }
        }



        // ======================================================
        // LISTA COMPLETA
        // ======================================================
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
                    var compraDestino = compras.OrderByDescending(c => c.Fecha).FirstOrDefault();

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
                        IdCompraPrimera = compraDestino?.Id,
                        TieneComprasAsociadas = compras.Any()
                    };
                }).ToList();

                return Ok(lista);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error al obtener las órdenes", detalle = ex.Message });
            }
        }



        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            if (id <= 0)
                return Ok(new { });

            var oc = await _svc.Obtener(id);
            if (oc == null)
                return NotFound();

            // ========= CABECERA =========
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

                CantCompras = oc.Compras?.Count ?? 0,
                IdCompraPrimera = oc.Compras?.OrderBy(c => c.Fecha).FirstOrDefault()?.Id,
                TieneComprasAsociadas = oc.Compras?.Any() ?? false
            };

            // ========= DETALLE OC (CRUDO) =========
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
                SubTotal = d.Subtotal,

                IdEstado = d.IdEstado,
                NotaInterna = d.NotaInterna,

                IdUsuarioRegistra = d.IdUsuarioRegistra,
                FechaRegistra = d.FechaRegistra,
                IdUsuarioModifica = d.IdUsuarioModifica,
                FechaModifica = d.FechaModifica,

                Estado = d.IdEstadoNavigation?.Nombre,
                Sku = d.IdInsumoNavigation?.Sku,
                Nombre = d.IdInsumoNavigation?.Descripcion
            }).ToList();

            // ========= RESUMEN X INSUMO (OC vs TODAS LAS COMPRAS) =========

            // Todas las compras asociadas + su detalle
            var comprasDetalle = (oc.Compras ?? new List<Compra>())
                .SelectMany(c => c.ComprasInsumos.Select(ci => new
                {
                    Compra = c,
                    Det = ci
                }))
                .ToList();

            var resumenPorInsumo = new List<object>();

            foreach (var d in detalle)
            {
                // Todas las líneas de compra que matchean ese renglón de la OC
                var matches = comprasDetalle
                    .Where(x =>
                        x.Det.IdInsumo == d.IdInsumo &&
                        x.Det.IdProveedorLista == d.IdProveedorLista)
                    .ToList();

                decimal cantRecibida = 0m;
                decimal subtotalCompra = 0m;
                decimal sumaPrecioXCant = 0m;

                foreach (var m in matches)
                {
                    var det = m.Det;

                    // Precio unitario de la compra: prioridad Factura > Final > Lista
                    decimal precioCompraUnit;
                    if (det.PrecioFactura != 0)
                        precioCompraUnit = det.PrecioFactura;
                    else if (det.PrecioFinal != 0)
                        precioCompraUnit = det.PrecioFinal;
                    else if (det.PrecioLista != 0)
                        precioCompraUnit = det.PrecioLista;
                    else
                        precioCompraUnit = 0m;

                    cantRecibida += det.Cantidad;
                    sumaPrecioXCant += precioCompraUnit * det.Cantidad;
                    subtotalCompra += precioCompraUnit * det.Cantidad;
                }

                decimal precioCompraProm = 0m;
                if (cantRecibida > 0 && sumaPrecioXCant != 0)
                    precioCompraProm = sumaPrecioXCant / cantRecibida;

                // Datos de la OC (SIEMPRE tomados de la OC, no de las compras)
                decimal cantPedidaOc = d.CantidadPedida;
                decimal cantEntregadaOc = d.CantidadEntregada;
                decimal cantPendienteOc = d.CantidadRestante;

                // Subtotal de la orden = cantidad pedida * precio lista OC
                decimal precioListaOc = d.PrecioLista;
                decimal subtotalOrden = cantPedidaOc * precioListaOc;

                resumenPorInsumo.Add(new
                {
                    // Identificación
                    d.IdInsumo,
                    d.IdProveedorLista,
                    d.Id,
                    IdOrdenCompraInsumo = d.Id,
                    Sku = d.Sku,
                    Nombre = d.Nombre,

                    // Cantidades OC
                    CantidadPedidaOc = cantPedidaOc,
                    CantidadEntregadaOc = cantEntregadaOc,
                    CantidadPendienteOc = cantPendienteOc,

                    // Cantidad recibida total en compras
                    CantidadRecibidaCompras = cantRecibida,

                    // Precios ORDEN
                    PrecioLista = precioListaOc,
                    SubTotalOrden = subtotalOrden,

                    // Precios COMPRA (reales acumulados)
                    PrecioCompra = precioCompraProm,
                    SubtotalCompra = subtotalCompra,

                    // Estado OC
                    IdEstado = d.IdEstado,
                    EstadoOcNombre = d.Estado
                });
            }

            return Ok(new
            {
                OrdenCompra = vm,
                OrdenesComprasInsumos = detalle,
                ResumenCompras = resumenPorInsumo
            });
        }



        // ======================================================
        // INSERTAR
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMOrdenCompra model)
        {
            try
            {
                var userId = User.GetUserId() ?? 1;

                if (model.IdEstado <= 0)
                    model.IdEstado = 1;

                var entity = new OrdenesCompra
                {
                    IdUnidadNegocio = model.IdUnidadNegocio,
                    IdLocal = model.IdLocal,
                    IdProveedor = model.IdProveedor,
                    IdEstado = model.IdEstado,
                    FechaEmision = model.FechaEmision,
                    FechaEntrega = model.FechaEntrega,
                    NotaInterna = model.NotaInterna,
                    CostoTotal = model.CostoTotal,
                    IdUsuarioRegistra = userId,
                    FechaRegistra = DateTime.Now,

                    OrdenesComprasInsumos = model.OrdenesComprasInsumos?.Select(d => new OrdenesComprasInsumo
                    {
                        IdInsumo = d.IdInsumo,
                        IdProveedorLista = d.IdProveedorLista is > 0 ? d.IdProveedorLista : null,
                        CantidadPedida = d.CantidadPedida,
                        CantidadEntregada = d.CantidadEntregada,
                        CantidadRestante = d.CantidadRestante,
                        PrecioLista = d.PrecioLista,
                        Subtotal = d.Subtotal,
                        IdEstado = d.IdEstado > 0 ? d.IdEstado : 1,
                        NotaInterna = d.NotaInterna,
                        IdUsuarioRegistra = userId,
                        FechaRegistra = DateTime.Now
                    }).ToList()
                };

                var ok = await _svc.Insertar(entity);
                return Ok(new { valor = ok, mensaje = ok ? "Orden de compra registrada." : "No se pudo guardar la orden de compra." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { valor = false, mensaje = "Error al registrar la OC: " + (ex.InnerException?.Message ?? ex.Message) });
            }
        }



        // ======================================================
        // ACTUALIZAR
        // ======================================================
        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMOrdenCompra model)
        {
            if (model.Id <= 0)
                return BadRequest(new { valor = false, mensaje = "Id inválido." });

            try
            {
                var userId = User.GetUserId() ?? 1;

                if (model.IdEstado <= 0)
                    model.IdEstado = 1;

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
                    CostoTotal = model.CostoTotal,
                    IdUsuarioModifica = userId,
                    FechaModifica = DateTime.Now,

                    OrdenesComprasInsumos = model.OrdenesComprasInsumos?.Select(d => new OrdenesComprasInsumo
                    {
                        Id = d.Id,
                        IdOrdenCompra = d.IdOrdenCompra,
                        IdInsumo = d.IdInsumo,
                        IdProveedorLista = d.IdProveedorLista is > 0 ? d.IdProveedorLista : null,
                        CantidadPedida = d.CantidadPedida,
                        CantidadEntregada = d.CantidadEntregada,
                        CantidadRestante = d.CantidadRestante,
                        PrecioLista = d.PrecioLista,
                        Subtotal = d.Subtotal,
                        IdEstado = d.IdEstado > 0 ? d.IdEstado : 1,
                        NotaInterna = d.NotaInterna,
                        IdUsuarioModifica = userId,
                        FechaModifica = DateTime.Now
                    }).ToList()
                };

                var ok = await _svc.Actualizar(entity);
                return Ok(new { valor = ok, mensaje = ok ? "Orden de compra actualizada." : "No se pudo actualizar la orden de compra." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { valor = false, mensaje = "Error al actualizar la OC: " + (ex.InnerException?.Message ?? ex.Message) });
            }
        }



        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id, bool cascade = false)
        {
            var r = await _svc.Eliminar(id, cascade);
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
