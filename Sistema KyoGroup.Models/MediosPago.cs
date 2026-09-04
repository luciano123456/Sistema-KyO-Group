using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class MediosPago
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    /// <summary>Cuenta sugerida al elegir este medio (ej. "Transferencia" → cuenta bancaria).</summary>
    public int? IdCuentaDefecto { get; set; }

    /// <summary>
    /// Si es false el medio no mueve fondos al momento de registrarse (ej. cheque diferido):
    /// el asiento de caja queda pendiente de otra acción.
    /// </summary>
    public bool AfectaCaja { get; set; }

    public bool Activo { get; set; }

    public int Orden { get; set; }

    public virtual Cuenta? IdCuentaDefectoNavigation { get; set; }

    public virtual ICollection<Caja> Cajas { get; set; } = new List<Caja>();

    public virtual ICollection<GastosPago> GastosPagos { get; set; } = new List<GastosPago>();

    public virtual ICollection<ProveedoresPago> ProveedoresPagos { get; set; } = new List<ProveedoresPago>();
}
