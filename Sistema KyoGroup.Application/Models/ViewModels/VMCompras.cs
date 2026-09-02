using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMCompra
    {
        public int Id { get; set; }

        public int IdUnidadNegocio { get; set; }
        public int IdLocal { get; set; }
        public int IdProveedor { get; set; }

        /// <summary>
        /// Orden de compra base
        /// </summary>
        public int IdOrdenCompra { get; set; }

        public DateTime Fecha { get; set; }

        public decimal Subtotal { get; set; }
        public decimal Descuentos { get; set; }
        public decimal SubtotalFinal { get; set; }

        public string? NotaInterna { get; set; }

        public List<VMCompraInsumo> ComprasInsumos { get; set; } = new();
    }

    public class VMCompraInsumo
    {
        public int Id { get; set; }

        public int? EstadoManualOC { get; set; }


        public int IdInsumo { get; set; }
        public int IdProveedorLista { get; set; }

        /// <summary>
        /// Cantidad recibida en ESTA compra
        /// </summary>
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

        // ----- Datos de vista -----
        public string? Nombre { get; set; }
        public string? Sku { get; set; }

        // ----- Vínculo con la OC -----
        /// <summary>
        /// Id de la línea en OrdenesComprasInsumos que corresponde a este insumo.
        /// </summary>
        public int? IdOrdenCompraInsumo { get; set; }

        /// <summary>
        /// Cantidad pedida en la OC.
        /// </summary>
        public decimal CantidadPedidaOc { get; set; }

        /// <summary>
        /// Cantidad pendiente en la OC antes de esta compra.
        /// </summary>
        public decimal CantidadPendienteOc { get; set; }

        /// <summary>
        /// Cantidad entregada acumulada en la OC (opcional, por si la querés mostrar).
        /// </summary>
        public decimal CantidadEntregadaOc { get; set; }

        /// <summary>
        /// Estado que el usuario elige para la línea de OC, desde la pantalla de Compras.
        /// (1 Pendiente, 2 Entregado, 3 Incompleto...)
        /// </summary>
        public int? IdEstadoOcInsumo { get; set; }

        /// <summary>
        /// Nombre del estado de la línea de OC (solo para mostrar).
        /// </summary>
        public string? EstadoOcNombre { get; set; }
    }
}
