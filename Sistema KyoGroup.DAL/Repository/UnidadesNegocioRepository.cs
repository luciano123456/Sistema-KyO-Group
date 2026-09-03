using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class UnidadesNegocioRepository : IUnidadesNegocioRepository<UnidadesNegocio>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public UnidadesNegocioRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(UnidadesNegocio model)
        {
            var existente = await _dbcontext.UnidadesNegocios.FirstOrDefaultAsync(x => x.Id == model.Id);
            if (existente == null) return false;
            var antes = existente.Nombre;
            existente.Nombre = model.Nombre;
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.UnidadNegocio, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"unidad de negocio \"{existente.Nombre}\"", antes, existente.Nombre);
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            UnidadesNegocio model = _dbcontext.UnidadesNegocios.First(c => c.Id == id);
            var nombre = model.Nombre;
            _dbcontext.UnidadesNegocios.Remove(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.UnidadNegocio, id,
                EntidadHistorialHelper.AccionEliminacion, $"unidad de negocio \"{nombre}\"", nombre, null);
            return true;
        }

        public async Task<bool> Insertar(UnidadesNegocio model)
        {
            _dbcontext.UnidadesNegocios.Add(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.UnidadNegocio, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"unidad de negocio \"{model.Nombre}\"", null, model.Nombre);
            return true;
        }

        public async Task<UnidadesNegocio> Obtener(int id)
        {
            UnidadesNegocio model = await _dbcontext.UnidadesNegocios.FindAsync(id);
            return model;
        }

        public async Task<IQueryable<UnidadesNegocio>> ObtenerTodos()
        {
            IQueryable<UnidadesNegocio> query = _dbcontext.UnidadesNegocios;
            return await Task.FromResult(query);
        }

        public async Task<IQueryable<UnidadesNegocio>> ObtenerTodosUsuario(int idUsuario)
        {
            try
            {
                var query = _dbcontext.UsuariosUnidadesNegocios
                    .AsNoTracking()
                    .Include(x => x.IdUnidadNegocioNavigation)
                    .Where(x => x.IdUsuario == idUsuario)
                    .Select(x => x.IdUnidadNegocioNavigation);
                return await Task.FromResult(query);
            }
            catch
            {
                return Enumerable.Empty<UnidadesNegocio>().AsQueryable();
            }
        }
    }
}
