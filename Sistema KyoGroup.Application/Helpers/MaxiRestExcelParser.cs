using ClosedXML.Excel;
using SistemaKyoGroup.Models.Ventas;
using System.Globalization;
using System.Text.RegularExpressions;

namespace SistemaKyoGroup.Application.Helpers;

/// <summary>
/// Parser Maxi Rest RankingVentas.
/// Metadata fila 1-2: Informe/Empresa/Usuario/Fecha (D2 = fecha sugerida de venta).
/// Datos desde fila con headers Cantidad/DescripcionP/Total.
/// </summary>
public static class MaxiRestExcelParser
{
    public static VentaPreviewArchivoDto Parse(Stream stream, string fileName)
    {
        var preview = new VentaPreviewArchivoDto
        {
            FileKey = Guid.NewGuid().ToString("N"),
            NombreArchivo = fileName
        };

        try
        {
            using var wb = new XLWorkbook(stream);
            var ws = wb.Worksheets.First();
            var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
            if (lastRow < 4)
            {
                preview.Error = "El archivo no tiene filas de datos.";
                return preview;
            }

            preview.Informe = CellText(ws.Cell(2, 1));
            preview.Empresa = CellText(ws.Cell(2, 2));
            preview.UsuarioExport = CellText(ws.Cell(2, 3));
            preview.FechaExportacion = CellDate(ws.Cell(2, 4));
            preview.FechaSugerida = preview.FechaExportacion?.Date;

            if (string.IsNullOrWhiteSpace(preview.Informe))
                preview.Informe = CellText(ws.Cell(2, 1));

            var headerRow = FindHeaderRow(ws, lastRow);
            if (headerRow == 0)
            {
                preview.Error = "No se encontraron columnas Cantidad / DescripcionP / Total.";
                return preview;
            }

            var cols = MapColumns(ws, headerRow);
            if (!cols.ContainsKey("cantidad") || !cols.ContainsKey("descripcionp") || !cols.ContainsKey("total"))
            {
                preview.Error = "Faltan columnas obligatorias (Cantidad, DescripcionP, Total).";
                return preview;
            }

            for (var r = headerRow + 1; r <= lastRow; r++)
            {
                var desc = CellText(ws.Cell(r, cols["descripcionp"]));
                var codigo = cols.TryGetValue("producto", out var cProd) ? CellSku(ws.Cell(r, cProd)) : "";
                var cant = CellDecimal(ws.Cell(r, cols["cantidad"]));
                var total = CellDecimal(ws.Cell(r, cols["total"]));
                var precio = cols.TryGetValue("preciop", out var cPre) ? CellDecimal(ws.Cell(r, cPre)) : 0;
                var costo = cols.TryGetValue("costo", out var cCos) ? CellDecimal(ws.Cell(r, cCos)) : 0;
                var rubro = cols.TryGetValue("rubrop", out var cRub) ? CellText(ws.Cell(r, cRub)) : null;
                var rubroCod = cols.TryGetValue("rubro", out var cRubCod) ? CellInt(ws.Cell(r, cRubCod)) : null;

                if (string.IsNullOrWhiteSpace(desc) && string.IsNullOrWhiteSpace(codigo) && cant == 0 && total == 0)
                    continue;

                preview.Lineas.Add(new VentaPreviewLineaDto
                {
                    Codigo = codigo,
                    Descripcion = desc?.Trim() ?? "",
                    Rubro = string.IsNullOrWhiteSpace(rubro) ? null : rubro.Trim(),
                    RubroCodigo = rubroCod,
                    Cantidad = cant,
                    PrecioUnitario = precio,
                    Subtotal = total,
                    CostoUnitarioExcel = costo,
                    Incluir = false
                });
            }

            if (preview.Lineas.Count == 0)
                preview.Error = "No se encontraron líneas de venta en el archivo.";
        }
        catch (Exception ex)
        {
            preview.Error = "No se pudo leer el Excel: " + ex.Message;
        }

        return preview;
    }

