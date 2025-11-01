using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class SubrecetasSubreceta
{
    public int Id { get; set; }

    public int IdSubrecetaPadre { get; set; }

    public int IdSubrecetaHija { get; set; }

    public decimal Cantidad { get; set; }

    public decimal CostoUnitario { get; set; }

    public decimal Subtotal { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual Subreceta IdSubrecetaHijaNavigation { get; set; } = null!;

    public virtual Subreceta IdSubrecetaPadreNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
