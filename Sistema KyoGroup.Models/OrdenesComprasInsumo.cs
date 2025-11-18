using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class OrdenesComprasInsumo
{
    public int Id { get; set; }

    public int IdOrdenCompra { get; set; }

    public int IdInsumo { get; set; }

    public int? IdProveedorLista { get; set; }

    public decimal CantidadPedida { get; set; }

    public decimal CantidadEntregada { get; set; }

    public decimal CantidadRestante { get; set; }

    public decimal PrecioLista { get; set; }

    public decimal Subtotal { get; set; }

    public int IdEstado { get; set; }

    public string? NotaInterna { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual OrdenesComprasInsumosEstado IdEstadoNavigation { get; set; } = null!;

    public virtual Insumo IdInsumoNavigation { get; set; } = null!;

    public virtual OrdenesCompra IdOrdenCompraNavigation { get; set; } = null!;

    public virtual ProveedoresInsumosLista? IdProveedorListaNavigation { get; set; }

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
