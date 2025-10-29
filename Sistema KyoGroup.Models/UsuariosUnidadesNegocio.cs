using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class UsuariosUnidadesNegocio
{
    public int Id { get; set; }

    public int? IdUnidadNegocio { get; set; }

    public virtual UnidadesNegocio? IdUnidadNegocioNavigation { get; set; }
}
