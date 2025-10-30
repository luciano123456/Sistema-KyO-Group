using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class ImportacionesTipo
{
    public int Id { get; set; }

    public string? Nombre { get; set; }

    public virtual ICollection<Importacion> Importaciones { get; set; } = new List<Importacion>();
}
