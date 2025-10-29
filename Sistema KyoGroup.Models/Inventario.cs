using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class Inventario
{
    public int Id { get; set; }

    public int IdUnidadNegocio { get; set; }

    public int IdLocal { get; set; }

    public int? IdTipo { get; set; }

    public string? Tipo { get; set; }

    public decimal Cantidad { get; set; }

    public virtual Local IdLocalNavigation { get; set; } = null!;

    public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;
}
