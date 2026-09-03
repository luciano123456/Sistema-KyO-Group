using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class EstadosUsuariosRepository : IEstadosUsuariosRepository<EstadosUsuario>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public EstadosUsuariosRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(EstadosUsuario model)
        {
            var existente = await _dbcontext.EstadosUsuarios.FirstOrDefaultAsync(x => x.Id == model.Id);
            if (existente == null) return false;
            var antes = existente.Nombre;
            existente.Nombre = model.Nombre;
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.EstadoUsuario, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"estado de usuario \"{existente.Nombre}\"", antes, existente.Nombre);
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            EstadosUsuario model = _dbcontext.EstadosUsuarios.First(c => c.Id == id);
            var nombre = model.Nombre;
            _dbcontext.EstadosUsuarios.Remove(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.EstadoUsuario, id,
                EntidadHistorialHelper.AccionEliminacion, $"estado de usuario \"{nombre}\"", nombre, null);
            return true;
        }

        public async Task<bool> Insertar(EstadosUsuario model)
        {
            _dbcontext.EstadosUsuarios.Add(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.EstadoUsuario, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"estado de usuario \"{model.Nombre}\"", null, model.Nombre);
            return true;
        }

        public async Task<EstadosUsuario> Obtener(int id)
        {
            EstadosUsuario model = await _dbcontext.EstadosUsuarios.FindAsync(id);
            return model;
        }

        public async Task<IQueryable<EstadosUsuario>> ObtenerTodos()
        {
            IQueryable<EstadosUsuario> query = _dbcontext.EstadosUsuarios;
            return await Task.FromResult(query);
        }
    }
}
