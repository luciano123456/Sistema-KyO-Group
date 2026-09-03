using KyoGroup.Application.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Helpers;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

using System.Diagnostics;
using System.Linq;
using System.Globalization;
using System.Text;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class ProveedoresInsumosController : Controller
    {
        private readonly IProveedoresInsumoservice _ProveedoresInsumosService;
        private readonly SistemaKyoGroupContext _db;

        public ProveedoresInsumosController(
            IProveedoresInsumoservice ProveedoresInsumosService,
            SistemaKyoGroupContext db)
        {
            _ProveedoresInsumosService = ProveedoresInsumosService;
            _db = db;
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
                var proveedoresInsumos = IdProveedor > 0
                    ? await _ProveedoresInsumosService.ObtenerPorProveedor(IdProveedor)
                    : await _ProveedoresInsumosService.ObtenerTodos();

                var lista = proveedoresInsumos
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

        /// <summary>
        /// Lista de precios del proveedor lista para OC: todos los ítems (con o sin precio),
        /// resolviendo el Id de insumo de catálogo por vínculo o por descripción/SKU.
        /// No filtra por unidad de negocio (la UN de la OC no limita qué vende el proveedor).
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> ListaParaOrdenCompra([FromQuery] int IdProveedor, [FromQuery] int IdUnidadNegocio = 0)
        {
            if (IdProveedor <= 0)
                return BadRequest(new { valor = false, mensaje = "IdProveedor inválido." });

            try
            {
                var listas = await _db.ProveedoresInsumosListas
                    .AsNoTracking()
                    .Where(l => l.IdProveedor == IdProveedor)
                    .Include(l => l.InsumosProveedores)
                        .ThenInclude(ip => ip.IdInsumoNavigation)
                            .ThenInclude(i => i.InsumosUnidadesNegocios)
                    .OrderBy(l => l.Descripcion)
                    .ToListAsync();

                // Catálogo para match por descripción / SKU (preferir UN si viene)
                var insumosQuery = _db.Insumos
                    .AsNoTracking()
                    .Include(i => i.InsumosUnidadesNegocios)
                    .AsQueryable();

                var insumos = await insumosQuery.ToListAsync();

                var porDesc = insumos
                    .GroupBy(i => Normalizar(i.Descripcion))
                    .Where(g => !string.IsNullOrEmpty(g.Key))
                    .ToDictionary(g => g.Key, g => g.ToList());

                var porSku = insumos
                    .Where(i => !string.IsNullOrWhiteSpace(i.Sku))
                    .GroupBy(i => Normalizar(i.Sku!))
                    .Where(g => !string.IsNullOrEmpty(g.Key))
                    .ToDictionary(g => g.Key, g => g.First());

                Insumo? ElegirInsumo(IEnumerable<Insumo> candidates)
                {
                    var list = candidates?.Where(c => c != null).ToList() ?? new List<Insumo>();
                    if (list.Count == 0) return null;
                    if (IdUnidadNegocio > 0)
                    {
                        var enUn = list.FirstOrDefault(i =>
                            i.InsumosUnidadesNegocios != null &&
                            i.InsumosUnidadesNegocios.Any(u => u.IdUnidadNegocio == IdUnidadNegocio));
                        if (enUn != null) return enUn;
                    }
                    return list[0];
                }

                var resultado = new List<VMInsumo>();
                var idsInsumoUsados = new HashSet<int>();

                foreach (var lista in listas)
                {
                    Insumo? insumo = null;

                    // 1) Vínculo explícito Insumos_Proveedores
                    var vinculados = (lista.InsumosProveedores ?? Enumerable.Empty<InsumosProveedor>())
                        .Where(p => p.IdInsumoNavigation != null)
                        .Select(p => p.IdInsumoNavigation!)
                        .ToList();
                    insumo = ElegirInsumo(vinculados);

                    // 2) Match por código ↔ SKU
                    if (insumo == null && !string.IsNullOrWhiteSpace(lista.Codigo))
                    {
                        var key = Normalizar(lista.Codigo);
                        if (porSku.TryGetValue(key, out var bySku))
                            insumo = bySku;
                    }

                    // 3) Match por descripción
                    if (insumo == null)
                    {
                        var key = Normalizar(lista.Descripcion);
                        if (!string.IsNullOrEmpty(key) && porDesc.TryGetValue(key, out var byDesc))
                            insumo = ElegirInsumo(byDesc);
                    }

                    // Si ya devolvimos ese insumo de catálogo, no duplicar (salvo sin catálogo)
                    if (insumo != null && insumo.Id > 0 && !idsInsumoUsados.Add(insumo.Id))
                        continue;

                    resultado.Add(new VMInsumo
                    {
                        // Id = insumo de catálogo (0 si aún no está vinculado; el front lo maneja)
                        Id = insumo?.Id ?? 0,
                        Descripcion = string.IsNullOrWhiteSpace(lista.Descripcion)
                            ? (insumo?.Descripcion ?? $"Ítem #{lista.Id}")
                            : lista.Descripcion,
                        Sku = lista.Codigo ?? insumo?.Sku,
                        CostoUnitario = lista.CostoUnitario,
                        PrecioLista = lista.CostoUnitario,
                        IdProveedorLista = lista.Id,
                        CantidadProveedores = insumo != null ? 1 : 0
                    });
                }

                return Ok(resultado.OrderBy(x => x.Descripcion).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { valor = false, mensaje = ex.InnerException?.Message ?? ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> ListaPaginada([FromQuery] int IdProveedor = -1)
        {
            try
            {
                var draw = DataTablesRequestHelper.GetDraw(Request);
                var grid = DataTablesRequestHelper.Parse(Request);
                var result = await _ProveedoresInsumosService.ListarPaginado(IdProveedor, grid);
                var data = result.Items.Select(c => new VMProveedoresInsumos
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
                    Cantidad = c.Cantidad ?? 1,
                    Costo = c.Costo ?? 1,
                    PorcDesc = c.PorcDesc ?? 0
                }).ToList();

                return Ok(new
                {
                    draw,
                    recordsTotal = result.Total,
                    recordsFiltered = result.Filtered,
                    data
                });
            }
            catch
            {
                return Ok(new { draw = 0, recordsTotal = 0, recordsFiltered = 0, data = Array.Empty<VMProveedoresInsumos>() });
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

        /// <summary>
        /// Asegura un insumo de catálogo para un ítem de lista de precios (match o alta mínima + vínculo).
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> AsegurarInsumoCatalogo([FromBody] VMAsegurarInsumoCatalogo model)
        {
            if (model == null || model.IdListaProveedor <= 0)
                return BadRequest(new { valor = false, mensaje = "IdListaProveedor inválido." });

            try
            {
                var lista = await _db.ProveedoresInsumosListas
                    .Include(l => l.InsumosProveedores)
                    .FirstOrDefaultAsync(l => l.Id == model.IdListaProveedor);

                if (lista == null)
                    return NotFound(new { valor = false, mensaje = "Ítem de lista no encontrado." });

                // Ya vinculado
                var existenteLink = lista.InsumosProveedores?.FirstOrDefault();
                if (existenteLink != null && existenteLink.IdInsumo > 0)
                {
                    if (model.IdUnidadNegocio > 0)
                        await AsegurarUnidadNegocioInsumo(existenteLink.IdInsumo, model.IdUnidadNegocio);
                    return Ok(new { valor = true, idInsumo = existenteLink.IdInsumo, idProveedorLista = lista.Id });
                }

                var userId = User.GetUserId() ?? 1;
                var normDesc = Normalizar(lista.Descripcion);
                var normCodigo = Normalizar(lista.Codigo ?? "");

                // Match por SKU / descripción
                Insumo? insumo = null;
                if (!string.IsNullOrEmpty(normCodigo))
                {
                    insumo = await _db.Insumos.AsNoTracking()
                        .FirstOrDefaultAsync(i => i.Sku != null && i.Sku.ToUpper() == lista.Codigo!.Trim().ToUpper());
                }
                if (insumo == null && !string.IsNullOrEmpty(normDesc))
                {
                    var candidatos = await _db.Insumos.AsNoTracking().ToListAsync();
                    insumo = candidatos.FirstOrDefault(i => Normalizar(i.Descripcion) == normDesc);
                }

                if (insumo == null)
                {
                    var idCat = await _db.InsumosCategorias.AsNoTracking().Select(c => c.Id).FirstOrDefaultAsync();
                    var idUm = await _db.UnidadesMedida.AsNoTracking().Select(u => u.Id).FirstOrDefaultAsync();
                    if (idCat <= 0 || idUm <= 0)
                        return BadRequest(new { valor = false, mensaje = "No hay categoría o unidad de medida para crear el insumo." });

                    var sku = !string.IsNullOrWhiteSpace(lista.Codigo)
                        ? lista.Codigo.Trim()
                        : $"PL-{lista.Id}";

                    // Evitar SKU duplicado
                    var skuBase = sku;
                    var n = 1;
                    while (await _db.Insumos.AnyAsync(i => i.Sku == sku))
                        sku = $"{skuBase}-{n++}";

                    insumo = new Insumo
                    {
                        Sku = sku,
                        Descripcion = string.IsNullOrWhiteSpace(lista.Descripcion) ? sku : lista.Descripcion.Trim(),
                        IdCategoria = idCat,
                        IdUnidadMedida = idUm,
                        FechaActualizacion = DateTime.Now,
                        IdUsuarioRegistra = userId,
                        FechaRegistra = DateTime.Now
                    };
                    _db.Insumos.Add(insumo);
                    await _db.SaveChangesAsync();
                }

                // Vínculo lista ↔ insumo
                if (!await _db.InsumosProveedores.AnyAsync(p =>
                        p.IdInsumo == insumo.Id && p.IdListaProveedor == lista.Id))
                {
                    _db.InsumosProveedores.Add(new InsumosProveedor
                    {
                        IdInsumo = insumo.Id,
                        IdProveedor = lista.IdProveedor,
                        IdListaProveedor = lista.Id
                    });
                    await _db.SaveChangesAsync();
                }

                if (model.IdUnidadNegocio > 0)
                    await AsegurarUnidadNegocioInsumo(insumo.Id, model.IdUnidadNegocio);

                return Ok(new { valor = true, idInsumo = insumo.Id, idProveedorLista = lista.Id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { valor = false, mensaje = ex.InnerException?.Message ?? ex.Message });
            }
        }

        async Task AsegurarUnidadNegocioInsumo(int idInsumo, int idUnidadNegocio)
        {
            if (idInsumo <= 0 || idUnidadNegocio <= 0) return;
            var existe = await _db.InsumosUnidadesNegocios
                .AnyAsync(x => x.IdInsumo == idInsumo && x.IdUnidadNegocio == idUnidadNegocio);
            if (existe) return;
            _db.InsumosUnidadesNegocios.Add(new InsumosUnidadesNegocio
            {
                IdInsumo = idInsumo,
                IdUnidadNegocio = idUnidadNegocio
            });
            await _db.SaveChangesAsync();
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id, bool cascade = false)
        {
            var sr = await DeleteOperationHelper.ExecuteDeleteAsync(
                c => _ProveedoresInsumosService.Eliminar(id, c),
                "el ítem de lista",
                cascade,
                id);
            return Ok(sr.ToEliminarJson());
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

        [HttpGet]
        public async Task<IActionResult> Historial(int id)
        {
            if (id <= 0)
                return Ok(Array.Empty<object>());

            var items = await ProveedoresInsumosHistorialHelper.ListarPorListaAsync(_db, id);
            return Ok(MapHistorial(items));
        }

        [HttpGet]
        public async Task<IActionResult> HistorialProveedor(int idProveedor)
        {
            if (idProveedor <= 0)
                return Ok(Array.Empty<object>());

            var items = await ProveedoresInsumosHistorialHelper.ListarPorProveedorAsync(_db, idProveedor, 150);
            return Ok(MapHistorial(items));
        }

        private static IEnumerable<object> MapHistorial(IEnumerable<ProveedoresInsumosListaHistorial> items)
        {
            return items.Select(h =>
            {
                decimal? VarPct(decimal? a, decimal? n)
                {
                    if (a is null || n is null) return null;
                    if (Math.Abs(a.Value) < 0.0000001m) return n.Value == 0 ? 0 : 100m;
                    return Math.Round(((n.Value - a.Value) / a.Value) * 100m, 2);
                }

                return new
                {
                    h.Id,
                    h.IdLista,
                    h.IdProveedor,
                    h.Accion,
                    h.Origen,
                    h.Resumen,
                    h.Detalle,
                    h.CostoAnterior,
                    h.CostoNuevo,
                    h.CostoUnitarioAnterior,
                    h.CostoUnitarioNuevo,
                    h.CantidadAnterior,
                    h.CantidadNueva,
                    h.PorcDescAnterior,
                    h.PorcDescNuevo,
                    VariacionCostoPct = VarPct(h.CostoAnterior, h.CostoNuevo),
                    VariacionUnitarioPct = VarPct(h.CostoUnitarioAnterior, h.CostoUnitarioNuevo),
                    h.IdUsuario,
                    h.UsuarioNombre,
                    h.Fecha
                };
            });
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