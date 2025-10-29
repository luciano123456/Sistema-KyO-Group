using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class ImportacionsTipo
{
    public int Id { get; set; }

    public string? Nombre { get; set; }

    public virtual ICollection<Importacion> Importacions { get; set; } = new List<Importacion>();
}
