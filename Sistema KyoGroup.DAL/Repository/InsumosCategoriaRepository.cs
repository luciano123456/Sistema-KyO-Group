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
    public class InsumosCategoriaRepository : IInsumosCategoriaRepository<InsumosCategoria>
    {

        private readonly SistemaKyoGroupContext _dbcontext;

        public InsumosCategoriaRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }
        public async Task<bool> Actualizar(InsumosCategoria model)
        {
            _dbcontext.InsumosCategorias.Update(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            InsumosCategoria model = _dbcontext.InsumosCategorias.First(c => c.Id == id);
            _dbcontext.InsumosCategorias.Remove(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Insertar(InsumosCategoria model)
        {
            _dbcontext.InsumosCategorias.Add(model);
            await _dbcontext.SaveChangesAsync();
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
