using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public class UsuariosRepository : IUsuariosRepository<User>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public UsuariosRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(User model)
        {
            try
            {
                _dbcontext.Usuarios.Update(model);
                await _dbcontext.SaveChangesAsync();
                return true;
            }
            catch { return false; }
        }

        public async Task<bool> Eliminar(int id)
        {
            try
            {
                User model = _dbcontext.Usuarios.First(c => c.Id == id);
                _dbcontext.Usuarios.Remove(model);
                await _dbcontext.SaveChangesAsync();
                return true;
            }
            catch { return false; }
        }

        public async Task<bool> Insertar(User model)
        {
            try
            {
                _dbcontext.Usuarios.Add(model);
                await _dbcontext.SaveChangesAsync();
                return true;
            }
            catch { return false; }
        }

        public async Task<User> Obtener(int id)
        {
            try
            {
                User model = await _dbcontext.Usuarios.FindAsync(id);
                return model;
            }
            catch { return null; }
        }

        public async Task<User> ObtenerUsuario(string usuario)
        {
            try
            {
                User model = await _dbcontext.Usuarios
                    .Where(x => x.Usuario.ToUpper() == usuario.ToUpper())
                    .FirstOrDefaultAsync();
                return model;
            }
            catch { return null; }
        }

        public async Task<IQueryable<User>> ObtenerTodos()
        {
            try
            {
                IQueryable<User> query = _dbcontext.Usuarios
                    .Include(c => c.IdEstadoNavigation)
                    .Include(c => c.IdRolNavigation);

                return await Task.FromResult(query);
            }
            catch { return null; }
        }


        public async Task<List<UsuariosUnidadesNegocio>> ObtenerUnidadesDeUsuario(int idUsuario)
        {
            return await _dbcontext.Set<UsuariosUnidadesNegocio>()
                .AsNoTracking()
                .Include(x => x.IdUnidadNegocioNavigation)
                .Where(x => x.IdUsuario == idUsuario)
                .ToListAsync();
        }

        public async Task<List<UsuariosLocal>> ObtenerLocalesDeUsuario(int idUsuario)
        {
            return await _dbcontext.Set<UsuariosLocal>()
                .AsNoTracking()
                .Include(x => x.IdLocalNavigation) // necesitamos IdUnidadNegocio del Local
                .Where(x => x.IdUsuario == idUsuario)
                .ToListAsync();
        }

        public async Task<bool> ReemplazarAsignacionesUsuario(
            int idUsuario,
            IEnumerable<int> unidades,
            IReadOnlyDictionary<int, IReadOnlyCollection<int>> localesPorUnidad)
        {
            using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // 1) limpiar anteriores
                var prevU = _dbcontext.Set<UsuariosUnidadesNegocio>().Where(x => x.IdUsuario == idUsuario);
                var prevL = _dbcontext.Set<UsuariosLocal>().Where(x => x.IdUsuario == idUsuario);
                _dbcontext.RemoveRange(prevU);
                _dbcontext.RemoveRange(prevL);
                await _dbcontext.SaveChangesAsync();

                // 2) insertar unidades
                foreach (var idUnidad in unidades.Distinct())
                {
                    _dbcontext.Add(new UsuariosUnidadesNegocio
                    {
                        IdUsuario = idUsuario,
                        IdUnidadNegocio = idUnidad
                    });
                }
                await _dbcontext.SaveChangesAsync();

                // 3) insertar locales (solo subset explícito)
                foreach (var kvp in localesPorUnidad)
                {
                    var listaLoc = kvp.Value?.Distinct() ?? Array.Empty<int>();
                    foreach (var idLocal in listaLoc)
                    {
                        _dbcontext.Add(new UsuariosLocal
                        {
                            IdUsuario = idUsuario,
                            IdLocal = idLocal
                        });
                    }
                }
                await _dbcontext.SaveChangesAsync();

                await tx.CommitAsync();
                return true;
            }
            catch
            {
                await tx.RollbackAsync();
                return false;
            }
        }
    }
}
