using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class CajasTransferenciasCuenta
{
    public int Id { get; set; }

    public int? IdCajaOrigen { get; set; }

    public int? IdCajaDestino { get; set; }

    public int IdCuentaOrigen { get; set; }

    public int IdCuentaDestino { get; set; }

    public DateTime Fecha { get; set; }

    public string Concepto { get; set; } = null!;

    public decimal ImporteOrigen { get; set; }

    public decimal ImporteDestino { get; set; }

    public string? NotaInterna { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual Cuenta IdCuentaDestinoNavigation { get; set; } = null!;

    public virtual Cuenta IdCuentaOrigenNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
