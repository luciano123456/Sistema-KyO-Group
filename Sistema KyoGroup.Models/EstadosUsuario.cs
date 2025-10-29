using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class EstadosUsuario
{
    public int Id { get; set; }

    public string? Nombre { get; set; }

    public virtual ICollection<User> Usuarios { get; set; } = new List<User>();
}
