using KyoGroup.Application.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;

using System.Diagnostics;
using System.Globalization;
using System.Text;

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
        [ProducesResponseType(typeof(List<VMProveedoresInsumos>), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Lista([FromQuery] int IdProveedor)
        {
            // 1) Validación simple de entrada -> 400
            // (Ej.: si solo aceptás -1 o ids positivos)
            if (IdProveedor < -1)
            {
                // BadRequest (400) con ProblemDetails
                return Problem(
                    detail: "El parámetro IdProveedor es inválido. Debe ser -1 (todos) o un Id positivo.",
                    title: "Parámetro inválido",
                    statusCode: StatusCodes.Status400BadRequest
                );
            }

            try
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
                        IdUsuarioRegistra = (int)c.IdUsuarioRegistra,
                        FechaRegistra = (DateTime)c.FechaRegistra,
                        IdUsuarioModifica = c.IdUsuarioModifica,
                        FechaModifica = c.FechaModifica,
                        UsuarioRegistra = c.IdUsuarioRegistraNavigation != null ? c.IdUsuarioRegistraNavigation.Usuario : null,
                        UsuarioModifica = c.IdUsuarioModificaNavigation != null ? c.IdUsuarioModificaNavigation.Usuario : null,
                        Cantidad = c.Cantidad != null? c.Cantidad : 1,
                        Costo = c.Costo != null ? c.Costo : 1,
                        PorcDesc = c.PorcDesc != null ? c.PorcDesc : 0
                    })
                    .ToList();

                return Ok(lista);
            }
            catch (ArgumentException ex) // errores de dominio/validación → 400
            {
                // Opcional: _logger.LogWarning(ex, "Argumento inválido en Lista(IdProveedor={IdProveedor})", IdProveedor);
                return Problem(
                    detail: ex.Message,
                    title: "Solicitud inválida",
                    statusCode: StatusCodes.Status400BadRequest
                );
            }
            catch (Exception ex) // errores inesperados → 500
            {
                return Problem(
                    detail: "Ocurrió un error interno al procesar la solicitud.",
                    title: "Error interno del servidor",
                    statusCode: StatusCodes.Status500InternalServerError
                );
            }
        }


        [HttpPost]
        public async Task<IActionResult> Comparar([FromBody] VMImportacionProveedoresInsumos model)
        {
            if (model == null || model.IdProveedor <= 0)
                return BadRequest("Datos incompletos");

            try
            {
                // Debe devolver entidades de ProveedoresInsumosLista para ese proveedor
                var existentes = await _ProveedoresInsumosService.ObtenerPorProveedor(model.IdProveedor);

                // Mandamos al front SOLO datos crudos; el front hace el match y la comparación
                var dto = existentes.Select(x => new
                {
                    Codigo = x.Codigo ?? string.Empty,
                    Descripcion = x.Descripcion ?? string.Empty,
                    Costo = x.Costo ?? 0m,
                    Cantidad = x.Cantidad ?? 0m,
                    PorcDesc = x.PorcDesc ?? 0,
                    CostoUnitario = x.CostoUnitario
                }).ToList();

                return Ok(dto);
            }
            catch (Exception)
            {
                // TODO: log ex
                return StatusCode(500, "No se pudo obtener la lista del proveedor.");
            }
        }



        // -----------------------
        // Helpers internos
        // -----------------------
        static string Normalizar(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return string.Empty;
            var norm = s.Trim().ToUpperInvariant()
                .Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();
            foreach (var c in norm)
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                    sb.Append(c);
            return sb.ToString()
                     .Replace("  ", " ")
                     .Trim();
        }

        static bool Eq(decimal a, decimal b, decimal eps = 0.0001m) => Math.Abs(a - b) <= eps;


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
                FechaRegistra = DateTime.Now,
                Cantidad = model.Cantidad != null ? model.Cantidad : 1,
                Costo = model.Costo,
                PorcDesc = model.PorcDesc != null ? model.PorcDesc : 0
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
                FechaModifica = DateTime.Now,
                Cantidad = model.Cantidad,
                Costo = model.Costo,
                PorcDesc = model.PorcDesc
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
                Costo = x.Costo,
                FechaActualizacion = DateTime.Now,
                IdUsuarioRegistra = (int)userId, // fallback si hicieras pruebas sin token
                Cantidad = x.Cantidad != null ? x.Cantidad : 1,
                PorcDesc = x.PorcDesc != null ? x.PorcDesc : 0,
                FechaRegistra = DateTime.Now,
               
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
                IdUsuarioRegistra = (int)ProveedoresInsumos.IdUsuarioRegistra,
                FechaRegistra = (DateTime)ProveedoresInsumos.FechaRegistra,
                IdUsuarioModifica = ProveedoresInsumos.IdUsuarioModifica,
                FechaModifica = ProveedoresInsumos.FechaModifica,
                UsuarioRegistra = ProveedoresInsumos.IdUsuarioRegistraNavigation != null ? ProveedoresInsumos.IdUsuarioRegistraNavigation.Usuario : null,
                UsuarioModifica = ProveedoresInsumos.IdUsuarioModificaNavigation != null ? ProveedoresInsumos.IdUsuarioModificaNavigation.Usuario : null,
                Cantidad = ProveedoresInsumos.Cantidad,
                Costo = ProveedoresInsumos.Costo,
                PorcDesc = ProveedoresInsumos.PorcDesc
            };

            return Ok(vm);
        }

        [HttpPost]
        public async Task<IActionResult> EliminarMasivo([FromBody] VMProveedoresInsumosMasivo payload)
        {
            if (payload == null || payload.ids == null || payload.ids.Count == 0)
                return BadRequest(new { valor = false, mensaje = "Sin IDs" });

            var ok = await _ProveedoresInsumosService.EliminarMasivo(payload.ids);
            return Ok(new { valor = ok });
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