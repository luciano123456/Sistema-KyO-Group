using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class SubRecetasCategoria
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    public virtual ICollection<SubReceta> SubReceta { get; set; } = new List<SubReceta>();
}
