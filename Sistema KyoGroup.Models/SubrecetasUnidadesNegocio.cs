using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class SubrecetasUnidadesNegocio
{
    public int Id { get; set; }

    public int? IdSubreceta { get; set; }

    public int? IdUnidadNegocio { get; set; }

    public virtual Subreceta? IdSubrecetaNavigation { get; set; }

    public virtual UnidadesNegocio? IdUnidadNegocioNavigation { get; set; }
}
