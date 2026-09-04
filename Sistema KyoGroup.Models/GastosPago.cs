using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

/// <summary>
/// Pago (total o parcial) de un gasto. Cada pago vigente tiene su asiento espejo
/// en el libro de caja, referenciado por IdCaja.
/// </summary>
public partial class GastosPago
{
    public int Id { get; set; }

    public int IdGasto { get; set; }

    public int IdCuenta { get; set; }

    public int? IdMedioPago { get; set; }

    /// <summary>Asiento generado en el libro de caja.</summary>
    public int? IdCaja { get; set; }

    public DateTime Fecha { get; set; }

    public decimal Importe { get; set; }

    public string? NotaInterna { get; set; }

    public bool Anulado { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public virtual Gasto IdGastoNavigation { get; set; } = null!;

    public virtual Cuenta IdCuentaNavigation { get; set; } = null!;

    public virtual MediosPago? IdMedioPagoNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
