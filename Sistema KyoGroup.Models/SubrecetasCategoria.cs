using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class SubrecetasCategoria
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    public virtual ICollection<Subreceta> Subreceta { get; set; } = new List<Subreceta>();
}
