using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class Compra
{
    public int Id { get; set; }

    public int IdUnidadNegocio { get; set; }

    public int IdLocal { get; set; }

    public int IdOrdenCompra { get; set; }

    public DateTime Fecha { get; set; }

    public int IdProveedor { get; set; }

    public decimal Subtotal { get; set; }

    public decimal Descuentos { get; set; }

    public decimal SubtotalFinal { get; set; }

    public string? NotaInterna { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual ICollection<ComprasInsumo> ComprasInsumos { get; set; } = new List<ComprasInsumo>();

    public virtual Local IdLocalNavigation { get; set; } = null!;

    public virtual OrdenesCompra IdOrdenCompraNavigation { get; set; } = null!;

    public virtual Proveedor IdProveedorNavigation { get; set; } = null!;

    public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
