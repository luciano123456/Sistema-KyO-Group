using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class OrdenesComprasEstadoRepository : IOrdenesComprasEstadoRepository<OrdenesComprasEstado>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public OrdenesComprasEstadoRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(OrdenesComprasEstado model)
        {
            var existente = await _dbcontext.OrdenesComprasEstados.FirstOrDefaultAsync(x => x.Id == model.Id);
            if (existente == null) return false;
            var antes = existente.Nombre;
            existente.Nombre = model.Nombre;
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.EstadoOrdenCompra, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"estado de OC \"{existente.Nombre}\"", antes, existente.Nombre);
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            OrdenesComprasEstado model = _dbcontext.OrdenesComprasEstados.First(c => c.Id == id);
            var nombre = model.Nombre;
            _dbcontext.OrdenesComprasEstados.Remove(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.EstadoOrdenCompra, id,
                EntidadHistorialHelper.AccionEliminacion, $"estado de OC \"{nombre}\"", nombre, null);
            return true;
        }

        public async Task<bool> Insertar(OrdenesComprasEstado model)
        {
            _dbcontext.OrdenesComprasEstados.Add(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.EstadoOrdenCompra, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"estado de OC \"{model.Nombre}\"", null, model.Nombre);
            return true;
        }

        public async Task<OrdenesComprasEstado> Obtener(int id)
        {
            OrdenesComprasEstado model = await _dbcontext.OrdenesComprasEstados.FindAsync(id);
            return model;
        }

        public async Task<IQueryable<OrdenesComprasEstado>> ObtenerTodos()
        {
            IQueryable<OrdenesComprasEstado> query = _dbcontext.OrdenesComprasEstados;
            return await Task.FromResult(query);
        }
    }
}
