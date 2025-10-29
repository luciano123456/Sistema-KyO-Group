using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class InsumosCategoria
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    public virtual ICollection<Insumo> Insumos { get; set; } = new List<Insumo>();
}
