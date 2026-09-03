using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class SubRecetasCategoriaRepository : ISubRecetasCategoriaRepository<SubRecetasCategoria>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public SubRecetasCategoriaRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Actualizar(SubRecetasCategoria model)
        {
            var existente = await _dbcontext.SubRecetasCategorias.FirstOrDefaultAsync(x => x.Id == model.Id);
            if (existente == null) return false;
            var antes = existente.Nombre;
            existente.Nombre = model.Nombre;
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.CategoriaSubReceta, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"categoría de subrecetas \"{existente.Nombre}\"", antes, existente.Nombre);
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            SubRecetasCategoria model = _dbcontext.SubRecetasCategorias.First(c => c.Id == id);
            var nombre = model.Nombre;
            _dbcontext.SubRecetasCategorias.Remove(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.CategoriaSubReceta, id,
                EntidadHistorialHelper.AccionEliminacion, $"categoría de subrecetas \"{nombre}\"", nombre, null);
            return true;
        }

        public async Task<bool> Insertar(SubRecetasCategoria model)
        {
            _dbcontext.SubRecetasCategorias.Add(model);
            await _dbcontext.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _dbcontext, EntidadHistorialHelper.CategoriaSubReceta, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"categoría de subrecetas \"{model.Nombre}\"", null, model.Nombre);
            return true;
        }

        public async Task<SubRecetasCategoria> Obtener(int id)
        {
            SubRecetasCategoria model = await _dbcontext.SubRecetasCategorias.FindAsync(id);
            return model;
        }

        public async Task<IQueryable<SubRecetasCategoria>> ObtenerTodos()
        {
            IQueryable<SubRecetasCategoria> query = _dbcontext.SubRecetasCategorias;
            return await Task.FromResult(query);
        }
    }
}
