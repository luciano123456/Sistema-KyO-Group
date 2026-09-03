namespace SistemaKyoGroup.Models.Ventas;

public static class VentaTipoVinculo
{
    public const string Receta = "Receta";
    public const string Insumo = "Insumo";
    public const string Ninguno = "Ninguno";
}

public class InsumoMatchInfo
{
    public int Id { get; set; }
    public decimal CostoUnitario { get; set; }
}

public class VentaImportacionListItem
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; }
    public int IdLocal { get; set; }
    public string LocalNombre { get; set; } = "";
    public int IdUnidadNegocio { get; set; }
    public string UnidadNegocioNombre { get; set; } = "";
    public string NombreArchivo { get; set; } = "";
    public int CantidadItems { get; set; }
    public int ItemsMatched { get; set; }
    public decimal TotalVenta { get; set; }
    public decimal TotalCosto { get; set; }
    public decimal TotalGanancia { get; set; }
    public decimal PorcentajeMatch { get; set; }
    public string? UsuarioNombre { get; set; }
    public DateTime FechaRegistra { get; set; }
}

public class VentaImportacionDetalleDto
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; }
    public int IdLocal { get; set; }
    public string LocalNombre { get; set; } = "";
    public int IdUnidadNegocio { get; set; }
    public string UnidadNegocioNombre { get; set; } = "";
    public string NombreArchivo { get; set; } = "";
    public string? UsuarioNombre { get; set; }
    public DateTime FechaRegistra { get; set; }
    public decimal TotalVenta { get; set; }
    public decimal TotalCosto { get; set; }
    public decimal TotalGanancia { get; set; }
    public int CantidadItems { get; set; }
    public int ItemsMatched { get; set; }
    public List<VentaLineaDto> Lineas { get; set; } = new();
}

public class VentaLineaDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string? Rubro { get; set; }
    public int? RubroCodigo { get; set; }
    public decimal Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }
    public decimal CostoUnitario { get; set; }
    public decimal SubtotalCosto { get; set; }
    public decimal Ganancia { get; set; }
    public bool Matched { get; set; }
    public int? IdReceta { get; set; }
    public int? IdInsumo { get; set; }
    public string TipoVinculo { get; set; } = VentaTipoVinculo.Ninguno;
}

public class VentaResumenDto
{
    public decimal TotalVenta { get; set; }
    public decimal TotalCosto { get; set; }
    public decimal TotalGanancia { get; set; }
    public decimal MargenPct { get; set; }
    public int DiasCargados { get; set; }
    public int LocalesConDatos { get; set; }
    public int ItemsTotales { get; set; }
    public int ItemsMatched { get; set; }
    public decimal PorcentajeMatch { get; set; }
    public decimal TicketPromedio { get; set; }
    public decimal Cubiertos { get; set; }
    public decimal PedidosAprox { get; set; }
}

public class VentaSeriePunto
{
    public string Label { get; set; } = "";
    public DateTime Fecha { get; set; }
    public int? IdLocal { get; set; }
    public string? LocalNombre { get; set; }
    public decimal TotalVenta { get; set; }
    public decimal TotalCosto { get; set; }
    public decimal Cantidad { get; set; }
}

public class VentaRubroPunto
{
    public string Rubro { get; set; } = "";
    public decimal Cantidad { get; set; }
    public decimal TotalVenta { get; set; }
    public decimal TotalCosto { get; set; }
}

public class VentaTopProducto
{
    public string Codigo { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string? Rubro { get; set; }
    public decimal Cantidad { get; set; }
    public decimal TotalVenta { get; set; }
    public decimal TotalCosto { get; set; }
}

public class VentaMatrizMensualDto
{
    public int Anio { get; set; }
    public int Mes { get; set; }
    public List<DateTime> Dias { get; set; } = new();
    public List<VentaMatrizFila> Filas { get; set; } = new();
}

public class VentaMatrizFila
{
    public string Codigo { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string? Rubro { get; set; }
    public List<decimal> CantidadesPorDia { get; set; } = new();
    public decimal Promedio { get; set; }
    public decimal[] PromedioPorDiaSemana { get; set; } = new decimal[7];
    public decimal TotalCantidad { get; set; }
    public decimal TotalVenta { get; set; }
}

public class VentaKpiIndexDto
{
    public int Importaciones { get; set; }
    public decimal VentaPeriodo { get; set; }
    public int LocalesCargados { get; set; }
    public int ItemsSinMatch { get; set; }
}

public class VentaPreviewArchivoDto
{
    public string FileKey { get; set; } = "";
    public string NombreArchivo { get; set; } = "";
    public string? Informe { get; set; }
    public string? Empresa { get; set; }
    public string? UsuarioExport { get; set; }
    public DateTime? FechaExportacion { get; set; }
    public DateTime? FechaSugerida { get; set; }
    public int? IdLocalSugerido { get; set; }
    public string? LocalSugeridoNombre { get; set; }
    public int? IdUnidadNegocioSugerido { get; set; }
    public bool YaExiste { get; set; }
    public int? IdImportacionExistente { get; set; }
    public string? Error { get; set; }
    public int CantidadLineas { get; set; }
    public int LineasMatched { get; set; }
    public decimal TotalVenta { get; set; }
    public decimal TotalCosto { get; set; }
    public List<VentaPreviewLineaDto> Lineas { get; set; } = new();
}

public class VentaPreviewLineaDto
{
    public int TempId { get; set; }
    public string Codigo { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string? Rubro { get; set; }
    public int? RubroCodigo { get; set; }
    public decimal Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }
    public decimal CostoUnitarioExcel { get; set; }
    public decimal CostoUnitarioSistema { get; set; }
    public decimal SubtotalCosto { get; set; }
    public decimal Ganancia { get; set; }
    public bool Matched { get; set; }
    public int? IdReceta { get; set; }
    public int? IdInsumo { get; set; }
    public string TipoVinculo { get; set; } = VentaTipoVinculo.Ninguno;
    public bool Incluir { get; set; }
    public string? Warning { get; set; }
}

public class VentaConfirmArchivoDto
{
    public string NombreArchivo { get; set; } = "";
    public DateTime Fecha { get; set; }
    public int IdLocal { get; set; }
    public int IdUnidadNegocio { get; set; }
    public string? Empresa { get; set; }
    public string? Informe { get; set; }
    public List<VentaConfirmLineaDto> Lineas { get; set; } = new();
}

public class VentaConfirmLineaDto
{
    public string Codigo { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string? Rubro { get; set; }
    public int? RubroCodigo { get; set; }
    public decimal Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }
    public decimal CostoUnitarioExcel { get; set; }
}

public class VentaConfirmResultDto
{
    public string NombreArchivo { get; set; } = "";
    public bool Ok { get; set; }
    public bool Reemplazo { get; set; }
    public int? Id { get; set; }
    public string? Error { get; set; }
    public int Lineas { get; set; }
}

public class VentaConfirmBatchResultDto
{
    public bool Ok { get; set; }
    public string? Mensaje { get; set; }
    public string? Tipo { get; set; }
    public List<string> RubrosFaltantes { get; set; } = new();
    public List<VentaConfirmResultDto> Resultados { get; set; } = new();
    public int? Id { get; set; }
    public int ArchivosOk { get; set; }
    public int ArchivosNuevos { get; set; }
    public int ArchivosActualizados { get; set; }
    public int ArchivosError { get; set; }
    public int LineasImportadas { get; set; }
}
