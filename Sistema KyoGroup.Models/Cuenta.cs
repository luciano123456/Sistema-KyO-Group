using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

/// <summary>
/// Cuenta de fondos: caja física, banco, billetera virtual o tarjeta.
/// El saldo nunca se guarda acá: se calcula como SaldoInicial + Σ(Ingreso − Egreso) del libro de caja.
/// </summary>
public partial class Cuenta
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    public int IdTipo { get; set; }

    /// <summary>Local al que pertenece la caja. Null = cuenta central / compartida.</summary>
    public int? IdLocal { get; set; }

    public string Moneda { get; set; } = null!;

    public decimal SaldoInicial { get; set; }

    public string? Banco { get; set; }

    public string? Cbu { get; set; }

    public string? Alias { get; set; }

    public string? Titular { get; set; }

    public bool Activa { get; set; }

    /// <summary>Si es false, el motor rechaza asientos que dejen la cuenta en negativo.</summary>
    public bool PermiteNegativo { get; set; }

    /// <summary>Si es true, la cuenta usa apertura/cierre de turno con arqueo.</summary>
    public bool RequiereArqueo { get; set; }

    public string? Color { get; set; }

    public string? Icono { get; set; }

    public int Orden { get; set; }

    public virtual CuentasTipo IdTipoNavigation { get; set; } = null!;

    public virtual Local? IdLocalNavigation { get; set; }

    public virtual ICollection<Caja> Cajas { get; set; } = new List<Caja>();

    public virtual ICollection<CajasSesion> CajasSesiones { get; set; } = new List<CajasSesion>();

    public virtual ICollection<CajasTransferenciasCuenta> CajasTransferenciasCuentaIdCuentaDestinoNavigations { get; set; } = new List<CajasTransferenciasCuenta>();

    public virtual ICollection<CajasTransferenciasCuenta> CajasTransferenciasCuentaIdCuentaOrigenNavigations { get; set; } = new List<CajasTransferenciasCuenta>();

    public virtual ICollection<ChequesEmitido> ChequesEmitidos { get; set; } = new List<ChequesEmitido>();

    public virtual ICollection<GastosPago> GastosPagos { get; set; } = new List<GastosPago>();

    public virtual ICollection<MediosPago> MediosPagos { get; set; } = new List<MediosPago>();

    public virtual ICollection<ProveedoresPago> ProveedoresPagos { get; set; } = new List<ProveedoresPago>();
}
