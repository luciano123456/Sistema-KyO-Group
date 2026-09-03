using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IUsuariosConexionesRepository
    {
        Task RegistrarAsync(UsuariosConexion evento);
        Task ActualizarUltimaActividadAsync(int idUsuario, DateTime utcNow, bool forzar = false, string? ultimoModulo = null, bool limpiarModulo = false);
        Task<IReadOnlyList<UsuariosConexion>> ListarPorUsuarioAsync(int idUsuario, int take = 100);
        Task<IReadOnlyList<(int Id, DateTime? FechaUltimaActividad, string? UltimoModulo, string? Nombre, string? Apellido, string? AvatarColor, string? AvatarIcono, string? AvatarFoto)>> ListarPresenciaAsync();
    }
}
