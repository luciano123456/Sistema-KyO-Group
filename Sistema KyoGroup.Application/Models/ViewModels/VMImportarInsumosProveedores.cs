using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMImportacionProveedoresInsumos
    {
        public int IdProveedor { get; set; }
        public List<InsumoImportado> Lista { get; set; }
    }

    public class InsumoImportado
    {
        public string Codigo { get; set; }
        public string Descripcion { get; set; }
        public decimal CostoUnitario { get; set; }
    }


}
