using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class OrdenesCompra
{
    public int Id { get; set; }

    public int IdUnidadNegocio { get; set; }

    public int IdLocal { get; set; }

    public DateTime FechaEmision { get; set; }

    public int IdProveedor { get; set; }

    public DateTime? FechaEntrega { get; set; }

    public decimal CostoTotal { get; set; }

    public int IdEstado { get; set; }

    public string? NotaInterna { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual ICollection<Compra> Compras { get; set; } = new List<Compra>();

    public virtual OrdenesComprasEstado IdEstadoNavigation { get; set; } = null!;

    public virtual Local IdLocalNavigation { get; set; } = null!;

    public virtual Proveedor IdProveedorNavigation { get; set; } = null!;

    public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual ICollection<OrdenesComprasInsumo> OrdenesComprasInsumos { get; set; } = new List<OrdenesComprasInsumo>();
}
