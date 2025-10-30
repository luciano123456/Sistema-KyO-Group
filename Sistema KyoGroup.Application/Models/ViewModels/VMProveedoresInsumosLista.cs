
using SistemaKyoGroup.Models;

namespace KyoGroup.Application.Models.ViewModels
{
    public class VMProveedoresInsumos
    {
        public int Id { get; set; }

        public int IdProveedor { get; set; }

        public string? Codigo { get; set; }

        public string Descripcion { get; set; } = null!;
        public string Proveedor { get; set; } = null!;

        public decimal CostoUnitario { get; set; }

        public DateTime FechaActualizacion { get; set; }

        public virtual Proveedor IdProveedorNavigation { get; set; } = null!;

        public virtual ICollection<InsumosProveedor> InsumosProveedores { get; set; } = new List<InsumosProveedor>();

    }
}
