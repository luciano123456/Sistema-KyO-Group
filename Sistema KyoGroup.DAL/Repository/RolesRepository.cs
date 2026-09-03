using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class RolesRepository : IRolesRepository<Rol>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public RolesRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(Rol model)
        {
            var existente = await _dbcontext.Roles.FirstOrDefaultAsync(r => r.Id == model.Id);
            if (existente == null) return false;
            var antes = existente.Nombre;
            existente.Nombre = model.Nombre;
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.Rol, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"rol \"{existente.Nombre}\"", antes, existente.Nombre);
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            Rol model = _dbcontext.Roles.First(c => c.Id == id);
            var nombre = model.Nombre;
            _dbcontext.Roles.Remove(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.Rol, id,
                EntidadHistorialHelper.AccionEliminacion, $"rol \"{nombre}\"", nombre, null);
            return true;
        }

        public async Task<bool> Insertar(Rol model)
        {
            _dbcontext.Roles.Add(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.Rol, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"rol \"{model.Nombre}\"", null, model.Nombre);
            return true;
        }

        public async Task<Rol> Obtener(int id)
        {
            Rol model = await _dbcontext.Roles.FindAsync(id);
            return model;
        }

        public async Task<IQueryable<Rol>> ObtenerTodos()
        {
            IQueryable<Rol> query = _dbcontext.Roles;
            return await Task.FromResult(query);
        }
    }
}
