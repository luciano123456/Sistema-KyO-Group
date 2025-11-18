using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMCompra
    {
        public int Id { get; set; }
        public int IdUnidadNegocio { get; set; }
        public int IdLocal { get; set; }
        public int IdOrdenCompra { get; set; }
        public DateTime Fecha { get; set; }
        public int IdProveedor { get; set; }
        public decimal Subtotal { get; set; }
        public decimal Descuentos { get; set; }
        public decimal SubtotalFinal { get; set; }
        public string? NotaInterna { get; set; }

        public List<VMCompraInsumo> ComprasInsumos { get; set; } = new();
    }

    public class VMCompraInsumo
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
        public string Nombre { get; set; }
        public string Sku { get; set; }

        public int? IdOrdenCompraInsumo { get; set; }
        public decimal CantidadPedidaOc { get; set; }
        public decimal CantidadPendienteOc { get; set; }

        public DateTime? FechaModifica { get; set; }

        public virtual Compra IdCompraNavigation { get; set; } = null!;

        public virtual Insumo IdInsumoNavigation { get; set; } = null!;

        public virtual ProveedoresInsumosLista IdProveedorListaNavigation { get; set; } = null!;

        public virtual User? IdUsuarioModificaNavigation { get; set; }

        public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
    }
}
