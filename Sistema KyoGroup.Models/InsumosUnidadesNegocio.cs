using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class InsumosUnidadesNegocio
{
    public int Id { get; set; }

    public int? IdInsumo { get; set; }

    public int? IdUnidadNegocio { get; set; }

    public virtual Insumo? IdInsumoNavigation { get; set; }

    public virtual UnidadesNegocio? IdUnidadNegocioNavigation { get; set; }
}
