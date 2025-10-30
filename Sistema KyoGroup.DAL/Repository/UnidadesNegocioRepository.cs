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
    public class UnidadesNegocioRepository : IUnidadesNegocioRepository<UnidadesNegocio>
    {

        private readonly SistemaKyoGroupContext _dbcontext;

        public UnidadesNegocioRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }
        public async Task<bool> Actualizar(UnidadesNegocio model)
        {
            _dbcontext.UnidadesNegocios.Update(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            UnidadesNegocio model = _dbcontext.UnidadesNegocios.First(c => c.Id == id);
            _dbcontext.UnidadesNegocios.Remove(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Insertar(UnidadesNegocio model)
        {
            _dbcontext.UnidadesNegocios.Add(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<UnidadesNegocio> Obtener(int id)
        {
            UnidadesNegocio model = await _dbcontext.UnidadesNegocios.FindAsync(id);
            return model;
        }
        public async Task<IQueryable<UnidadesNegocio>> ObtenerTodos()
        {
            IQueryable<UnidadesNegocio> query = _dbcontext.UnidadesNegocios;
            return await Task.FromResult(query);
        }




    }
}
