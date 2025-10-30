using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class ProveedoresInsumosLista
{
    public int Id { get; set; }

    public int IdProveedor { get; set; }

    public string? Codigo { get; set; }

    public string Descripcion { get; set; } = null!;

    public decimal CostoUnitario { get; set; }

    public DateTime FechaActualizacion { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual ICollection<ComprasInsumo> ComprasInsumos { get; set; } = new List<ComprasInsumo>();

    public virtual Proveedor IdProveedorNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual ICollection<InsumosProveedor> InsumosProveedores { get; set; } = new List<InsumosProveedor>();

    public virtual ICollection<OrdenesComprasInsumo> OrdenesComprasInsumos { get; set; } = new List<OrdenesComprasInsumo>();
}
