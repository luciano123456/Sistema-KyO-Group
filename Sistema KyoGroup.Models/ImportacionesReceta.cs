using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class ImportacionesReceta
{
    public int Id { get; set; }

    public int IdImportacion { get; set; }

    public int? IdMovInventario { get; set; }

    public int IdReceta { get; set; }

    public string Codigo { get; set; } = null!;

    public string Descripcion { get; set; } = null!;

    public int Cantidad { get; set; }

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
}
