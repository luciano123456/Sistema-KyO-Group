using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

/// <summary>
/// Asiento del libro de caja. Es el destino único de todo movimiento de dinero del
/// sistema: pagos a proveedores, gastos, transferencias, recaudaciones y ajustes.
/// El par (TipoMov, IdMov) identifica el origen y hace el alta idempotente.
/// </summary>
public partial class Caja
{
    public int Id { get; set; }

    public int IdCuenta { get; set; }

    public DateTime Fecha { get; set; }

    public string TipoMov { get; set; } = null!;

    /// <summary>Id del registro de origen (pago, gasto, transferencia…). Null en movimientos manuales.</summary>
    public int? IdMov { get; set; }

    public string Concepto { get; set; } = null!;

    public decimal Ingreso { get; set; }

    public decimal Egreso { get; set; }

    public int? IdSesion { get; set; }

    public int? IdLocal { get; set; }

    public int? IdUnidadNegocio { get; set; }

    public int? IdMedioPago { get; set; }

    public string? NotaInterna { get; set; }

    /// <summary>Los asientos no se borran: se anulan para preservar la trazabilidad.</summary>
    public bool Anulado { get; set; }

    public string? MotivoAnula { get; set; }

    public int? IdUsuarioAnula { get; set; }

    public DateTime? FechaAnula { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual Cuenta IdCuentaNavigation { get; set; } = null!;

    public virtual CajasSesion? IdSesionNavigation { get; set; }

    public virtual Local? IdLocalNavigation { get; set; }

    public virtual UnidadesNegocio? IdUnidadNegocioNavigation { get; set; }

    public virtual MediosPago? IdMedioPagoNavigation { get; set; }

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
