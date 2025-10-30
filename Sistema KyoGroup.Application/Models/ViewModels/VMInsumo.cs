using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMInsumo
    {
    public int Id { get; set; }

        public string? Sku { get; set; }

        public string Descripcion { get; set; } = null!;

        public int IdUnidadMedida { get; set; }

        public int IdCategoria { get; set; }
        public string Categoria { get; set; }
        public string UnidadMedida { get; set; }

        public string ProveedorDestacado { get; set; }
        public int IdProveedorLista { get; set; }
        public decimal CostoUnitario { get; set; }
        public decimal CantidadProveedores { get; set; }
        public decimal PrecioLista { get; set; }


        public List<string> UnidadesNegocio { get; set; } = new();
        public List<string> Proveedores { get; set; } = new();

     
        public DateTime FechaActualizacion { get; set; }

        public virtual InsumosCategoria IdCategoriaNavigation { get; set; } = null!;

        public virtual UnidadesMedida IdUnidadMedidaNavigation { get; set; } = null!;

        public virtual ICollection<InsumosProveedor> InsumosProveedores { get; set; } = new List<InsumosProveedor>();

        public virtual ICollection<InsumosUnidadesNegocio> InsumosUnidadesNegocios { get; set; } = new List<InsumosUnidadesNegocio>();

        public virtual ICollection<RecetasInsumo> RecetasInsumos { get; set; } = new List<RecetasInsumo>();

        public virtual ICollection<SubrecetasInsumo> SubrecetasInsumos { get; set; } = new List<SubrecetasInsumo>();

    }
}
