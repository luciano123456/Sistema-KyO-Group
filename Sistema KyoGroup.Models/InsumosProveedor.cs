using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class InsumosProveedor
{
    public int Id { get; set; }

    public int IdInsumo { get; set; }

    public int IdProveedor { get; set; }

    public int IdListaProveedor { get; set; }

    public virtual InsumosProveedor IdInsumo1 { get; set; } = null!;

    public virtual Insumo IdInsumoNavigation { get; set; } = null!;

    public virtual ProveedoresInsumosLista IdListaProveedorNavigation { get; set; } = null!;

    public virtual Proveedor IdProveedorNavigation { get; set; } = null!;

    public virtual ICollection<InsumosProveedor> InverseIdInsumo1 { get; set; } = new List<InsumosProveedor>();
}
