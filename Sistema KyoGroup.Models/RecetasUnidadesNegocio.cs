using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class RecetasUnidadesNegocio
{
    public int Id { get; set; }

    public int IdReceta { get; set; }

    public int IdUnidadNegocio { get; set; }

    public virtual Receta IdRecetaNavigation { get; set; } = null!;

    public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;
}
