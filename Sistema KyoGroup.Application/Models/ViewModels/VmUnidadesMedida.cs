using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMUnidadesMedida
    {
        public int Id { get; set; }

        public string Nombre { get; set; } = null!;

        public virtual ICollection<Insumo> Insumos { get; set; } = new List<Insumo>();
        public virtual ICollection<Receta> Recetas { get; set; } = new List<Receta>();
    }
}
