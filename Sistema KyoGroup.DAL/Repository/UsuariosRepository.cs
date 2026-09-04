using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;
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
                var existente = await _dbcontext.Usuarios.FirstOrDefaultAsync(u => u.Id == model.Id);
                if (existente == null) return false;

                var rolAntes = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "Rol", existente.IdRol);
                var estAntes = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "EstadoUsuario", existente.IdEstado);

                var antes = EntidadHistorialHelper.Snapshot(
                    ("Usuario", existente.Usuario),
                    ("Nombre", existente.Nombre),
                    ("Apellido", existente.Apellido),
                    ("DNI", existente.Dni),
                    ("Teléfono", existente.Telefono),
                    ("Dirección", existente.Direccion),
                    ("Rol", rolAntes),
                    ("Estado", estAntes),
                    ("AvatarColor", existente.AvatarColor),
                    ("AvatarIcono", existente.AvatarIcono),
                    ("TieneFoto", !string.IsNullOrEmpty(existente.AvatarFoto)),
                    ("Contraseña", "***")); // nunca logueamos el valor real

                var pwdChanged = !string.IsNullOrWhiteSpace(model.Contrasena)
                    && !string.Equals(model.Contrasena, existente.Contrasena, StringComparison.Ordinal);

                existente.Usuario = model.Usuario;
                existente.Nombre = model.Nombre;
                existente.Apellido = model.Apellido;
                existente.Dni = model.Dni;
                existente.Telefono = model.Telefono;
                existente.Direccion = model.Direccion;
                existente.IdRol = model.IdRol;
                existente.IdEstado = model.IdEstado;
                existente.AvatarColor = model.AvatarColor;
                existente.AvatarIcono = model.AvatarIcono;
                if (model.AvatarFoto != null) existente.AvatarFoto = model.AvatarFoto;
                if (pwdChanged) existente.Contrasena = model.Contrasena;

                var rolDespues = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "Rol", existente.IdRol);
                var estDespues = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "EstadoUsuario", existente.IdEstado);

                var despues = EntidadHistorialHelper.Snapshot(
                    ("Usuario", existente.Usuario),
                    ("Nombre", existente.Nombre),
                    ("Apellido", existente.Apellido),
                    ("DNI", existente.Dni),
                    ("Teléfono", existente.Telefono),
                    ("Dirección", existente.Direccion),
                    ("Rol", rolDespues),
                    ("Estado", estDespues),
                    ("AvatarColor", existente.AvatarColor),
                    ("AvatarIcono", existente.AvatarIcono),
                    ("TieneFoto", !string.IsNullOrEmpty(existente.AvatarFoto)),
                    ("Contraseña", pwdChanged ? "(cambiada)" : "***"));

                var uid = EntidadHistorialHelper.ResolveUserId(model.IdUsuarioAccion);
                if (uid <= 0) uid = existente.Id;
                var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                EntidadHistorialHelper.AgregarSiCambio(
                    _dbcontext, EntidadHistorialHelper.Usuario, existente.Id,
                    $"usuario \"{existente.Usuario}\"", antes, despues, uid, nombre);

                await _dbcontext.SaveChangesAsync();
                return true;
            }
            catch { return false; }
        }

        public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
        {
            try
            {
                var model = await _dbcontext.Usuarios.FirstOrDefaultAsync(c => c.Id == id);
                if (model == null) return DeleteResult.NotFound("el usuario");

                if (!await _dbcontext.Usuarios.AnyAsync(u => u.Id != id))
                    return DeleteResult.Error("No se puede eliminar el único usuario del sistema.");

                var tablas = await UsuarioDeleteHelper.ListarDependenciasAsync(_dbcontext, id);
                var deps = UsuarioDeleteHelper.ToDeleteDeps(tablas);

                if (!cascade && deps.Count > 0)
                {
                    return DeleteResult.Relacion(
                        "Este usuario tiene registros asociados. Se eliminarán asignaciones y sesiones, y se desvinculará de la auditoría (insumos, recetas, etc.). Los datos de negocio no se borran.",
                        deps,
                        cascadeDisponible: true);
                }

                int? idReasignar = null;
                if (tablas.Any(t => t.RequiereReasignar))
                {
                    var actor = EntidadHistorialHelper.ResolveUserId(model.IdUsuarioAccion);
                    idReasignar = actor > 0 && actor != id
                        ? actor
                        : await _dbcontext.Usuarios
                            .Where(u => u.Id != id)
                            .OrderBy(u => u.Id)
                            .Select(u => (int?)u.Id)
                            .FirstOrDefaultAsync();

                    if (idReasignar is not > 0)
                        return DeleteResult.Error(
                            "No se puede eliminar el usuario: hay referencias que requieren reasignarse a otro usuario.");
                }

                await using var tx = await _dbcontext.Database.BeginTransactionAsync();

                if (tablas.Count > 0)
                    await UsuarioDeleteHelper.DesvincularAsync(_dbcontext, tablas, id, idReasignar);

                var uid = EntidadHistorialHelper.ResolveUserId(model.IdUsuarioAccion);
                var userName = model.Usuario;
                _dbcontext.Usuarios.Remove(model);
                var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                EntidadHistorialHelper.Agregar(
                    _dbcontext, EntidadHistorialHelper.Usuario, id,
                    EntidadHistorialHelper.AccionEliminacion,
                    tablas.Count > 0
                        ? $"Eliminación de usuario \"{userName}\" (referencias desvinculadas)"
                        : $"Eliminación de usuario \"{userName}\"",
                    null, uid > 0 ? uid : id, nombre ?? userName);
                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return DeleteResult.Success("Usuario eliminado correctamente.");
            }
            catch (Exception ex)
            {
                var raw = ex.InnerException?.Message ?? ex.Message;
                if (raw.Contains("REFERENCE", StringComparison.OrdinalIgnoreCase)
                    || raw.Contains("DELETE statement", StringComparison.OrdinalIgnoreCase))
                {
                    return DeleteResult.Error(
                        "No se pudo eliminar el usuario porque todavía tiene registros asociados en el sistema.");
                }
                return DeleteResult.Error("No se pudo eliminar el usuario: " + raw);
            }
        }

        public async Task<bool> Insertar(User model)
        {
            try
            {
                _dbcontext.Usuarios.Add(model);
                await _dbcontext.SaveChangesAsync();

                var uid = EntidadHistorialHelper.ResolveUserId(model.IdUsuarioAccion);
                if (uid <= 0) uid = model.Id;
                var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                var rolNom = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "Rol", model.IdRol);
                var estNom = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "EstadoUsuario", model.IdEstado);
                EntidadHistorialHelper.Agregar(
                    _dbcontext, EntidadHistorialHelper.Usuario, model.Id,
                    EntidadHistorialHelper.AccionCreacion,
                    $"Alta de usuario \"{model.Usuario}\"",
                    $"Nombre: {model.Nombre} {model.Apellido}. Rol: {rolNom}. Estado: {estNom}.",
                    uid, nombre);
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

        public async Task<GridResult<User>> ListarPaginado(GridQuery q)
        {
            var baseQuery = _dbcontext.Usuarios.AsNoTracking();
            var total = await baseQuery.CountAsync();
            var filteredQuery = ApplyUserFilters(baseQuery, q);
            var filtered = await filteredQuery.CountAsync();
            filteredQuery = ApplyUserSort(filteredQuery, q.OrderColumn, q.OrderDesc);

            var items = await filteredQuery
                .Include(c => c.IdEstadoNavigation)
                .Include(c => c.IdRolNavigation)
                .Skip(q.Skip)
                .Take(q.Take)
                .ToListAsync();

            return new GridResult<User> { Total = total, Filtered = filtered, Items = items };
        }

        private static IQueryable<User> ApplyUserFilters(IQueryable<User> query, GridQuery q)
        {
            if (!string.IsNullOrWhiteSpace(q.Search))
            {
                var s = q.Search.Trim().ToLower();
                query = query.Where(u =>
                    u.Usuario.ToLower().Contains(s) ||
                    u.Nombre.ToLower().Contains(s) ||
                    u.Apellido.ToLower().Contains(s) ||
                    u.Dni.ToLower().Contains(s));
            }

            foreach (var (col, val) in q.ColumnSearches)
            {
                if (string.IsNullOrWhiteSpace(val)) continue;
                var vl = val.Trim().ToLower();
                // Índice 3 = "Dónde está" (presencia): no se filtra en servidor.
                switch (col)
                {
                    case 2: query = query.Where(u => u.Usuario.ToLower().Contains(vl)); break;
                    case 4: query = query.Where(u => u.Nombre.ToLower().Contains(vl)); break;
                    case 5: query = query.Where(u => u.Apellido.ToLower().Contains(vl)); break;
                    case 6: query = query.Where(u => u.Dni.ToLower().Contains(vl)); break;
                    case 7: query = query.Where(u => u.Telefono.ToLower().Contains(vl)); break;
                    case 8: query = query.Where(u => u.Direccion.ToLower().Contains(vl)); break;
                    case 9: query = query.Where(u => u.IdRolNavigation.Nombre.ToLower() == vl); break;
                    case 10: query = query.Where(u => u.IdEstadoNavigation.Nombre.ToLower() == vl); break;
                }
            }

            return query;
        }

        private static IQueryable<User> ApplyUserSort(IQueryable<User> query, int orderColumn, bool desc)
        {
            return orderColumn switch
            {
                1 => desc ? query.OrderByDescending(u => u.Id) : query.OrderBy(u => u.Id),
                2 => desc ? query.OrderByDescending(u => u.Usuario) : query.OrderBy(u => u.Usuario),
                3 => desc ? query.OrderByDescending(u => u.UltimoModulo) : query.OrderBy(u => u.UltimoModulo),
                4 => desc ? query.OrderByDescending(u => u.Nombre) : query.OrderBy(u => u.Nombre),
                5 => desc ? query.OrderByDescending(u => u.Apellido) : query.OrderBy(u => u.Apellido),
                6 => desc ? query.OrderByDescending(u => u.Dni) : query.OrderBy(u => u.Dni),
                7 => desc ? query.OrderByDescending(u => u.Telefono) : query.OrderBy(u => u.Telefono),
                8 => desc ? query.OrderByDescending(u => u.Direccion) : query.OrderBy(u => u.Direccion),
                9 => desc ? query.OrderByDescending(u => u.IdRolNavigation!.Nombre) : query.OrderBy(u => u.IdRolNavigation!.Nombre),
                10 => desc ? query.OrderByDescending(u => u.IdEstadoNavigation!.Nombre) : query.OrderBy(u => u.IdEstadoNavigation!.Nombre),
                _ => desc ? query.OrderByDescending(u => u.Usuario) : query.OrderBy(u => u.Usuario)
            };
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
