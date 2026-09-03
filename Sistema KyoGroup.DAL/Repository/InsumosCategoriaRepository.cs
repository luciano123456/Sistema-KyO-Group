using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class InsumosCategoriaRepository : IInsumosCategoriaRepository<InsumosCategoria>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public InsumosCategoriaRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(InsumosCategoria model)
        {
            var existente = await _dbcontext.InsumosCategorias.FirstOrDefaultAsync(x => x.Id == model.Id);
            if (existente == null) return false;
            var antes = existente.Nombre;
            existente.Nombre = model.Nombre;
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.CategoriaInsumo, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"categoría de insumos \"{existente.Nombre}\"", antes, existente.Nombre);
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            InsumosCategoria model = _dbcontext.InsumosCategorias.First(c => c.Id == id);
            var nombre = model.Nombre;
            _dbcontext.InsumosCategorias.Remove(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.CategoriaInsumo, id,
                EntidadHistorialHelper.AccionEliminacion, $"categoría de insumos \"{nombre}\"", nombre, null);
            return true;
        }

        public async Task<bool> Insertar(InsumosCategoria model)
        {
            _dbcontext.InsumosCategorias.Add(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.CategoriaInsumo, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"categoría de insumos \"{model.Nombre}\"", null, model.Nombre);
            return true;
        }

        public async Task<InsumosCategoria> Obtener(int id)
        {
            InsumosCategoria model = await _dbcontext.InsumosCategorias.FindAsync(id);
            return model;
        }

        public async Task<IQueryable<InsumosCategoria>> ObtenerTodos()
        {
            IQueryable<InsumosCategoria> query = _dbcontext.InsumosCategorias;
            return await Task.FromResult(query);
        }
    }
}
