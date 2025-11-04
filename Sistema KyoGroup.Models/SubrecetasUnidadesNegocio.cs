using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class SubRecetasUnidadesNegocio
{
    public int Id { get; set; }

    public int? IdSubReceta { get; set; }

    public int? IdUnidadNegocio { get; set; }

    public virtual SubReceta? IdSubRecetaNavigation { get; set; }

    public virtual UnidadesNegocio? IdUnidadNegocioNavigation { get; set; }
}
