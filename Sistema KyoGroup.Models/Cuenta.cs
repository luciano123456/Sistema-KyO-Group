using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class Cuenta
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    public virtual ICollection<Caja> Cajas { get; set; } = new List<Caja>();

    public virtual ICollection<CajasTransferenciasCuenta> CajasTransferenciasCuentaIdCuentaDestinoNavigations { get; set; } = new List<CajasTransferenciasCuenta>();

    public virtual ICollection<CajasTransferenciasCuenta> CajasTransferenciasCuentaIdCuentaOrigenNavigations { get; set; } = new List<CajasTransferenciasCuenta>();

    public virtual ICollection<ChequesEmitido> ChequesEmitidos { get; set; } = new List<ChequesEmitido>();

    public virtual ICollection<ProveedoresPago> ProveedoresPagos { get; set; } = new List<ProveedoresPago>();
}
