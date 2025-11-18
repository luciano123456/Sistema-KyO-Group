using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class ComprasController : Controller
    {
        private readonly ICompraService _svc;
        private readonly IOrdenCompraService _oc;

        public ComprasController(ICompraService svc, IOrdenCompraService oc)
        {
            _svc = svc;
            _oc = oc;
        }

        [AllowAnonymous]
        public IActionResult Index() => View();

        [HttpGet]
        public async Task<IActionResult> Lista(
            int? IdUnidadNegocio = null,
            int? IdLocal = null,
            int? IdProveedor = null,
            DateTime? FechaDesde = null,
            DateTime? FechaHasta = null)
        {
            var userId = User.GetUserId();

            var data = await _svc.ObtenerTodosConFiltros(
                IdUnidadNegocio, IdLocal, IdProveedor,
                FechaDesde, FechaHasta, userId);

            var list = data.Select(c => new
            {
                c.Id,
                c.Fecha,
                UnidadNegocio = c.IdUnidadNegocioNavigation.Nombre,
                Local = c.IdLocalNavigation.Nombre,
                Proveedor = c.IdProveedorNavigation.Nombre,
                OrdenCompra = c.IdOrdenCompra,
                c.SubtotalFinal,
                c.NotaInterna
            });

            return Ok(list);
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var c = await _svc.Obtener(id);
            if (c == null)
                return NotFound();

            // Si la compra tiene OC, traigo las líneas completas
            var detallesOc = c.IdOrdenCompraNavigation?.OrdenesComprasInsumos?.ToList()
                             ?? new List<OrdenesComprasInsumo>();

            var vm = new VMCompra
            {
                Id = c.Id,
                IdUnidadNegocio = c.IdUnidadNegocio,
                IdLocal = c.IdLocal,
                IdProveedor = c.IdProveedor,
                IdOrdenCompra = c.IdOrdenCompra,
                Fecha = c.Fecha,
                Subtotal = c.Subtotal,
                Descuentos = c.Descuentos,
                SubtotalFinal = c.SubtotalFinal,
                NotaInterna = c.NotaInterna,

                ComprasInsumos = c.ComprasInsumos.Select(d =>
                {
                    // Busco la línea correspondiente en la OC
                    var ocDet = detallesOc.FirstOrDefault(oc =>
                        oc.IdInsumo == d.IdInsumo &&
                        oc.IdProveedorLista == d.IdProveedorLista);

                    // Si no hay línea en la OC → uso lo que ya estaba en la compra
                    var cantPedidaOc = ocDet?.CantidadPedida ?? d.Cantidad;
                    var cantPendienteOc = ocDet?.CantidadRestante ?? cantPedidaOc;

                    return new VMCompraInsumo
                    {
                        Id = d.Id,
                        IdInsumo = d.IdInsumo,
                        IdProveedorLista = d.IdProveedorLista,

                        // Cantidad recibida en ESTA compra
                        Cantidad = d.Cantidad,

                        PrecioLista = d.PrecioLista,
                        Nombre = d.IdInsumoNavigation.Descripcion,
                        PrecioFactura = d.PrecioFactura,
                        Diferencia = d.Diferencia,
                        PorcDescuento = d.PorcDescuento,
                        DescuentoUnitario = d.DescuentoUnitario,
                        Sku = d.IdInsumoNavigation.Sku,
                        PrecioFinal = d.PrecioFinal,
                        DescuentoTotal = d.DescuentoTotal,
                        SubtotalConDescuento = d.SubtotalConDescuento,
                        SubtotalFinal = d.SubtotalFinal,

                        // Datos reales de la OC
                        IdOrdenCompraInsumo = ocDet?.Id,
                        CantidadPedidaOc = cantPedidaOc,
                        CantidadPendienteOc = cantPendienteOc
                    };
                }).ToList()
            };

            return Ok(vm);
        }

        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMCompra model)
        {
            try
            {
                var userId = User.GetUserId() ?? 0;

                var entity = new Compra
                {
                    IdUnidadNegocio = model.IdUnidadNegocio,
                    IdLocal = model.IdLocal,
                    IdProveedor = model.IdProveedor,
                    IdOrdenCompra = model.IdOrdenCompra,
                    Fecha = model.Fecha,
                    NotaInterna = model.NotaInterna,
                    Subtotal = model.Subtotal,
                    Descuentos = model.Descuentos,
                    SubtotalFinal = model.SubtotalFinal,
                    IdUsuarioRegistra = userId,
                    FechaRegistra = DateTime.Now,
                    ComprasInsumos = model.ComprasInsumos.Select(d => new ComprasInsumo
                    {
                        IdInsumo = d.IdInsumo,
                        IdProveedorLista = d.IdProveedorLista,
                        Cantidad = d.Cantidad,
                        PrecioLista = d.PrecioLista,
                        PrecioFactura = d.PrecioFactura,
                        Diferencia = d.Diferencia,
                        PorcDescuento = d.PorcDescuento,
                        DescuentoUnitario = d.DescuentoUnitario,
                        PrecioFinal = d.PrecioFinal,
                        DescuentoTotal = d.DescuentoTotal,
                        SubtotalConDescuento = d.SubtotalConDescuento,
                        SubtotalFinal = d.SubtotalFinal,
                        IdUsuarioRegistra = userId,
                        FechaRegistra = DateTime.Now
                    }).ToList()
                };

                var ok = await _svc.Insertar(entity);

                return Ok(new { valor = ok });
            }
            catch
            {
                return StatusCode(500, new { valor = false, mensaje = "Error al insertar compra." });
            }
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMCompra model)
        {
            var userId = User.GetUserId() ?? 0;

            var entity = new Compra
            {
                Id = model.Id,
                IdUnidadNegocio = model.IdUnidadNegocio,
                IdLocal = model.IdLocal,
                IdProveedor = model.IdProveedor,
                IdOrdenCompra = model.IdOrdenCompra,
                Fecha = model.Fecha,
                NotaInterna = model.NotaInterna,
                Subtotal = model.Subtotal,
                Descuentos = model.Descuentos,
                SubtotalFinal = model.SubtotalFinal,
                IdUsuarioModifica = userId,
                ComprasInsumos = model.ComprasInsumos.Select(d => new ComprasInsumo
                {
                    Id = d.Id,
                    IdCompra = model.Id,
                    IdInsumo = d.IdInsumo,
                    IdProveedorLista = d.IdProveedorLista,
                    Cantidad = d.Cantidad,
                    PrecioLista = d.PrecioLista,
                    PrecioFactura = d.PrecioFactura,
                    Diferencia = d.Diferencia,
                    PorcDescuento = d.PorcDescuento,
                    DescuentoUnitario = d.DescuentoUnitario,
                    PrecioFinal = d.PrecioFinal,
                    DescuentoTotal = d.DescuentoTotal,
                    SubtotalConDescuento = d.SubtotalConDescuento,
                    SubtotalFinal = d.SubtotalFinal,
                    IdUsuarioModifica = userId,
                    FechaModifica = DateTime.Now
                }).ToList()
            };

            var ok = await _svc.Actualizar(entity);

            return Ok(new { valor = ok });
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
            if (id != null) ViewBag.Data = id;
            return View();
        }
    }
}
