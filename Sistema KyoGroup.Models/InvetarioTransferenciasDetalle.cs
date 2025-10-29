using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class InvetarioTransferenciasDetalle
{
    public int Id { get; set; }

    public int IdTransferencia { get; set; }

    public int? IdMovInventario { get; set; }

    public int IdTipo { get; set; }

    public string Tipo { get; set; } = null!;

    public decimal Cantidad { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual InventarioTransferencia IdTransferenciaNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
