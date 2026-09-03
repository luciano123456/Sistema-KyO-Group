using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class RecetasCategoriaRepository : IRecetasCategoriaRepository<RecetasCategoria>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public RecetasCategoriaRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(RecetasCategoria model)
        {
            var existente = await _dbcontext.RecetasCategorias.FirstOrDefaultAsync(x => x.Id == model.Id);
            if (existente == null) return false;
            var antes = existente.Nombre;
            existente.Nombre = model.Nombre;
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.CategoriaReceta, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"categoría de recetas \"{existente.Nombre}\"", antes, existente.Nombre);
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            RecetasCategoria model = _dbcontext.RecetasCategorias.First(c => c.Id == id);
            var nombre = model.Nombre;
            _dbcontext.RecetasCategorias.Remove(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.CategoriaReceta, id,
                EntidadHistorialHelper.AccionEliminacion, $"categoría de recetas \"{nombre}\"", nombre, null);
            return true;
        }

        public async Task<bool> Insertar(RecetasCategoria model)
        {
            _dbcontext.RecetasCategorias.Add(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.CategoriaReceta, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"categoría de recetas \"{model.Nombre}\"", null, model.Nombre);
            return true;
        }

        public async Task<RecetasCategoria> Obtener(int id)
        {
            RecetasCategoria model = await _dbcontext.RecetasCategorias.FindAsync(id);
            return model;
        }

        public async Task<IQueryable<RecetasCategoria>> ObtenerTodos()
        {
            IQueryable<RecetasCategoria> query = _dbcontext.RecetasCategorias;
            return await Task.FromResult(query);
        }
    }
}
