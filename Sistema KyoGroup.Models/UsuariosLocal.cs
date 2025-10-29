using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class UsuariosLocal
{
    public int Id { get; set; }

    public int? IdLocal { get; set; }

    public virtual Local? IdLocalNavigation { get; set; }
}
