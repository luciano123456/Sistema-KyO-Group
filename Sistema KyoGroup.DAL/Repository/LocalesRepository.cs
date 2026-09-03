using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository
{
    public class LocalesRepository : ILocalesRepository<Local>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public LocalesRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(Local model)
        {
            var existente = await _dbcontext.Locales.FirstOrDefaultAsync(x => x.Id == model.Id);
            if (existente == null) return false;
            var antes = EntidadHistorialHelper.Snapshot(
                ("Nombre", existente.Nombre),
                ("UN", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadNegocio", existente.IdUnidadNegocio)));
            existente.Nombre = model.Nombre;
            existente.IdUnidadNegocio = model.IdUnidadNegocio;
            var despues = EntidadHistorialHelper.Snapshot(
                ("Nombre", existente.Nombre),
                ("UN", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadNegocio", existente.IdUnidadNegocio)));
            await _dbcontext.SaveChangesAsync();
            var uid = EntidadHistorialHelper.ResolveUserId();
            if (uid > 0)
            {
                var user = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                EntidadHistorialHelper.AgregarSiCambio(
                    _dbcontext, EntidadHistorialHelper.Local, existente.Id,
                    $"local \"{existente.Nombre}\"", antes, despues, uid, user);
                await _dbcontext.SaveChangesAsync();
            }
            return true;
        }

        public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
        {
            try
            {
                var model = await _dbcontext.Locales.FirstOrDefaultAsync(c => c.Id == id);
                if (model == null) return DeleteResult.NotFound("el local");

                var nUserLoc = await _dbcontext.UsuariosLocales.CountAsync(x => x.IdLocal == id);
                var nOc = await _dbcontext.OrdenesCompras.CountAsync(x => x.IdLocal == id);
                var nCompras = await _dbcontext.Compras.CountAsync(x => x.IdLocal == id);
                var nImp = await _dbcontext.Importaciones.CountAsync(x => x.IdLocal == id);

                var deps = new List<DeleteDependencia>();
                if (nUserLoc > 0)
                    deps.Add(new DeleteDependencia { Entidad = "Usuarios", Cantidad = nUserLoc, Detalle = "Asignaciones de usuarios a este local", Cascadeable = true });
                if (nOc > 0)
                    deps.Add(new DeleteDependencia { Entidad = "Órdenes de compra", Cantidad = nOc, Detalle = "Hay OC asociadas; eliminá esas OC primero", Cascadeable = false });
                if (nCompras > 0)
                    deps.Add(new DeleteDependencia { Entidad = "Compras", Cantidad = nCompras, Detalle = "Hay compras asociadas; eliminá esas compras primero", Cascadeable = false });
                if (nImp > 0)
                    deps.Add(new DeleteDependencia { Entidad = "Importaciones de ventas", Cantidad = nImp, Detalle = "Hay importaciones asociadas; eliminá esas importaciones primero", Cascadeable = false });

                var bloqueantesNoCasc = deps.Where(d => !d.Cascadeable).ToList();
                var cascables = deps.Where(d => d.Cascadeable).ToList();

                if (!cascade && deps.Count > 0)
                {
                    return DeleteResult.Relacion(
                        "No se puede eliminar el local porque tiene registros asociados.",
                        deps,
                        cascadeDisponible: bloqueantesNoCasc.Count == 0 && cascables.Count > 0);
                }

                if (cascade)
                {
                    if (bloqueantesNoCasc.Count > 0)
                        return DeleteResult.Relacion(
                            "No se puede eliminar en cascada: hay documentos asociados que deben borrarse primero.",
                            deps,
                            cascadeDisponible: false);

                    if (nUserLoc > 0)
                        _dbcontext.UsuariosLocales.RemoveRange(
                            await _dbcontext.UsuariosLocales.Where(x => x.IdLocal == id).ToListAsync());
                }

                var nombre = model.Nombre;
                _dbcontext.Locales.Remove(model);
                await _dbcontext.SaveChangesAsync();
                await EntidadHistorialHelper.LogNombreCatalogoAsync(
                    _dbcontext, EntidadHistorialHelper.Local, id,
                    EntidadHistorialHelper.AccionEliminacion, $"local \"{nombre}\"", nombre, null);
                return DeleteResult.Success("Local eliminado correctamente.");
            }
            catch (Exception ex)
            {
                return DeleteResult.Error(
                    "No se pudo eliminar el local: " + (ex.InnerException?.Message ?? ex.Message));
            }
        }

        public async Task<bool> Insertar(Local model)
        {
            _dbcontext.Locales.Add(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.Local, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"local \"{model.Nombre}\"", null, model.Nombre,
                model.IdUnidadNegocio.HasValue ? $"UN: {model.IdUnidadNegocio}" : null);
            return true;
        }

        public async Task<Local> Obtener(int id)
        {
            Local model = await _dbcontext.Locales.FindAsync(id);
            return model;
        }

        public Task<IQueryable<Local>> ObtenerPorUnidad(int idUnidadNegocio)
        {
            IQueryable<Local> query = _dbcontext.Locales
                .Include(x => x.IdUnidadNegocioNavigation)
                .Where(x => x.IdUnidadNegocio == idUnidadNegocio);
            return Task.FromResult(query);
        }

        public async Task<IQueryable<Local>> ObtenerTodos()
        {
            IQueryable<Local> query = _dbcontext.Locales
                .Include(x => x.IdUnidadNegocioNavigation);
            return await Task.FromResult(query);
        }
    }
}
