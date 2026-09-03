using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class ProveedoresCuentaCorrienteController : Controller
    {
        private readonly IProveedoresCuentaCorrienteService _service;

        public ProveedoresCuentaCorrienteController(IProveedoresCuentaCorrienteService service)
        {
            _service = service;
        }

        [AllowAnonymous]
        public IActionResult Index() => View();

        [HttpGet]
        public async Task<IActionResult> Proveedores(string? buscar, bool soloConSaldo = false)
        {
            var lista = await _service.ListarProveedoresConSaldo(buscar, soloConSaldo);
            return Ok(lista.Select(x => new
            {
                x.proveedor.Id,
                x.proveedor.Nombre,
                x.proveedor.Cuit,
                Saldo = x.saldo
            }));
        }

        [HttpGet]
        public async Task<IActionResult> Movimientos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto)
        {
            var movs = await _service.Movimientos(idProveedor, fechaDesde, fechaHasta, tipoMov, texto);
            return Ok(movs);
        }

        [HttpGet]
        public async Task<IActionResult> Resumen(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto)
        {
            var res = await _service.ResumenCompleto(idProveedor, fechaDesde, fechaHasta, tipoMov, texto);
            return Ok(res);
        }

        [HttpGet]
        public async Task<IActionResult> Pagos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? texto)
        {
            var pagos = await _service.ListarPagos(idProveedor, fechaDesde, fechaHasta, texto);
            return Ok(pagos.Select(p =>
            {
                var usr = p.IdUsuarioRegistraNavigation;
                var nombreUsr = usr == null
                    ? null
                    : string.Join(' ', new[] { usr.Nombre, usr.Apellido }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim();
                if (string.IsNullOrWhiteSpace(nombreUsr))
                    nombreUsr = usr?.Usuario;

                return new
                {
                    p.Id,
                    p.IdProveedor,
                    p.Fecha,
                    p.Importe,
                    p.Concepto,
                    p.NotaInterna,
                    p.IdCuenta,
                    Cuenta = p.IdCuentaNavigation?.Nombre,
                    p.FechaRegistra,
                    UsuarioRegistra = nombreUsr
                };
            }));
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarPago([FromBody] ProveedoresPago model)
        {
            var userId = User.GetUserId() ?? 1;
            var result = await _service.RegistrarPago(model, userId);
            return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo });
        }

        [HttpDelete]
        public async Task<IActionResult> EliminarPago(int id)
        {
            var result = await _service.EliminarPago(id);
            return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            var result = await _service.EliminarMovimiento(id);
            return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo });
        }
    }
}
