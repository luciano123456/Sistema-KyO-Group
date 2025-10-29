using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class InventarioTransferencia
{
    public int Id { get; set; }

    public int IdUnidadNegocio { get; set; }

    public int IdLocalOrigen { get; set; }

    public int IdLocalDestino { get; set; }

    public int IdMotivo { get; set; }

    public DateTime Fecha { get; set; }

    public string Concepto { get; set; } = null!;

    public string? NotaInterna { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual Local IdLocalDestinoNavigation { get; set; } = null!;

    public virtual Local IdLocalOrigenNavigation { get; set; } = null!;

    public virtual InventarioTransferenciasMotivo IdMotivoNavigation { get; set; } = null!;

    public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual ICollection<InvetarioTransferenciasDetalle> InvetarioTransferenciasDetalles { get; set; } = new List<InvetarioTransferenciasDetalle>();
}
