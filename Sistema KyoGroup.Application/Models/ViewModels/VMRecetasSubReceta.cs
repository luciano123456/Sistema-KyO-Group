using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMRecetasSubReceta
    {
        public int Id { get; set; }

        public int IdReceta { get; set; }

        public int IdSubReceta { get; set; }

        public decimal Cantidad { get; set; }

        public decimal CostoUnitario { get; set; }

        public decimal? SubTotal { get; set; }
        public string Nombre { get; set; }

        public virtual Receta IdRecetaNavigation { get; set; } = null!;

        public virtual Subreceta IdSubRecetaNavigation { get; set; } = null!;
    }


}
