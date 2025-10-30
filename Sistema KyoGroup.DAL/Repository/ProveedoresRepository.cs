using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public class ProveedoresRepository : IProveedoresRepository<Proveedor>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public ProveedoresRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Insertar(Proveedor model)
        {
            try
            {
                _dbcontext.Proveedores.Add(model); // DbSet: Proveedores
                await _dbcontext.SaveChangesAsync();
                return true;
            }
            catch { return false; }
        }

        public async Task<bool> Actualizar(Proveedor model)
        {
            try
            {
                _dbcontext.Proveedores.Update(model);
                await _dbcontext.SaveChangesAsync();
                return true;
            }
            catch { return false; }
        }

        public async Task<bool> Eliminar(int id)
        {
            try
            {
                Proveedor model = _dbcontext.Proveedores.First(c => c.Id == id);
                _dbcontext.Proveedores.Remove(model);
                await _dbcontext.SaveChangesAsync();
                return true;
            }
            catch { return false; }
        }


        public async Task<Proveedor> Obtener(int id)
            {
                try
                {
                    // Reemplaza FindAsync por un Include + FirstOrDefaultAsync
                    return await _dbcontext.Proveedores
                        .Include(p => p.IdUsuarioRegistraNavigation)
                        .Include(p => p.IdUsuarioModificaNavigation)
                        .AsNoTracking()                // lectura: sin tracking
                        .FirstOrDefaultAsync(p => p.Id == id);
                }
                catch
                {
                    return null;
                }
            }


    public async Task<IQueryable<Proveedor>> ObtenerTodos()
        {
            try
            {
                IQueryable<Proveedor> query = _dbcontext.Proveedores
                    .Include(p => p.IdUsuarioRegistraNavigation)
                    .Include(p => p.IdUsuarioModificaNavigation);
                return await Task.FromResult(query);
            }
            catch { return null; }
        }
    }
}
