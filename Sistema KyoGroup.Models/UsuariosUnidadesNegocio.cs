using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class UsuariosUnidadesNegocio
{
    public int Id { get; set; }

    public int IdUsuario { get; set; }

    public int IdUnidadNegocio { get; set; }

    public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;

    public virtual User IdUsuarioNavigation { get; set; } = null!;
}
