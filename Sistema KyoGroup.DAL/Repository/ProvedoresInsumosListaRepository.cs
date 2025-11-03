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
    public class ProveedoresInsumosRepository : IProveedoresInsumosRepository<ProveedoresInsumosLista>
    {

        private readonly SistemaKyoGroupContext _dbcontext;

        public ProveedoresInsumosRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }
       

        public async Task<bool> Insertar(Models.ProveedoresInsumosLista model)
        {
            using var transaction = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                _dbcontext.ProveedoresInsumosListas.Add(model);
                await _dbcontext.SaveChangesAsync();

                await transaction.CommitAsync();
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<bool> Actualizar(ProveedoresInsumosLista model)
        {
            await using var transaction = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // Traemos el registro existente
                var existente = await _dbcontext.ProveedoresInsumosListas
                    .FirstOrDefaultAsync(x => x.Id == model.Id);

                if (existente == null)
                    return false;

                // Copiamos valores escalares desde el model
                var entry = _dbcontext.Entry(existente);
                entry.CurrentValues.SetValues(model);

                // ⛔ No tocar usuario/fecha de registro
                var pUsr = entry.Property(nameof(ProveedoresInsumosLista.IdUsuarioRegistra));
                var pFecha = entry.Property(nameof(ProveedoresInsumosLista.FechaRegistra));

                pUsr.CurrentValue = pUsr.OriginalValue;
                pUsr.IsModified = false;

                pFecha.CurrentValue = pFecha.OriginalValue;
                pFecha.IsModified = false;

                await _dbcontext.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                return false;
            }
        }



        public async Task<bool> Eliminar(int id)
        {
            Models.ProveedoresInsumosLista model = _dbcontext.ProveedoresInsumosListas.First(c => c.Id == id);
            _dbcontext.ProveedoresInsumosListas.Remove(model);
            await _dbcontext.SaveChangesAsync();
            return true;
        }


        public async Task<Models.ProveedoresInsumosLista> Obtener(int id)
        {
            return await _dbcontext.ProveedoresInsumosListas
                .Include(p => p.IdUsuarioRegistraNavigation)
                 .Include(p => p.IdUsuarioModificaNavigation)
                .FirstOrDefaultAsync(x => x.Id == id);
        }


        public async Task<IQueryable<Models.ProveedoresInsumosLista>> ObtenerTodos()
        {

            IQueryable<Models.ProveedoresInsumosLista> query = _dbcontext.ProveedoresInsumosListas;
            return await Task.FromResult(query);
        }

        public async Task<IQueryable<Models.ProveedoresInsumosLista>> ObtenerPorProveedor(int idProveedor)
        {

            IQueryable<Models.ProveedoresInsumosLista> query = _dbcontext.ProveedoresInsumosListas.Where(x => x.IdProveedor == idProveedor);
            return await Task.FromResult(query);
        }
        public async Task<bool> ImportarDesdeLista(int idProveedor, List<ProveedoresInsumosLista> lista)
        {
            using var transaction = await _dbcontext.Database.BeginTransactionAsync();

            try
            {
                var codigos = lista
                    .Where(x => !string.IsNullOrWhiteSpace(x.Codigo))
                    .Select(x => x.Codigo.Trim().ToUpper())
                    .Distinct()
                    .ToList();

                var descripciones = lista
                    .Where(x => string.IsNullOrWhiteSpace(x.Codigo))
                    .Select(x => x.Descripcion?.Trim().ToUpper())
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Distinct()
                    .ToList();

                var existentes = _dbcontext.ProveedoresInsumosListas
                    .Where(x => x.IdProveedor == idProveedor &&
                                (
                                    (!string.IsNullOrWhiteSpace(x.Codigo) && codigos.Contains(x.Codigo.Trim().ToUpper())) ||
                                    (string.IsNullOrWhiteSpace(x.Codigo) && descripciones.Contains(x.Descripcion.Trim().ToUpper()))
                                ))
                    .ToList();

                foreach (var item in lista)
                {
                    var codigo = item.Codigo?.Trim().ToUpper();
                    var descripcion = item.Descripcion?.Trim().ToUpper();

                    ProveedoresInsumosLista existente;

                    if (!string.IsNullOrWhiteSpace(codigo))
                    {
                        existente = existentes.FirstOrDefault(x => x.Codigo?.Trim().ToUpper() == codigo);
                    }
                    else
                    {
                        existente = existentes.FirstOrDefault(x =>
                            string.IsNullOrWhiteSpace(x.Codigo) &&
                            x.Descripcion?.Trim().ToUpper() == descripcion);
                    }

                    if (existente != null)
                    {
                        existente.Descripcion = item.Descripcion?.Trim() ?? "";
                        existente.CostoUnitario = item.CostoUnitario;
                        existente.FechaActualizacion = DateTime.Now;
                    }
                    else
                    {
                        item.IdProveedor = idProveedor;
                        item.FechaActualizacion = DateTime.Now;
                        _dbcontext.ProveedoresInsumosListas.Add(item);
                    }
                }

                await _dbcontext.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return false;
            }
        }


        public async Task<bool> EliminarMasivo(List<int> ids)
        {
            if (ids == null || ids.Count == 0) return false;

            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var items = await _dbcontext.ProveedoresInsumosListas
                    .Where(x => ids.Contains(x.Id))
                    .ToListAsync();

                if (items.Count == 0)
                {
                    await tx.CommitAsync(); // nada que borrar pero no es error
                    return true;
                }

                _dbcontext.ProveedoresInsumosListas.RemoveRange(items);
                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return true;
            }
            catch
            {
                await tx.RollbackAsync();
                return false;
            }
        }




    }
}
