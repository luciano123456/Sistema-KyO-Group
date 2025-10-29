using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class OrdenesComprasEstado
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    public virtual ICollection<OrdenesCompra> OrdenesCompras { get; set; } = new List<OrdenesCompra>();
}
