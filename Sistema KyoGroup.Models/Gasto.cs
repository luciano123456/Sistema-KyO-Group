using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

/// <summary>
/// Gasto operativo. Puede tener proveedor (y entonces impactar su cuenta corriente)
/// o ser un egreso directo. El estado y el importe pagado se derivan de GastosPagos.
/// </summary>
public partial class Gasto
{
    public int Id { get; set; }

    public int? IdUnidadNegocio { get; set; }

    public int? IdLocal { get; set; }

    public int IdCategoria { get; set; }

    public int? IdProveedor { get; set; }

    public DateTime Fecha { get; set; }

    public DateTime? FechaVencimiento { get; set; }

    public string Concepto { get; set; } = null!;

    public string? Detalle { get; set; }

    public string? ComprobanteTipo { get; set; }

    public string? ComprobanteNumero { get; set; }

    public decimal Importe { get; set; }

    /// <summary>Suma de los pagos vigentes. Recalculado, nunca editado a mano.</summary>
    public decimal ImportePagado { get; set; }

    public int IdEstado { get; set; }

    /// <summary>
    /// Si es true el gasto genera un Debe en la cuenta corriente del proveedor y
    /// se salda con pagos posteriores. Si es false es un egreso directo de caja.
    /// </summary>
    public bool ImpactaCuentaCorriente { get; set; }

    public bool Anulado { get; set; }

    public string? MotivoAnula { get; set; }

    public string? NotaInterna { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual GastosCategoria IdCategoriaNavigation { get; set; } = null!;

    public virtual Local? IdLocalNavigation { get; set; }

    public virtual Proveedor? IdProveedorNavigation { get; set; }

    public virtual UnidadesNegocio? IdUnidadNegocioNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual ICollection<GastosPago> GastosPagos { get; set; } = new List<GastosPago>();
}
