using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class ChequesEstado
{
    public int Id { get; set; }

    public string? Nombre { get; set; }

    public virtual ICollection<ChequesEmitido> ChequesEmitidos { get; set; } = new List<ChequesEmitido>();
}
