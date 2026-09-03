using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace SistemaKyoGroup.Models;

public partial class ImportacionesReceta
{
    public int Id { get; set; }

    public int IdImportacion { get; set; }

    public int? IdMovInventario { get; set; }

    public int? IdReceta { get; set; }

    /// <summary>En memoria/preview. No hay columna en DB (sin permiso ALTER).</summary>
    [NotMapped]
    public int? IdInsumo { get; set; }

    /// <summary>Receta | Insumo | Ninguno — no mapeado a SQL.</summary>
    [NotMapped]
    public string? TipoVinculo { get; set; }

    public string Codigo { get; set; } = null!;

    public string Descripcion { get; set; } = null!;

    public string? Rubro { get; set; }

    public int? RubroCodigo { get; set; }

    /// <summary>FK opcional al catálogo Rubros (si la columna existe en DB).</summary>
    [NotMapped]
    public int? IdRubro { get; set; }

    public bool Matched { get; set; }

    public decimal Cantidad { get; set; }

    public decimal PrecioUnitario { get; set; }

    public decimal CostoUnitario { get; set; }

    public decimal Subtotal { get; set; }

    public decimal SubtotalCosto { get; set; }

    public decimal Ganancia { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual Importacion IdImportacionNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual ICollection<ImportacionesInsumo> ImportacionesInsumos { get; set; } = new List<ImportacionesInsumo>();

    public virtual ICollection<ImportacionesSubReceta> ImportacionesSubReceta { get; set; } = new List<ImportacionesSubReceta>();

    public string ResolverTipoVinculo()
    {
        if (TipoVinculo == "Receta" || TipoVinculo == "Insumo" || TipoVinculo == "Ninguno")
            return TipoVinculo;
        if (IdReceta is > 0) return "Receta";
        if (IdInsumo is > 0) return "Insumo";
        if (Matched) return "Insumo";
        return "Ninguno";
    }
}
