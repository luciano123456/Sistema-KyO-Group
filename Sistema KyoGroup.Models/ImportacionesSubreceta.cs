using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class ImportacionsSubreceta
{
    public int Id { get; set; }

    public int IdMovInventario { get; set; }

    public int IdVentaReceta { get; set; }

    public int IdSubreceta { get; set; }

    public decimal Cantidad { get; set; }

    public decimal CostoUnitario { get; set; }

    public decimal Subtotal { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual ImportacionsReceta IdVentaRecetaNavigation { get; set; } = null!;
}
