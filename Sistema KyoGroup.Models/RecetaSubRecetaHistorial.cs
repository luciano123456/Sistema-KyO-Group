using System;

namespace SistemaKyoGroup.Models;

public partial class RecetaSubRecetaHistorial
{
    public int Id { get; set; }

    /// <summary>Receta | SubReceta</summary>
    public string TipoEntidad { get; set; } = null!;

    public int IdEntidad { get; set; }

    /// <summary>Creacion | Modificacion | Eliminacion</summary>
    public string Accion { get; set; } = null!;

    public string Resumen { get; set; } = null!;

    public string? Detalle { get; set; }

    public int IdUsuario { get; set; }

    public string? UsuarioNombre { get; set; }

    public DateTime Fecha { get; set; }

    public virtual User IdUsuarioNavigation { get; set; } = null!;
}
