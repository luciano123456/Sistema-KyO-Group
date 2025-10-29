using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class InsumosProveedor
{
    public int Id { get; set; }

    public string IdInsumo { get; set; } = null!;

    public int IdProveedor { get; set; }

    public int IdListaProveedor { get; set; }

    public virtual ProveedorsInsumosLista IdListaProveedorNavigation { get; set; } = null!;
}
