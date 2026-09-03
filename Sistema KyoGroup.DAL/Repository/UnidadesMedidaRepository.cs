using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class UnidadesMedidaRepository : IUnidadesMedidaRepository<UnidadesMedida>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public UnidadesMedidaRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(UnidadesMedida model)
        {
            var existente = await _dbcontext.UnidadesMedida.FirstOrDefaultAsync(x => x.Id == model.Id);
            if (existente == null) return false;
            var antes = existente.Nombre;
            existente.Nombre = model.Nombre;
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.UnidadMedida, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"unidad de medida \"{existente.Nombre}\"", antes, existente.Nombre);
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            UnidadesMedida model = _dbcontext.UnidadesMedida.First(c => c.Id == id);
            var nombre = model.Nombre;
            _dbcontext.UnidadesMedida.Remove(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.UnidadMedida, id,
                EntidadHistorialHelper.AccionEliminacion, $"unidad de medida \"{nombre}\"", nombre, null);
            return true;
        }

        public async Task<bool> Insertar(UnidadesMedida model)
        {
            _dbcontext.UnidadesMedida.Add(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.UnidadMedida, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"unidad de medida \"{model.Nombre}\"", null, model.Nombre);
            return true;
        }

        public async Task<UnidadesMedida> Obtener(int id)
        {
            UnidadesMedida model = await _dbcontext.UnidadesMedida.FindAsync(id);
            return model;
        }

        public async Task<IQueryable<UnidadesMedida>> ObtenerTodos()
        {
            IQueryable<UnidadesMedida> query = _dbcontext.UnidadesMedida;
            return await Task.FromResult(query);
        }
    }
}
