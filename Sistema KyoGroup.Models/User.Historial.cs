using System.ComponentModel.DataAnnotations.Schema;

namespace SistemaKyoGroup.Models;

public partial class User
{
    /// <summary>Usuario autenticado que realiza la acción (no mapeado a DB).</summary>
    [NotMapped]
    public int? IdUsuarioAccion { get; set; }
}
