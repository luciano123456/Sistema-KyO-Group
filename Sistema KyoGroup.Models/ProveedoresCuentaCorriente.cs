using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class ProveedoresCuentaCorriente
{
    public int Id { get; set; }

    public int IdProveedor { get; set; }

    public DateTime Fecha { get; set; }

    public string TipoMov { get; set; } = null!;

    public int IdMov { get; set; }

    public string Concepto { get; set; } = null!;

    public decimal Debe { get; set; }

    public decimal Haber { get; set; }

    public virtual Proveedor IdProveedorNavigation { get; set; } = null!;
}
