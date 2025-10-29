using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class InsumosUnidadesNegocio
{
    public int Id { get; set; }

    public string? IdInsumo { get; set; }

    public int? IdUnidadNegocio { get; set; }

    public virtual UnidadesNegocio? IdUnidadNegocioNavigation { get; set; }
}
