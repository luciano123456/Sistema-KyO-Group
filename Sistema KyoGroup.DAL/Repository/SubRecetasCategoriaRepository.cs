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
    public class SubrecetasCategoriaRepository : ISubrecetasCategoriaRepository<SubrecetasCategoria>
    {

        private readonly SistemaKyoGroupContext _dbcontext;

        public SubrecetasCategoriaRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }
        public async Task<bool> Actualizar(SubrecetasCategoria model)
        {
            _dbcontext.SubrecetasCategorias.Update(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            SubrecetasCategoria model = _dbcontext.SubrecetasCategorias.First(c => c.Id == id);
            _dbcontext.SubrecetasCategorias.Remove(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Insertar(SubrecetasCategoria model)
        {
            _dbcontext.SubrecetasCategorias.Add(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<SubrecetasCategoria> Obtener(int id)
        {
            SubrecetasCategoria model = await _dbcontext.SubrecetasCategorias.FindAsync(id);
            return model;
        }
        public async Task<IQueryable<SubrecetasCategoria>> ObtenerTodos()
        {
            IQueryable<SubrecetasCategoria> query = _dbcontext.SubrecetasCategorias;
            return await Task.FromResult(query);
        }




    }
}
