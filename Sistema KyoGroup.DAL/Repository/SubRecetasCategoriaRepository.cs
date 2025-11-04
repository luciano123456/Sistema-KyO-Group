using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;
using SistemaKyoGroup.DAL.DataContext;

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
            _dbcontext.SubRecetasCategorias.Update(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            SubRecetasCategoria model = _dbcontext.SubRecetasCategorias.First(c => c.Id == id);
            _dbcontext.SubRecetasCategorias.Remove(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Insertar(SubRecetasCategoria model)
        {
            _dbcontext.SubRecetasCategorias.Add(model);
            await _dbcontext.SaveChangesAsync();
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
