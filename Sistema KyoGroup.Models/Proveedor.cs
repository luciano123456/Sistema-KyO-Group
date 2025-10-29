using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class Proveedor
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    public string? Apodo { get; set; }

    public string? Ubicacion { get; set; }

    public string? Telefono { get; set; }

    public string? Cbu { get; set; }

    public string? Cuit { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual ICollection<Compra> Compras { get; set; } = new List<Compra>();

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual ICollection<OrdenesCompra> OrdenesCompras { get; set; } = new List<OrdenesCompra>();

    public virtual ICollection<ProveedorsCuentaCorriente> ProveedorsCuentaCorrientes { get; set; } = new List<ProveedorsCuentaCorriente>();

    public virtual ICollection<ProveedorsInsumosLista> ProveedorsInsumosLista { get; set; } = new List<ProveedorsInsumosLista>();
}
