using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class CuentasTipo
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    /// <summary>Las cuentas de tipo efectivo son las que admiten arqueo físico.</summary>
    public bool EsEfectivo { get; set; }

    public virtual ICollection<Cuenta> Cuentas { get; set; } = new List<Cuenta>();
}
