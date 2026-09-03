using SistemaKyoGroup.DAL.Grid;

using SistemaKyoGroup.DAL.Repository;

using SistemaKyoGroup.Models;

using SistemaKyoGroup.Models.Ventas;

using System.Globalization;

using System.Text;

using System.Text.RegularExpressions;



namespace SistemaKyoGroup.BLL.Service;



public class VentasService : IVentasService
{
    private readonly IVentasRepository _repo;
    private readonly IRubrosRepository<Rubro> _rubros;

    public VentasService(IVentasRepository repo, IRubrosRepository<Rubro> rubros)
    {
        _repo = repo;
        _rubros = rubros;
    }



    public Task EnsureSchemaAsync() => _repo.EnsureSchemaAsync();

    public async Task<VentaConfirmBatchResultDto> ConfirmarImportacionAsync(
        IEnumerable<VentaConfirmArchivoDto> archivos,
        int idUsuario,
        bool reemplazarSiExiste,
        bool crearRubrosFaltantes)
    {
        await _repo.EnsureSchemaAsync();
        var list = archivos?.Where(a => a != null).ToList() ?? new List<VentaConfirmArchivoDto>();
        if (list.Count == 0)
            return new VentaConfirmBatchResultDto { Ok = false, Mensaje = "Sin archivos para confirmar." };

        var nombresRubro = list
            .SelectMany(a => a.Lineas ?? new List<VentaConfirmLineaDto>())
            .Select(l => (l.Rubro ?? "").Trim())
            .Where(r => r.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(r => r, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var existentesNorm = (await _rubros.ObtenerNombresNormalizadosAsync()).ToHashSet(StringComparer.Ordinal);
        var faltantes = nombresRubro
            .Where(n => !existentesNorm.Contains(RubrosRepository.NormalizarNombre(n)))
            .ToList();

        if (faltantes.Count > 0 && !crearRubrosFaltantes)
        {
            return new VentaConfirmBatchResultDto
            {
                Ok = false,
                Tipo = "rubrosFaltantes",
                Mensaje = $"Hay {faltantes.Count} rubro(s) que no existen en el sistema.",
                RubrosFaltantes = faltantes
            };
        }

        if (faltantes.Count > 0 && crearRubrosFaltantes)
            await _rubros.CrearSiNoExistenAsync(faltantes);

        // Recargar mapa para anidar IdRubro en memoria (texto ya va en la línea)
        var rubrosDb = await _rubros.ListarAsync();
        var mapRubro = rubrosDb
            .GroupBy(r => RubrosRepository.NormalizarNombre(r.Nombre))
            .Where(g => g.Key.Length > 0)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

        var results = new List<VentaConfirmResultDto>();
        foreach (var archivo in list)
        {
            try
            {
                // Normalizar nombres de rubro al nombre canónico del catálogo
                foreach (var linea in archivo.Lineas ?? new List<VentaConfirmLineaDto>())
                {
                    var key = RubrosRepository.NormalizarNombre(linea.Rubro);
                    if (key.Length > 0 && mapRubro.TryGetValue(key, out var rubroCat))
                        linea.Rubro = rubroCat.Nombre;
                }
                results.Add(await ConfirmarArchivoAsync(archivo, idUsuario, reemplazarSiExiste));
            }
            catch (Exception ex)
            {
                results.Add(new VentaConfirmResultDto
                {
                    NombreArchivo = archivo.NombreArchivo ?? "",
                    Ok = false,
                    Error = ex.GetBaseException().Message
                });
            }
        }

        var ok = results.Count > 0 && results.Any(r => r.Ok);
        var nuevos = results.Count(r => r.Ok && !r.Reemplazo);
        var actualizados = results.Count(r => r.Ok && r.Reemplazo);
        var errores = results.Count(r => !r.Ok);
        var lineas = results.Where(r => r.Ok).Sum(r => r.Lineas);

        string mensaje;
        if (ok && errores == 0)
        {
            var partes = new List<string>();
            if (faltantes.Count > 0)
                partes.Add($"Se crearon {faltantes.Count} rubro(s)");
            if (nuevos > 0 && actualizados == 0)
                partes.Add(nuevos == 1
                    ? $"se importó 1 archivo de ventas ({lineas} líneas)"
                    : $"se importaron {nuevos} archivos de ventas ({lineas} líneas)");
            else if (actualizados > 0 && nuevos == 0)
                partes.Add(actualizados == 1
                    ? $"se actualizó 1 importación que ya estaba en el sistema ({lineas} líneas)"
                    : $"se actualizaron {actualizados} importaciones que ya estaban en el sistema ({lineas} líneas)");
            else
                partes.Add($"se importaron {nuevos} nuevas y se actualizaron {actualizados} que ya existían ({lineas} líneas en total)");
            mensaje = string.Join("; ", partes) + ".";
            if (mensaje.Length > 0)
                mensaje = char.ToUpper(mensaje[0]) + mensaje[1..];
        }
        else if (ok && errores > 0)
        {
            mensaje = $"Se importaron {nuevos + actualizados} archivo(s) ({lineas} líneas). {errores} no se pudieron procesar.";
        }
        else if (results.Count > 0 && results.All(r => !r.Ok))
        {
            mensaje = results.FirstOrDefault()?.Error
                ?? "No se pudo importar ninguna venta.";
        }
        else
        {
            mensaje = "No había ventas para importar.";
        }

        return new VentaConfirmBatchResultDto
        {
            Ok = ok,
            Mensaje = mensaje,
            Resultados = results,
            Id = results.FirstOrDefault(r => r.Ok)?.Id,
            ArchivosOk = nuevos + actualizados,
            ArchivosNuevos = nuevos,
            ArchivosActualizados = actualizados,
            ArchivosError = errores,
            LineasImportadas = lineas
        };
    }

    public Task<GridResult<VentaImportacionListItem>> ListarPaginado(GridQuery query, DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio)

        => _repo.ListarPaginado(query, desde, hasta, idLocal, idUnidadNegocio);



    public Task<VentaKpiIndexDto> ObtenerKpisIndex(DateTime? desde, DateTime? hasta)

        => _repo.ObtenerKpisIndexAsync(desde, hasta);



    public Task<VentaImportacionDetalleDto?> ObtenerDetalle(int id)

        => _repo.ObtenerDetalleAsync(id);



    public Task<bool> Eliminar(int id, int idUsuario)

        => _repo.EliminarAsync(id, idUsuario);



    public Task<VentaResumenDto> Resumen(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio)

        => _repo.ObtenerResumenAsync(desde, hasta, idLocal, idUnidadNegocio);



    public Task<List<VentaSeriePunto>> SerieDiaria(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio)

        => _repo.ObtenerSerieDiariaAsync(desde, hasta, idLocal, idUnidadNegocio);



    public Task<List<VentaSeriePunto>> ComparativaLocales(DateTime? desde, DateTime? hasta, int idUnidadNegocio)

        => _repo.ObtenerComparativaLocalesAsync(desde, hasta, idUnidadNegocio);



    public Task<List<VentaRubroPunto>> PorRubro(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio)

        => _repo.ObtenerPorRubroAsync(desde, hasta, idLocal, idUnidadNegocio);



    public Task<List<VentaTopProducto>> TopProductos(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio, int top = 25)

        => _repo.ObtenerTopProductosAsync(desde, hasta, idLocal, idUnidadNegocio, top);



    public Task<VentaMatrizMensualDto> MatrizMensual(int anio, int mes, int idLocal, int idUnidadNegocio)

        => _repo.ObtenerMatrizMensualAsync(anio, mes, idLocal, idUnidadNegocio);



    public async Task<VentaPreviewArchivoDto> EnriquecerPreviewAsync(VentaPreviewArchivoDto preview)

    {

        if (!string.IsNullOrEmpty(preview.Error)) return preview;



        var locales = await _repo.ListarLocalesAsync();

        SugerirLocalDesdeNombre(preview, locales);



        if (preview.FechaSugerida.HasValue && preview.IdLocalSugerido is > 0)

        {

            var existente = await _repo.ObtenerPorLocalFechaAsync(preview.IdLocalSugerido.Value, preview.FechaSugerida.Value);

            if (existente != null)

            {

                preview.YaExiste = true;

                preview.IdImportacionExistente = existente.Id;

            }

        }



        var recetas = await _repo.MapRecetasPorSkuAsync(preview.IdUnidadNegocioSugerido);

        var insumos = await _repo.MapInsumosPorSkuAsync(preview.IdUnidadNegocioSugerido);

        var temp = 1;

        foreach (var linea in preview.Lineas)

        {

            linea.TempId = temp++;

            AplicarVinculo(linea, recetas, insumos);

            linea.Incluir = linea.Matched;



            var esperado = Math.Round(linea.Cantidad * linea.PrecioUnitario, 2);

            if (linea.Subtotal > 0 && Math.Abs(esperado - linea.Subtotal) > 1m)

                linea.Warning = $"Subtotal distinto de cant×precio ({esperado:0.##})";

        }


        preview.Lineas = preview.Lineas

            .Select((l, i) => (l, i))

            .OrderBy(x => x.l.Matched ? 0 : 1)

            .ThenByDescending(x => x.l.Subtotal)

            .ThenBy(x => x.i)

            .Select(x => x.l)

            .ToList();



        RecalcularTotalesPreview(preview);

        return preview;

    }



    public async Task<VentaConfirmResultDto> ConfirmarArchivoAsync(VentaConfirmArchivoDto archivo, int idUsuario, bool reemplazarSiExiste)

    {

        var result = new VentaConfirmResultDto { NombreArchivo = archivo?.NombreArchivo ?? "" };

        try

        {

        if (archivo == null)

        {

            result.Error = "Archivo inválido.";

            return result;

        }

        if (archivo.IdLocal <= 0)

        {

            result.Error = "Debés seleccionar un local.";

            return result;

        }

        if (archivo.Fecha == default)

        {

            result.Error = "Debés indicar la fecha de venta.";

            return result;

        }

        if (archivo.Lineas == null || archivo.Lineas.Count == 0)

        {

            result.Error = "No hay líneas para importar.";

            return result;

        }



        var local = (await _repo.ListarLocalesAsync()).FirstOrDefault(l => l.Id == archivo.IdLocal);

        if (local == null)

        {

            result.Error = "Local inválido.";

            return result;

        }



        var idUn = archivo.IdUnidadNegocio > 0 ? archivo.IdUnidadNegocio : (local.IdUnidadNegocio ?? 0);

        if (idUn <= 0)

        {

            result.Error = "El local no tiene unidad de negocio.";

            return result;

        }



        var idTipo = await _repo.ObtenerIdTipoMaxiRestAsync();

        var recetas = await _repo.MapRecetasPorSkuAsync(idUn);

        var insumos = await _repo.MapInsumosPorSkuAsync(idUn);

        var ahora = DateTime.Now;



        var cabecera = new Importacion

        {

            IdTipo = idTipo,

            IdLocal = archivo.IdLocal,

            IdUnidadNegocio = idUn,

            Fecha = archivo.Fecha.Date,

            NombreArchivo = archivo.NombreArchivo ?? "",

            IdUsuario = idUsuario,

            IdUsuarioRegistra = idUsuario,

            FechaRegistra = ahora

        };



        var lineas = new List<ImportacionesReceta>();

        foreach (var src in archivo.Lineas)

        {

            var linea = new ImportacionesReceta

            {

                Codigo = VentasRepository.NormalizeSku(src.Codigo),

                Descripcion = Trunc(src.Descripcion, 250),

                Rubro = Trunc(src.Rubro, 100),

                RubroCodigo = src.RubroCodigo,

                Cantidad = src.Cantidad,

                PrecioUnitario = src.PrecioUnitario,

                Subtotal = src.Subtotal > 0 ? src.Subtotal : Math.Round(src.Cantidad * src.PrecioUnitario, 2),

                IdUsuarioRegistra = idUsuario,

                FechaRegistra = ahora,

                IdMovInventario = null,

                IdReceta = null,

                IdInsumo = null,

                Matched = false,

                TipoVinculo = VentaTipoVinculo.Ninguno

            };



            var sku = VentasRepository.NormalizeSku(linea.Codigo);

            if (recetas.TryGetValue(sku, out var receta))

            {

                AplicarRecetaALinea(linea, receta, idUsuario, ahora);

            }

            else if (insumos.TryGetValue(sku, out var insumo))

            {

                AplicarInsumoALinea(linea, insumo, idUsuario, ahora);

            }

            else

            {

                linea.Matched = false;

                linea.IdReceta = null;

                linea.IdInsumo = null;

                linea.TipoVinculo = VentaTipoVinculo.Ninguno;

                linea.CostoUnitario = src.CostoUnitarioExcel;

                linea.SubtotalCosto = Math.Round(src.CostoUnitarioExcel * linea.Cantidad, 2);

                linea.Ganancia = linea.Subtotal - linea.SubtotalCosto;

            }



            lineas.Add(linea);

        }



        var (ok, id, error, reemplazo) = await _repo.GuardarImportacionAsync(cabecera, lineas, true, idUsuario);

        result.Ok = ok;

        result.Id = ok ? id : null;

        result.Error = error;

        result.Reemplazo = reemplazo;

        result.Lineas = ok ? lineas.Count : 0;

        return result;

        }

        catch (Exception ex)

        {

            result.Ok = false;

            var cur = ex;

            while (cur.InnerException != null) cur = cur.InnerException;

            result.Error = string.IsNullOrWhiteSpace(cur.Message) ? ex.Message : cur.Message;

            return result;

        }

    }



    private static void AplicarRecetaALinea(ImportacionesReceta linea, Receta receta, int idUsuario, DateTime ahora)

    {

        linea.Matched = true;

        linea.IdReceta = receta.Id;

        linea.IdInsumo = null;

        linea.TipoVinculo = VentaTipoVinculo.Receta;

        var costoU = receta.CostoUnitario ?? receta.CostoPorcion;

        linea.CostoUnitario = costoU;

        linea.SubtotalCosto = Math.Round(costoU * linea.Cantidad, 2);

        linea.Ganancia = linea.Subtotal - linea.SubtotalCosto;



        foreach (var ri in receta.RecetasInsumos ?? Enumerable.Empty<RecetasInsumo>())

        {

            if (ri.IdInsumo <= 0) continue;

            var cant = ri.Cantidad * linea.Cantidad;

            linea.ImportacionesInsumos.Add(new ImportacionesInsumo

            {

                IdInsumo = ri.IdInsumo,

                Cantidad = cant,

                CostoUnitario = ri.CostoUnitario,

                Subtotal = Math.Round(ri.CostoUnitario * cant, 2),

                IdMovInventario = null,

                IdUsuarioRegistra = idUsuario,

                FechaRegistra = ahora

            });

        }

        foreach (var rs in receta.RecetasSubReceta ?? Enumerable.Empty<RecetasSubReceta>())

        {

            if (rs.IdSubReceta <= 0) continue;

            var cant = rs.Cantidad * linea.Cantidad;

            linea.ImportacionesSubReceta.Add(new ImportacionesSubReceta

            {

                IdSubReceta = rs.IdSubReceta,

                Cantidad = cant,

                CostoUnitario = rs.CostoUnitario,

                Subtotal = Math.Round(rs.CostoUnitario * cant, 2),

                IdMovInventario = null,

                IdUsuarioRegistra = idUsuario,

                FechaRegistra = ahora

            });

        }

    }



    private static void AplicarInsumoALinea(ImportacionesReceta linea, InsumoMatchInfo insumo, int idUsuario, DateTime ahora)

    {

        linea.Matched = true;

        linea.IdReceta = null;

        linea.IdInsumo = insumo.Id;

        linea.TipoVinculo = VentaTipoVinculo.Insumo;

        linea.CostoUnitario = insumo.CostoUnitario;

        linea.SubtotalCosto = Math.Round(insumo.CostoUnitario * linea.Cantidad, 2);

        linea.Ganancia = linea.Subtotal - linea.SubtotalCosto;



        linea.ImportacionesInsumos.Add(new ImportacionesInsumo

        {

            IdInsumo = insumo.Id,

            Cantidad = linea.Cantidad,

            CostoUnitario = insumo.CostoUnitario,

            Subtotal = Math.Round(insumo.CostoUnitario * linea.Cantidad, 2),

            IdMovInventario = null,

            IdUsuarioRegistra = idUsuario,

            FechaRegistra = ahora

        });

    }



    private static void AplicarVinculo(

        VentaPreviewLineaDto linea,

        Dictionary<string, Receta> recetas,

        Dictionary<string, InsumoMatchInfo> insumos)

    {

        var sku = VentasRepository.NormalizeSku(linea.Codigo);

        if (recetas.TryGetValue(sku, out var receta))

        {

            linea.Matched = true;

            linea.IdReceta = receta.Id;

            linea.IdInsumo = null;

            linea.TipoVinculo = VentaTipoVinculo.Receta;

            var costoU = receta.CostoUnitario ?? receta.CostoPorcion;

            linea.CostoUnitarioSistema = costoU;

            linea.SubtotalCosto = Math.Round(costoU * linea.Cantidad, 2);

            linea.Ganancia = linea.Subtotal - linea.SubtotalCosto;

            return;

        }



        if (insumos.TryGetValue(sku, out var insumo))

        {

            linea.Matched = true;

            linea.IdReceta = null;

            linea.IdInsumo = insumo.Id;

            linea.TipoVinculo = VentaTipoVinculo.Insumo;

            linea.CostoUnitarioSistema = insumo.CostoUnitario;

            linea.SubtotalCosto = Math.Round(insumo.CostoUnitario * linea.Cantidad, 2);

            linea.Ganancia = linea.Subtotal - linea.SubtotalCosto;

            return;

        }



        linea.Matched = false;

        linea.IdReceta = null;

        linea.IdInsumo = null;

        linea.TipoVinculo = VentaTipoVinculo.Ninguno;

        linea.CostoUnitarioSistema = linea.CostoUnitarioExcel;

        linea.SubtotalCosto = Math.Round(linea.CostoUnitarioExcel * linea.Cantidad, 2);

        linea.Ganancia = linea.Subtotal - linea.SubtotalCosto;

    }



    private static void RecalcularTotalesPreview(VentaPreviewArchivoDto preview)

    {

        var incluidas = preview.Lineas.Where(l => l.Incluir).ToList();

        preview.CantidadLineas = incluidas.Count;

        preview.LineasMatched = incluidas.Count(l => l.Matched);

        preview.TotalVenta = incluidas.Sum(l => l.Subtotal);

        preview.TotalCosto = incluidas.Sum(l => l.SubtotalCosto);

    }



    private static void SugerirLocalDesdeNombre(VentaPreviewArchivoDto preview, List<Local> locales)

    {

        if (preview.IdLocalSugerido is > 0) return;

        var name = Path.GetFileNameWithoutExtension(preview.NombreArchivo ?? "");

        name = Regex.Replace(name, @"\(\d+\)\s*$", "").Trim();

        name = Regex.Replace(name, @"\d{1,2}[-/]\d{1,2}.*$", "").Trim();

        if (string.IsNullOrWhiteSpace(name)) return;



        var norm = Normalize(name);

        var match = locales.FirstOrDefault(l => Normalize(l.Nombre ?? "").Contains(norm) || norm.Contains(Normalize(l.Nombre ?? "")));

        if (match == null)

            match = locales.FirstOrDefault(l => Normalize(l.Nombre ?? "").Split(' ').Any(p => p.Length > 2 && norm.Contains(p)));



        if (match != null)

        {

            preview.IdLocalSugerido = match.Id;

            preview.LocalSugeridoNombre = match.Nombre;

            preview.IdUnidadNegocioSugerido = match.IdUnidadNegocio;

        }

    }



    private static string Normalize(string s)

    {

        if (string.IsNullOrWhiteSpace(s)) return "";

        var form = s.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);

        var sb = new StringBuilder();

        foreach (var c in form)

        {

            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)

                sb.Append(c);

        }

        return sb.ToString().Normalize(NormalizationForm.FormC);

    }



    private static string Trunc(string? v, int max)

    {

        if (string.IsNullOrEmpty(v)) return "";

        return v.Length <= max ? v : v[..max];

    }

}

