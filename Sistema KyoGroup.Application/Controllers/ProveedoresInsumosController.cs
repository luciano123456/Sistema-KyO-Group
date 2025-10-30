using KyoGroup.Application.Models.ViewModels;
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
    public class ProveedoresInsumosController : Controller
    {
        private readonly IProveedoresInsumoservice _ProveedoresInsumosService;

        public ProveedoresInsumosController(IProveedoresInsumoservice ProveedoresInsumosService)
        {
            _ProveedoresInsumosService = ProveedoresInsumosService;
        }

        [AllowAnonymous]
        public IActionResult Index()
        {
            return View();
        }


        [HttpGet]
        public async Task<IActionResult> Lista(int IdProveedor)
        {
            var ProveedoresInsumos = await _ProveedoresInsumosService.ObtenerTodos();

            var lista = ProveedoresInsumos
                .Where(c => IdProveedor == -1 || c.IdProveedor == IdProveedor)
                .Select(c => new VMProveedoresInsumos
                {
                    Id = c.Id,
                    Descripcion = c.Descripcion,
                    CostoUnitario = c.CostoUnitario,
                    Codigo = c.Codigo,
                    FechaActualizacion = c.FechaActualizacion,
                    IdProveedor = c.IdProveedor,
                    Proveedor = c.IdProveedorNavigation != null ? c.IdProveedorNavigation.Nombre : "",
                    IdUsuarioRegistra = c.IdUsuarioRegistra,
                    FechaRegistra = c.FechaRegistra,
                    IdUsuarioModifica = c.IdUsuarioModifica,
                    FechaModifica = c.FechaModifica,
                    UsuarioRegistra = c.IdUsuarioRegistraNavigation != null ? c.IdUsuarioRegistraNavigation.Usuario : null,
                    UsuarioModifica = c.IdUsuarioModificaNavigation != null ? c.IdUsuarioModificaNavigation.Usuario : null
                })
                .ToList();

            return Ok(lista);
        }

        [HttpPost]
        public async Task<IActionResult> Comparar([FromBody] VMImportacionProveedoresInsumos model)
        {
            if (model == null || model.IdProveedor == 0 || model.Lista == null || !model.Lista.Any())
                return BadRequest("Datos incompletos");

            var insumosExistentes = await _ProveedoresInsumosService.ObtenerPorProveedor(model.IdProveedor);

            var comparacion = model.Lista.Select(item =>
            {
                var codigoImportado = item.Codigo?.Trim();
                var descripcionImportada = item.Descripcion?.Trim().ToUpper();

                // Comparar solo por código si tiene valor, si no, comparar por descripción
                var existente = !string.IsNullOrWhiteSpace(codigoImportado)
                    ? insumosExistentes.FirstOrDefault(x =>
                        !string.IsNullOrWhiteSpace(x.Codigo) &&
                        x.Codigo.Trim().ToUpper() == codigoImportado.ToUpper())
                    : insumosExistentes.FirstOrDefault(x =>
                        x.Descripcion.Trim().ToUpper() == descripcionImportada);

                return new
                {
                    codigo = item.Codigo,
                    descripcion = item.Descripcion,
                    precioNuevo = item.CostoUnitario,
                    precioAnterior = existente?.CostoUnitario,
                    nuevo = existente == null
                };
            }).ToList();

            return Ok(comparacion);
        }



        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMProveedoresInsumos model)
        {

            var userId = User.GetUserId();

            var ProveedoresInsumos = new ProveedoresInsumosLista
            {
                Descripcion = model.Descripcion,
                CostoUnitario = model.CostoUnitario,
                Codigo = model.Codigo,
                FechaActualizacion = DateTime.Now,
                IdProveedor = model.IdProveedor,
                IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                FechaRegistra = DateTime.Now
            };

            bool respuesta = await _ProveedoresInsumosService.Insertar(ProveedoresInsumos);

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMProveedoresInsumos model)
        {

            // Id del usuario desde el JWT
            var userId = User.GetUserId();

            var ProveedoresInsumos = new ProveedoresInsumosLista
            {
                Id = model.Id,
                Descripcion = model.Descripcion,
                CostoUnitario = model.CostoUnitario,
                Codigo = model.Codigo,
                FechaActualizacion = DateTime.Now,
                IdProveedor = model.IdProveedor,
                IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                FechaModifica = DateTime.Now
            };

            bool respuesta = await _ProveedoresInsumosService.Actualizar(ProveedoresInsumos);

            return Ok(new { valor = respuesta });
        }

        [HttpPost]
        public async Task<IActionResult> Importar([FromBody] VMImportacionProveedoresInsumos model)
        {
            if (model == null || model.IdProveedor == 0 || model.Lista == null || !model.Lista.Any())
                return BadRequest(new { valor = false, mensaje = "Datos inválidos" });

            // Id del usuario desde el JWT
            var userId = User.GetUserId();

            var listaProcesada = model.Lista.Select(x => new ProveedoresInsumosLista
            {
                Codigo = x.Codigo,
                Descripcion = x.Descripcion,
                CostoUnitario = x.CostoUnitario,
                IdProveedor = model.IdProveedor,
                FechaActualizacion = DateTime.Now,
                IdUsuarioRegistra = (int)userId, // fallback si hicieras pruebas sin token
                FechaRegistra = DateTime.Now
            }).ToList();

            var resultado = await _ProveedoresInsumosService.ImportarDesdeLista(model.IdProveedor, listaProcesada);
            return Ok(new { valor = resultado });
        }



        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _ProveedoresInsumosService.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var ProveedoresInsumos = await _ProveedoresInsumosService.Obtener(id);
            if (ProveedoresInsumos == null) return NotFound();

            var vm = new VMProveedoresInsumos
            {
                Id = ProveedoresInsumos.Id,
                Descripcion = ProveedoresInsumos.Descripcion,
                CostoUnitario = ProveedoresInsumos.CostoUnitario,
                FechaActualizacion = ProveedoresInsumos.FechaActualizacion,
                IdProveedor = ProveedoresInsumos.IdProveedor,
                Codigo = ProveedoresInsumos.Codigo,
                IdUsuarioRegistra = ProveedoresInsumos.IdUsuarioRegistra,
                FechaRegistra = ProveedoresInsumos.FechaRegistra,
                IdUsuarioModifica = ProveedoresInsumos.IdUsuarioModifica,
                FechaModifica = ProveedoresInsumos.FechaModifica,
                UsuarioRegistra = ProveedoresInsumos.IdUsuarioRegistraNavigation != null ? ProveedoresInsumos.IdUsuarioRegistraNavigation.Usuario : null,
                UsuarioModifica = ProveedoresInsumos.IdUsuarioModificaNavigation != null ? ProveedoresInsumos.IdUsuarioModificaNavigation.Usuario : null
            };

            return Ok(vm);
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