    /// <summary>Producto de Maxi Rest = SKU del sistema (Receta.Sku).</summary>
    private static string CellSku(IXLCell cell)
    {
        try
        {
            if (cell.TryGetValue(out double d))
            {
                if (Math.Abs(d - Math.Truncate(d)) < 0.0000001)
                    return ((long)Math.Truncate(d)).ToString(CultureInfo.InvariantCulture);
                return d.ToString("0.########", CultureInfo.InvariantCulture);
            }
            if (cell.TryGetValue(out decimal m))
            {
                if (m == decimal.Truncate(m))
                    return decimal.Truncate(m).ToString(CultureInfo.InvariantCulture);
                return m.ToString("0.########", CultureInfo.InvariantCulture);
            }
        }
        catch { /* fall through */ }

        var t = CellText(cell);
        if (string.IsNullOrWhiteSpace(t)) return "";
        t = t.Trim();
        if (t.EndsWith(".0", StringComparison.Ordinal)) t = t[..^2];
        return t;
    }

    private static int FindHeaderRow(IXLWorksheet ws, int lastRow)
    {
        var max = Math.Min(lastRow, 20);
        for (var r = 1; r <= max; r++)
        {
            var texts = new List<string>();
            for (var c = 1; c <= 12; c++)
                texts.Add(NormalizeHeader(CellText(ws.Cell(r, c))));
            if (texts.Contains("cantidad") && texts.Any(t => t is "descripcionp" or "descripcion") && texts.Contains("total"))
                return r;
        }
        return 0;
    }

    private static Dictionary<string, int> MapColumns(IXLWorksheet ws, int headerRow)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var c = 1; c <= 15; c++)
        {
            var h = NormalizeHeader(CellText(ws.Cell(headerRow, c)));
            if (string.IsNullOrEmpty(h)) continue;
            if (!map.ContainsKey(h)) map[h] = c;
        }
        return map;
    }

    private static string NormalizeHeader(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        s = s.Trim().ToLowerInvariant();
        s = Regex.Replace(s, @"\s+", "");
        return s;
    }

    private static string CellText(IXLCell cell)
    {
        try
        {
            if (cell.IsEmpty()) return "";
            return cell.GetFormattedString()?.Trim() ?? cell.GetString()?.Trim() ?? "";
        }
        catch
        {
            try { return Convert.ToString(cell.Value, CultureInfo.InvariantCulture)?.Trim() ?? ""; }
            catch { return ""; }
        }
    }

    private static DateTime? CellDate(IXLCell cell)
    {
        try
        {
            if (cell.TryGetValue(out DateTime dt)) return dt;
            if (cell.TryGetValue(out double oa)) return DateTime.FromOADate(oa);
            var t = CellText(cell);
            if (DateTime.TryParse(t, new CultureInfo("es-AR"), DateTimeStyles.None, out var parsed))
                return parsed;
            if (DateTime.TryParse(t, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
                return parsed;
        }
        catch { /* ignore */ }
        return null;
    }

    private static decimal CellDecimal(IXLCell cell)
    {
        try
        {
            if (cell.TryGetValue(out double d)) return Convert.ToDecimal(d);
            if (cell.TryGetValue(out decimal m)) return m;
            var t = CellText(cell);
            if (string.IsNullOrWhiteSpace(t)) return 0;
            t = t.Replace("$", "").Replace(" ", "").Trim();
            // AR: 1.702.800,00 or 1,702,800.00
            if (t.Contains(',') && t.Contains('.'))
            {
                if (t.LastIndexOf(',') > t.LastIndexOf('.'))
                    t = t.Replace(".", "").Replace(',', '.');
                else
                    t = t.Replace(",", "");
            }
            else if (t.Contains(',') && !t.Contains('.'))
                t = t.Replace(',', '.');

            if (decimal.TryParse(t, NumberStyles.Any, CultureInfo.InvariantCulture, out var v))
                return v;
        }
        catch { /* ignore */ }
        return 0;
    }

    private static int? CellInt(IXLCell cell)
    {
        var d = CellDecimal(cell);
        if (d == 0 && string.IsNullOrWhiteSpace(CellText(cell))) return null;
        return (int)Math.Round(d);
    }
}
