using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class UnidadesMedida
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    public virtual ICollection<Insumo> Insumos { get; set; } = new List<Insumo>();

    public virtual ICollection<Receta> Receta { get; set; } = new List<Receta>();

    public virtual ICollection<Subreceta> Subreceta { get; set; } = new List<Subreceta>();
}
