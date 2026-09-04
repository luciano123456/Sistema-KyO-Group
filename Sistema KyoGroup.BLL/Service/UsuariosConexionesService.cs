using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IUsuariosConexionesService
    {
        Task RegistrarConexionAsync(int idUsuario, string? tokenJti, string? ip, string? userAgent);
        Task RegistrarDesconexionAsync(int idUsuario, byte tipo, string? tokenJti, string? ip, string? userAgent, string? detalle = null);
        Task HeartbeatAsync(int idUsuario, string? ultimoModulo = null);
        Task<IReadOnlyList<UsuariosConexion>> HistorialAsync(int idUsuario, int take = 100);
        Task<IReadOnlyList<PresenciaUsuarioDto>> ListarPresenciaAsync(int minutosTolerancia = 5);
        bool EstaEnLinea(DateTime? fechaUltimaActividadUtc, int minutosTolerancia = 5);
    }

    public record PresenciaUsuarioDto(
        int Id,
        bool EnLinea,
        string? UltimoModulo,
        string? Nombre,
        string? Apellido,
        string? AvatarColor,
        string? AvatarIcono,
        string? AvatarFoto);

    public class UsuariosConexionesService : IUsuariosConexionesService
    {
        /// <summary>Debe coincidir con el catálogo de RpModulos.js.</summary>
        private static readonly HashSet<string> ModulosPermitidos = new(StringComparer.OrdinalIgnoreCase)
        {
            "Proveedores", "Recetas", "Insumos", "Ventas", "AnalisisDatos", "Usuarios", "Finanzas"
        };

        private readonly IUsuariosConexionesRepository _repo;

        public UsuariosConexionesService(IUsuariosConexionesRepository repo)
        {
            _repo = repo;
        }

        public async Task RegistrarConexionAsync(int idUsuario, string? tokenJti, string? ip, string? userAgent)
        {
            var now = DateTime.UtcNow;
            await _repo.RegistrarAsync(new UsuariosConexion
            {
                IdUsuario = idUsuario,
                Tipo = UsuariosConexion.TipoConecto,
                Fecha = now,
                Ip = Trunc(ip, 64),
                UserAgent = Trunc(userAgent, 512),
                TokenJti = Trunc(tokenJti, 64),
                Detalle = "Inicio de sesión"
            });
            await _repo.ActualizarUltimaActividadAsync(idUsuario, now, forzar: true);
        }

        public async Task RegistrarDesconexionAsync(int idUsuario, byte tipo, string? tokenJti, string? ip, string? userAgent, string? detalle = null)
        {
            if (tipo != UsuariosConexion.TipoDesconecto && tipo != UsuariosConexion.TipoExpiro)
                tipo = UsuariosConexion.TipoDesconecto;

            var now = DateTime.UtcNow;
            await _repo.RegistrarAsync(new UsuariosConexion
            {
                IdUsuario = idUsuario,
                Tipo = tipo,
                Fecha = now,
                Ip = Trunc(ip, 64),
                UserAgent = Trunc(userAgent, 512),
                TokenJti = Trunc(tokenJti, 64),
                Detalle = detalle
                    ?? (tipo == UsuariosConexion.TipoExpiro ? "Sesión expirada" : "Cierre de sesión")
            });

            await _repo.ActualizarUltimaActividadAsync(
                idUsuario,
                now.AddMinutes(-30),
                forzar: true,
                limpiarModulo: true);
        }

        public Task HeartbeatAsync(int idUsuario, string? ultimoModulo = null)
            => _repo.ActualizarUltimaActividadAsync(
                idUsuario,
                DateTime.UtcNow,
                forzar: false,
                ultimoModulo: SanitizeModulo(ultimoModulo));

        public Task<IReadOnlyList<UsuariosConexion>> HistorialAsync(int idUsuario, int take = 100)
            => _repo.ListarPorUsuarioAsync(idUsuario, take);

        public async Task<IReadOnlyList<PresenciaUsuarioDto>> ListarPresenciaAsync(int minutosTolerancia = 5)
        {
            var rows = await _repo.ListarPresenciaAsync();
            return rows
                .Select(r => new PresenciaUsuarioDto(
                    r.Id,
                    EstaEnLinea(r.FechaUltimaActividad, minutosTolerancia),
                    r.UltimoModulo,
                    r.Nombre,
                    r.Apellido,
                    r.AvatarColor,
                    r.AvatarIcono,
                    r.AvatarFoto))
                .ToList();
        }

        public bool EstaEnLinea(DateTime? fechaUltimaActividadUtc, int minutosTolerancia = 5)
        {
            if (!fechaUltimaActividadUtc.HasValue) return false;
            return fechaUltimaActividadUtc.Value >= DateTime.UtcNow.AddMinutes(-Math.Abs(minutosTolerancia));
        }

        public static string? SanitizeModulo(string? modulo)
        {
            if (string.IsNullOrWhiteSpace(modulo)) return null;
            var m = modulo.Trim();
            if (!ModulosPermitidos.Contains(m)) return null;
            // Canonical casing from set
            return ModulosPermitidos.First(x => x.Equals(m, StringComparison.OrdinalIgnoreCase));
        }

        private static string? Trunc(string? value, int max)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            value = value.Trim();
            return value.Length <= max ? value : value[..max];
        }
    }
}
