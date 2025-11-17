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
    public class OrdenesComprasEstadoRepository : IOrdenesComprasEstadoRepository<OrdenesComprasEstado>
    {

        private readonly SistemaKyoGroupContext _dbcontext;

        public OrdenesComprasEstadoRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }
        public async Task<bool> Actualizar(OrdenesComprasEstado model)
        {
            _dbcontext.OrdenesComprasEstados.Update(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Eliminar(int id)
        {
            OrdenesComprasEstado model = _dbcontext.OrdenesComprasEstados.First(c => c.Id == id);
            _dbcontext.OrdenesComprasEstados.Remove(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Insertar(OrdenesComprasEstado model)
        {
            _dbcontext.OrdenesComprasEstados.Add(model);
            await _dbcontext.SaveChangesAsync();
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
