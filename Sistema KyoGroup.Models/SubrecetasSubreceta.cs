using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class SubRecetasSubReceta
{
    public int Id { get; set; }

    public int IdSubRecetaPadre { get; set; }

    public int IdSubRecetaHija { get; set; }

    public decimal Cantidad { get; set; }

    public decimal CostoUnitario { get; set; }

    public decimal Subtotal { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual SubReceta IdSubRecetaHijaNavigation { get; set; } = null!;

    public virtual SubReceta IdSubRecetaPadreNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
