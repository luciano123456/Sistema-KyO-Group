using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class OrdenesComprasInsumosEstado
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    public virtual ICollection<OrdenesComprasInsumo> OrdenesComprasInsumos { get; set; } = new List<OrdenesComprasInsumo>();
}
