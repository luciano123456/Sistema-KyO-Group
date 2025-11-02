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
    //public class RecetasTipoRepository : IRecetasTipoRepository<RecetasTipo>
    //{

    //    private readonly SistemaKyoGroupContext _dbcontext;

    //    public RecetasTipoRepository(SistemaKyoGroupContext context)
    //    {
    //        _dbcontext = context;
    //    }
    //    public async Task<bool> Actualizar(RecetasTipo model)
    //    {
    //        _dbcontext.RecetasTipos.Update(model);
    //        await _dbcontext.SaveChangesAsync();
    //        return true;
    //    }

    //    public async Task<bool> Eliminar(int id)
    //    {
    //        RecetasTipo model = _dbcontext.RecetasTipos.First(c => c.Id == id);
    //        _dbcontext.RecetasTipos.Remove(model);
    //        await _dbcontext.SaveChangesAsync();
    //        return true;
    //    }

    //    public async Task<bool> Insertar(RecetasTipo model)
    //    {
    //        _dbcontext.RecetasTipos.Add(model);
    //        await _dbcontext.SaveChangesAsync();
    //        return true;
    //    }

    //    public async Task<RecetasTipo> Obtener(int id)
    //    {
    //        RecetasTipo model = await _dbcontext.RecetasTipos.FindAsync(id);
    //        return model;
    //    }
    //    public async Task<IQueryable<RecetasTipo>> ObtenerTodos()
    //    {
    //        IQueryable<RecetasTipo> query = _dbcontext.RecetasTipos;
    //        return await Task.FromResult(query);
    //    }




    //}
}
