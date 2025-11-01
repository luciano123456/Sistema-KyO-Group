using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMSubrecetasSubreceta
    {
        public int Id { get; set; }

        public int IdSubrecetaPadre { get; set; }

        public int IdSubrecetaHija { get; set; }

        public decimal Cantidad { get; set; }

        public decimal CostoUnitario { get; set; }

        public decimal SubTotal { get; set; }
        public string Nombre { get; set; }

        public virtual Subreceta IdSubrecetaHijaNavigation { get; set; } = null!;

        public virtual Subreceta IdSubrecetaPadreNavigation { get; set; } = null!;

    }
}
