using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Helpers;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models.Ventas;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class VentasController : Controller
{
    private readonly IVentasService _service;

    public VentasController(IVentasService service)
    {
        _service = service;
    }

    [AllowAnonymous]
    public IActionResult Index() => View();

    [AllowAnonymous]
    public IActionResult Importar() => View();

    [AllowAnonymous]
    public IActionResult Detalle(int id)
    {
        ViewBag.Id = id;
        return View();
    }

    [AllowAnonymous]
    public IActionResult Analisis() => View();

    [HttpGet]
    public async Task<IActionResult> ListaPaginada(DateTime? fechaDesde, DateTime? fechaHasta, int idLocal = 0, int idUnidadNegocio = 0)
    {
        var draw = DataTablesRequestHelper.GetDraw(Request);
        var grid = DataTablesRequestHelper.Parse(Request);
        var result = await _service.ListarPaginado(grid, fechaDesde, fechaHasta, idLocal, idUnidadNegocio);
        return Ok(new { draw, recordsTotal = result.Total, recordsFiltered = result.Filtered, data = result.Items });
    }

    [HttpGet]
    public async Task<IActionResult> Kpis(DateTime? fechaDesde, DateTime? fechaHasta)
        => Ok(await _service.ObtenerKpisIndex(fechaDesde, fechaHasta));

    [HttpGet]
    public async Task<IActionResult> ObtenerDetalle(int id)
    {
        var d = await _service.ObtenerDetalle(id);
        if (d == null) return NotFound();
        return Ok(d);
    }

    [HttpPost]
    public async Task<IActionResult> Eliminar([FromBody] IdRequest body)
    {
        var uid = User.GetUserId() ?? 0;
        if (uid <= 0) return Unauthorized();
        var ok = await _service.Eliminar(body.Id, uid);
        return Ok(new { valor = ok });
    }

    [HttpPost]
    [RequestSizeLimit(80_000_000)]
    public async Task<IActionResult> Previsualizar(List<IFormFile> files)
    {
        if (files == null || files.Count == 0)
            return BadRequest(new { mensaje = "No se recibieron archivos." });

        var list = new List<VentaPreviewArchivoDto>();
        foreach (var file in files)
        {
            if (file.Length == 0) continue;
            await using var stream = file.OpenReadStream();
            var parsed = MaxiRestExcelParser.Parse(stream, file.FileName);
            var enriched = await _service.EnriquecerPreviewAsync(parsed);
            list.Add(enriched);
        }
        return Ok(list);
    }

    [HttpPost]
    [RequestSizeLimit(80_000_000)]
    public async Task<IActionResult> ConfirmarImportacion([FromBody] VentaConfirmRequest request)
    {
        try
        {
            var uid = User.GetUserId() ?? 0;
            if (uid <= 0)
                return JsonConfirm(false, "Sesión expirada. Volvé a iniciar sesión.", 401);

            if (request?.Archivos == null || request.Archivos.Count == 0)
                return JsonConfirm(false, "Sin archivos para confirmar.", 400);

            // Asegura columnas / tabla Rubros antes de insertar
            await _service.EnsureSchemaAsync();

            var batch = await _service.ConfirmarImportacionAsync(
                request.Archivos,
                uid,
                request.ReemplazarSiExiste,
                request.CrearRubrosFaltantes);

            if (string.Equals(batch.Tipo, "rubrosFaltantes", StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new
                {
                    ok = false,
                    tipo = "rubrosFaltantes",
                    mensaje = batch.Mensaje,
                    rubrosFaltantes = batch.RubrosFaltantes,
                    id = (int?)null,
                    resultados = Array.Empty<VentaConfirmResultDto>()
                });
            }

            return Ok(new
            {
                ok = batch.Ok,
                mensaje = batch.Mensaje,
                id = batch.Id,
                resultados = batch.Resultados,
                archivosOk = batch.ArchivosOk,
                archivosNuevos = batch.ArchivosNuevos,
                archivosActualizados = batch.ArchivosActualizados,
                archivosError = batch.ArchivosError,
                lineasImportadas = batch.LineasImportadas
            });
        }
        catch (Exception ex)
        {
            return Ok(new
            {
                ok = false,
                mensaje = MensajeExcepcion(ex),
                id = (int?)null,
                resultados = Array.Empty<VentaConfirmResultDto>()
            });
        }
    }

    private IActionResult JsonConfirm(bool ok, string mensaje, int status)
        => StatusCode(status, new
        {
            ok,
            mensaje,
            id = (int?)null,
            resultados = Array.Empty<VentaConfirmResultDto>()
        });

    private static string MensajeExcepcion(Exception ex)
    {
        var cur = ex;
        while (cur.InnerException != null) cur = cur.InnerException;
        return string.IsNullOrWhiteSpace(cur.Message) ? ex.Message : cur.Message;
    }

    [HttpGet]
    public async Task<IActionResult> Resumen(DateTime? fechaDesde, DateTime? fechaHasta, int idLocal = 0, int idUnidadNegocio = 0)
        => Ok(await _service.Resumen(fechaDesde, fechaHasta, idLocal, idUnidadNegocio));

    [HttpGet]
    public async Task<IActionResult> SerieDiaria(DateTime? fechaDesde, DateTime? fechaHasta, int idLocal = 0, int idUnidadNegocio = 0)
        => Ok(await _service.SerieDiaria(fechaDesde, fechaHasta, idLocal, idUnidadNegocio));

    [HttpGet]
    public async Task<IActionResult> ComparativaLocales(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
        => Ok(await _service.ComparativaLocales(fechaDesde, fechaHasta, idUnidadNegocio));

    [HttpGet]
    public async Task<IActionResult> PorRubro(DateTime? fechaDesde, DateTime? fechaHasta, int idLocal = 0, int idUnidadNegocio = 0)
        => Ok(await _service.PorRubro(fechaDesde, fechaHasta, idLocal, idUnidadNegocio));

    [HttpGet]
    public async Task<IActionResult> TopProductos(DateTime? fechaDesde, DateTime? fechaHasta, int idLocal = 0, int idUnidadNegocio = 0, int top = 25)
        => Ok(await _service.TopProductos(fechaDesde, fechaHasta, idLocal, idUnidadNegocio, top));

    [HttpGet]
    public async Task<IActionResult> MatrizMensual(int anio, int mes, int idLocal = 0, int idUnidadNegocio = 0)
    {
        if (anio <= 0) anio = DateTime.Today.Year;
        if (mes < 1 || mes > 12) mes = DateTime.Today.Month;
        return Ok(await _service.MatrizMensual(anio, mes, idLocal, idUnidadNegocio));
    }

    public class IdRequest { public int Id { get; set; } }

    public class VentaConfirmRequest
    {
        public bool ReemplazarSiExiste { get; set; }
        public bool CrearRubrosFaltantes { get; set; }
        public List<VentaConfirmArchivoDto> Archivos { get; set; } = new();
    }
}
