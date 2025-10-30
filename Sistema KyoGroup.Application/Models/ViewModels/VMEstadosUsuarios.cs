using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class ClaimsPrincipalExtensions
    {
        public int Id { get; set; }

        public string? Nombre { get; set; }

        public virtual ICollection<User> Usuarios { get; set; } = new List<User>();
    }
}
