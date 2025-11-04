using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMSubRecetasSubReceta
    {
        public int Id { get; set; }

        public int IdSubRecetaPadre { get; set; }

        public int IdSubRecetaHija { get; set; }

        public decimal Cantidad { get; set; }

        public decimal CostoUnitario { get; set; }

        public decimal SubTotal { get; set; }
        public string Nombre { get; set; }

        public virtual SubReceta IdSubRecetaHijaNavigation { get; set; } = null!;

        public virtual SubReceta IdSubRecetaPadreNavigation { get; set; } = null!;

    }
}
