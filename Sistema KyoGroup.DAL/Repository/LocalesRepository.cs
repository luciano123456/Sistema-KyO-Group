using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;

namespace SistemaKyoGroup.DAL.Repository
{
    public class LocalesRepository : ILocalesRepository<Local>
    {

        private readonly SistemaKyoGroupContext _dbcontext;

        public LocalesRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }
        public async Task<bool> Actualizar(Local model)
        {
            _dbcontext.Locales.Update(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            Local model = _dbcontext.Locales.First(c => c.Id == id);
            _dbcontext.Locales.Remove(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Insertar(Local model)
        {
            _dbcontext.Locales.Add(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<Local> Obtener(int id)
        {
            Local model = await _dbcontext.Locales.FindAsync(id);
            return model;
        }


        public Task<IQueryable<Local>> ObtenerPorUnidad(int idUnidadNegocio)
        {
            IQueryable<Local> query = _dbcontext.Locales
                .Where(x => x.IdUnidadNegocio == idUnidadNegocio);

            return Task.FromResult(query);
        }



        public async Task<IQueryable<Local>> ObtenerTodos()
        {
            IQueryable<Local> query = _dbcontext.Locales;
            return await Task.FromResult(query);
        }




    }
}
