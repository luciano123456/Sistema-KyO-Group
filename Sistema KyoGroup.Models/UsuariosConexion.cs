namespace SistemaKyoGroup.Models;

/// <summary>
/// Evento de conexión de un usuario al sistema.
/// Tipo: 1=Conectó, 2=Desconectó, 3=Sesión expirada.
/// </summary>
public partial class UsuariosConexion
{
    public const byte TipoConecto = 1;
    public const byte TipoDesconecto = 2;
    public const byte TipoExpiro = 3;

    public int Id { get; set; }

    public int IdUsuario { get; set; }

    public byte Tipo { get; set; }

    public DateTime Fecha { get; set; }

    public string? Ip { get; set; }

    public string? UserAgent { get; set; }

    public string? TokenJti { get; set; }

    public string? Detalle { get; set; }

    public virtual User? IdUsuarioNavigation { get; set; }
}
