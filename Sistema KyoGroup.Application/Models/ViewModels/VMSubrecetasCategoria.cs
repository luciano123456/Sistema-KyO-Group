using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMSubRecetasCategoria
    {
        public int Id { get; set; }

        public string Nombre { get; set; } = null!;

        public virtual ICollection<Insumo> Insumos { get; set; } = new List<Insumo>();
    }
}
