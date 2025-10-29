using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class ChequesEmitido
{
    public int Id { get; set; }

    public int? IdPago { get; set; }

    public string Numero { get; set; } = null!;

    public DateTime FechaEmision { get; set; }

    public DateTime FechaPago { get; set; }

    public DateTime Importe { get; set; }

    public int IdEstado { get; set; }

    public int? IdCuentaDebitar { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual Cuenta? IdCuentaDebitarNavigation { get; set; }

    public virtual ChequesEstado IdEstadoNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
