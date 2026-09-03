using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class UsuariosConexionesRepository : IUsuariosConexionesRepository
    {
        private readonly SistemaKyoGroupContext _db;

        public UsuariosConexionesRepository(SistemaKyoGroupContext db)
        {
            _db = db;
        }

        public async Task RegistrarAsync(UsuariosConexion evento)
        {
            _db.UsuariosConexiones.Add(evento);
            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Update directo (sin cargar entidad). Sin forzar, solo escribe actividad si pasaron ~90s.
        /// UltimoModulo se actualiza siempre que venga informado o se pida limpiar.
        /// </summary>
        public async Task ActualizarUltimaActividadAsync(
            int idUsuario,
            DateTime utcNow,
            bool forzar = false,
            string? ultimoModulo = null,
            bool limpiarModulo = false)
        {
            if (limpiarModulo)
            {
                await _db.Usuarios
                    .Where(u => u.Id == idUsuario)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(u => u.FechaUltimaActividad, utcNow)
                        .SetProperty(u => u.UltimoModulo, (string?)null));
                return;
            }

            var moduloNorm = NormalizeModulo(ultimoModulo);

            if (forzar)
            {
                if (moduloNorm != null)
                {
                    await _db.Usuarios
                        .Where(u => u.Id == idUsuario)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(u => u.FechaUltimaActividad, utcNow)
                            .SetProperty(u => u.UltimoModulo, moduloNorm));
                }
                else
                {
                    await _db.Usuarios
                        .Where(u => u.Id == idUsuario)
                        .ExecuteUpdateAsync(s => s.SetProperty(u => u.FechaUltimaActividad, utcNow));
                }
                return;
            }

            var limite = utcNow.AddSeconds(-90);

            if (moduloNorm != null)
            {
                // Siempre actualiza módulo si cambió o estaba vacío.
                // OJO: en SQL `NULL != 'X'` no es TRUE → hay que contemplar UltimoModulo == null.
                await _db.Usuarios
                    .Where(u => u.Id == idUsuario
                        && (u.UltimoModulo == null || u.UltimoModulo != moduloNorm))
                    .ExecuteUpdateAsync(s => s.SetProperty(u => u.UltimoModulo, moduloNorm));

                await _db.Usuarios
                    .Where(u => u.Id == idUsuario
                        && (u.FechaUltimaActividad == null || u.FechaUltimaActividad < limite))
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(u => u.FechaUltimaActividad, utcNow)
                        .SetProperty(u => u.UltimoModulo, moduloNorm));
                return;
            }

            await _db.Usuarios
                .Where(u => u.Id == idUsuario
                    && (u.FechaUltimaActividad == null || u.FechaUltimaActividad < limite))
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.FechaUltimaActividad, utcNow));
        }

        public async Task<IReadOnlyList<UsuariosConexion>> ListarPorUsuarioAsync(int idUsuario, int take = 100)
        {
            take = Math.Clamp(take, 1, 200);
            return await _db.UsuariosConexiones
                .AsNoTracking()
                .Where(x => x.IdUsuario == idUsuario)
                .OrderByDescending(x => x.Fecha)
                .ThenByDescending(x => x.Id)
                .Take(take)
                .ToListAsync();
        }

        public async Task<IReadOnlyList<(int Id, DateTime? FechaUltimaActividad, string? UltimoModulo, string? Nombre, string? Apellido, string? AvatarColor, string? AvatarIcono, string? AvatarFoto)>> ListarPresenciaAsync()
        {
            var rows = await _db.Usuarios
                .AsNoTracking()
                .Select(u => new
                {
                    u.Id,
                    u.FechaUltimaActividad,
                    u.UltimoModulo,
                    u.Nombre,
                    u.Apellido,
                    u.AvatarColor,
                    u.AvatarIcono,
                    u.AvatarFoto
                })
                .ToListAsync();

            return rows
                .Select(r => (r.Id, r.FechaUltimaActividad, r.UltimoModulo, r.Nombre, r.Apellido, r.AvatarColor, r.AvatarIcono, r.AvatarFoto))
                .ToList();
        }

        private static string? NormalizeModulo(string? modulo)
        {
            if (string.IsNullOrWhiteSpace(modulo)) return null;
            var m = modulo.Trim();
            if (m.Length > 40) m = m[..40];
            return m;
        }
    }
}
