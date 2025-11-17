using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMOrdenCompra
    {
        // ----- Cabecera -----
        public int Id { get; set; }

        public int IdUnidadNegocio { get; set; }
        public string? UnidadNegocio { get; set; }   // Nombre (solo lectura para la vista)

        public int IdLocal { get; set; }
        public string? Local { get; set; }           // Nombre (solo lectura para la vista)

        public int IdProveedor { get; set; }
        public string? Proveedor { get; set; }       // Nombre (solo lectura para la vista)

        public DateTime FechaEmision { get; set; }
        public DateTime? FechaEntrega { get; set; }

        public decimal CostoTotal { get; set; }

        public int IdEstado { get; set; }
        public string? Estado { get; set; }          // Nombre (solo lectura para la vista)

        public string? NotaInterna { get; set; }

        // ----- Detalle -----
        public List<VMOrdenCompraInsumo> OrdenesComprasInsumos { get; set; } = new();
    }

    public class VMOrdenCompraInsumo
    {
        // PK del detalle
        public int Id { get; set; }

        // FK a cabecera
        public int IdOrdenCompra { get; set; }

        // En tu BD es string
        public string IdInsumo { get; set; } = string.Empty;

        // (Opcional) FK a lista del proveedor
        public int? IdProveedorLista { get; set; }

        // Cantidades / precios
        public decimal CantidadPedida { get; set; }
        public decimal CantidadEntregada { get; set; }
        public decimal CantidadRestante { get; set; }

        public decimal PrecioLista { get; set; }

        // OJO: en la BD es "Subtotal" (sin T mayúscula). En el VM usamos SubTotal para la vista.
        public decimal SubTotal { get; set; }

        // Estado + nota
        public int IdEstado { get; set; }
        public string? Estado { get; set; }          // Nombre de estado (opcional para la vista)
        public string? NotaInterna { get; set; }

        // Conveniencia para mostrar descripción del insumo (o del item de lista proveedor)
        public string? Nombre { get; set; }
    }
}
