using SistemaKyoGroup.Models;
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

        public virtual ICollection<Compra> Compras { get; set; } = new List<Compra>();

        public virtual OrdenesComprasEstado IdEstadoNavigation { get; set; } = null!;

        public virtual Local IdLocalNavigation { get; set; } = null!;

        public virtual Proveedor IdProveedorNavigation { get; set; } = null!;

        public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;

        public virtual User? IdUsuarioModificaNavigation { get; set; }

        public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

        public virtual ICollection<OrdenesComprasInsumo> OrdenesComprasInsumos { get; set; } = new List<OrdenesComprasInsumo>();

        public int CantCompras { get; set; }
        public int? IdCompraPrimera { get; set; }   // o “IdCompraDestino”
    }

    public class VMOrdenCompraInsumo
    {

        public int Id { get; set; }

        public int IdOrdenCompra { get; set; }

        public int IdInsumo { get; set; }

        public int? IdProveedorLista { get; set; }

        public decimal CantidadPedida { get; set; }

        public decimal CantidadEntregada { get; set; }

        public decimal CantidadRestante { get; set; }

        public decimal PrecioLista { get; set; }

        public decimal SubTotal { get; set; }

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



        public string? Estado { get; set; }       
        public string? Sku { get; set; }

        public string? Nombre { get; set; }


    }
}
