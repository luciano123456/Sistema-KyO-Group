using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class ComprasInsumo
{
    public int Id { get; set; }

    public int? IdMovInventario { get; set; }

    public int IdCompra { get; set; }

    public int IdInsumo { get; set; }

    public int IdProveedorLista { get; set; }

    public decimal Cantidad { get; set; }

    public decimal PrecioLista { get; set; }

    public decimal PrecioFactura { get; set; }

    public decimal Diferencia { get; set; }

    public decimal? PorcDescuento { get; set; }

    public decimal? DescuentoUnitario { get; set; }

    public decimal PrecioFinal { get; set; }

    public decimal? DescuentoTotal { get; set; }

    public decimal SubtotalConDescuento { get; set; }

    public decimal SubtotalFinal { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual Compra IdCompraNavigation { get; set; } = null!;

    public virtual Insumo IdInsumoNavigation { get; set; } = null!;

    public virtual ProveedoresInsumosLista IdProveedorListaNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
