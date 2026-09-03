using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models.Common;

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

                var uid = model.IdUsuarioRegistra ?? 0;
                if (uid > 0)
                {
                    var nombre = await ProveedoresInsumosHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                    ProveedoresInsumosHistorialHelper.AgregarCreacion(
                        _dbcontext, model, uid, nombre, ProveedoresInsumosHistorialHelper.OrigenManual);
                    await _dbcontext.SaveChangesAsync();
                }

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

                var antes = new ProveedoresInsumosLista
                {
                    Id = existente.Id,
                    IdProveedor = existente.IdProveedor,
                    Descripcion = existente.Descripcion,
                    Codigo = existente.Codigo,
                    Costo = existente.Costo,
                    CostoUnitario = existente.CostoUnitario,
                    Cantidad = existente.Cantidad,
                    PorcDesc = existente.PorcDesc
                };

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

                var uid = model.IdUsuarioModifica ?? 0;
                if (uid > 0)
                {
                    var nombre = await ProveedoresInsumosHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                    ProveedoresInsumosHistorialHelper.AgregarCambioSiCorresponde(
                        _dbcontext, antes, existente, uid, nombre, ProveedoresInsumosHistorialHelper.OrigenManual);
                }

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



        public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
        {
            try
            {
                var model = await _dbcontext.ProveedoresInsumosListas.FirstOrDefaultAsync(c => c.Id == id);
                if (model == null) return DeleteResult.NotFound("el ítem de lista");

                var nVinc = await _dbcontext.InsumosProveedores.CountAsync(x => x.IdListaProveedor == id);
                var nOc = await _dbcontext.OrdenesComprasInsumos.CountAsync(x => x.IdProveedorLista == id);
                var nCompras = await _dbcontext.ComprasInsumos.CountAsync(x => x.IdProveedorLista == id);

                var deps = new List<DeleteDependencia>();
                if (nVinc > 0)
                    deps.Add(new DeleteDependencia { Entidad = "Insumos vinculados", Cantidad = nVinc, Detalle = "Asignaciones insumo↔lista", Cascadeable = true });
                if (nOc > 0)
                    deps.Add(new DeleteDependencia { Entidad = "Órdenes de compra", Cantidad = nOc, Detalle = "Líneas de OC que usan esta lista (se desvinculan)", Cascadeable = true });
                if (nCompras > 0)
                    deps.Add(new DeleteDependencia { Entidad = "Compras", Cantidad = nCompras, Detalle = "Líneas de compra que usan esta lista (se eliminan del detalle)", Cascadeable = true });

                if (!cascade && deps.Count > 0)
                {
                    return DeleteResult.Relacion(
                        "No se puede eliminar el ítem de lista porque está asociado a otros registros.",
                        deps,
                        cascadeDisponible: true);
                }

                if (cascade || nVinc > 0 || nOc > 0 || nCompras > 0)
                {
                    if (nVinc > 0)
                        _dbcontext.InsumosProveedores.RemoveRange(
                            await _dbcontext.InsumosProveedores.Where(x => x.IdListaProveedor == id).ToListAsync());

                    if (nOc > 0)
                    {
                        var ocDet = await _dbcontext.OrdenesComprasInsumos
                            .Where(x => x.IdProveedorLista == id).ToListAsync();
                        foreach (var d in ocDet) d.IdProveedorLista = null;
                    }

                    if (nCompras > 0)
                        _dbcontext.ComprasInsumos.RemoveRange(
                            await _dbcontext.ComprasInsumos.Where(x => x.IdProveedorLista == id).ToListAsync());
                }

                _dbcontext.ProveedoresInsumosListas.Remove(model);
                await _dbcontext.SaveChangesAsync();
                return DeleteResult.Success(
                    cascade && deps.Count > 0
                        ? "Ítem de lista y vínculos eliminados correctamente."
                        : "Ítem de lista eliminado correctamente.");
            }
            catch (Exception ex)
            {
                return DeleteResult.Error(
                    "No se pudo eliminar: " + (ex.InnerException?.Message ?? ex.Message));
            }
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

                var altasImport = new List<ProveedoresInsumosLista>();

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

                    var uid = item.IdUsuarioRegistra ?? item.IdUsuarioModifica ?? 0;

                    if (existente != null)
                    {
                        var antes = new ProveedoresInsumosLista
                        {
                            Id = existente.Id,
                            IdProveedor = existente.IdProveedor,
                            Descripcion = existente.Descripcion,
                            Codigo = existente.Codigo,
                            Costo = existente.Costo,
                            CostoUnitario = existente.CostoUnitario,
                            Cantidad = existente.Cantidad,
                            PorcDesc = existente.PorcDesc
                        };

                        existente.Descripcion = item.Descripcion?.Trim() ?? "";
                        existente.CostoUnitario = item.CostoUnitario;
                        existente.PorcDesc = item.PorcDesc;
                        existente.Cantidad = item.Cantidad;
                        existente.Costo = item.Costo;
                        existente.FechaActualizacion = DateTime.Now;
                        existente.PorcDesc = item.PorcDesc;
                        if (uid > 0)
                        {
                            existente.IdUsuarioModifica = uid;
                            existente.FechaModifica = DateTime.Now;
                        }

                        if (uid > 0)
                        {
                            var nombre = await ProveedoresInsumosHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                            ProveedoresInsumosHistorialHelper.AgregarCambioSiCorresponde(
                                _dbcontext, antes, existente, uid, nombre,
                                ProveedoresInsumosHistorialHelper.OrigenImportacion);
                        }
                    }
                    else
                    {
                        item.IdProveedor = idProveedor;
                        item.FechaActualizacion = DateTime.Now;
                        item.Costo = item.Costo;
                        item.CostoUnitario = item.CostoUnitario;
                        item.Cantidad = item.Cantidad;
                        item.PorcDesc = item.PorcDesc;
                        _dbcontext.ProveedoresInsumosListas.Add(item);
                        altasImport.Add(item);
                    }
                }

                await _dbcontext.SaveChangesAsync();

                if (altasImport.Count > 0)
                {
                    foreach (var alta in altasImport)
                    {
                        var uidAlta = alta.IdUsuarioRegistra ?? alta.IdUsuarioModifica ?? 0;
                        if (uidAlta <= 0 || alta.Id <= 0) continue;
                        var nombre = await ProveedoresInsumosHistorialHelper.NombreUsuarioAsync(_dbcontext, uidAlta);
                        ProveedoresInsumosHistorialHelper.AgregarCreacion(
                            _dbcontext, alta, uidAlta, nombre, ProveedoresInsumosHistorialHelper.OrigenImportacion);
                    }
                    await _dbcontext.SaveChangesAsync();
                }

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

        public async Task<GridResult<ProveedoresInsumosLista>> ListarPaginado(int idProveedor, GridQuery q)
        {
            var baseQuery = _dbcontext.ProveedoresInsumosListas.AsNoTracking();
            if (idProveedor > 0)
                baseQuery = baseQuery.Where(x => x.IdProveedor == idProveedor);

            var total = await baseQuery.CountAsync();
            var filteredQuery = ApplyPiFilters(baseQuery, q);
            var filtered = await filteredQuery.CountAsync();
            filteredQuery = ApplyPiSort(filteredQuery, q.OrderColumn, q.OrderDesc);

            var items = await filteredQuery
                .Include(p => p.IdProveedorNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                .Include(p => p.IdUsuarioModificaNavigation)
                .Skip(q.Skip)
                .Take(q.Take)
                .ToListAsync();

            return new GridResult<ProveedoresInsumosLista> { Total = total, Filtered = filtered, Items = items };
        }

        private static IQueryable<ProveedoresInsumosLista> ApplyPiFilters(IQueryable<ProveedoresInsumosLista> query, GridQuery q)
        {
            if (!string.IsNullOrWhiteSpace(q.Search))
            {
                var s = q.Search.Trim().ToLower();
                query = query.Where(x =>
                    x.Descripcion.ToLower().Contains(s) ||
                    (x.Codigo != null && x.Codigo.ToLower().Contains(s)) ||
                    (x.IdProveedorNavigation != null && x.IdProveedorNavigation.Nombre.ToLower().Contains(s)));
            }

            foreach (var (col, val) in q.ColumnSearches)
            {
                if (string.IsNullOrWhiteSpace(val)) continue;
                var vl = val.Trim().ToLower();
                switch (col)
                {
                    case 1:
                        query = query.Where(x => x.Id.ToString().Contains(vl));
                        break;
                    case 2:
                        query = query.Where(x => x.Codigo != null && x.Codigo.ToLower().Contains(vl));
                        break;
                    case 3:
                        query = query.Where(x => x.Descripcion.ToLower().Contains(vl));
                        break;
                    case 8:
                        query = query.Where(x => x.IdProveedorNavigation != null &&
                            x.IdProveedorNavigation.Nombre.ToLower().Contains(vl));
                        break;
                    case 9:
                        query = query.Where(x =>
                            x.FechaActualizacion.Day.ToString().Contains(vl) ||
                            x.FechaActualizacion.Month.ToString().Contains(vl) ||
                            x.FechaActualizacion.Year.ToString().Contains(vl));
                        break;
                }
            }

            return query;
        }

        private static IQueryable<ProveedoresInsumosLista> ApplyPiSort(IQueryable<ProveedoresInsumosLista> query, int orderColumn, bool desc)
        {
            return orderColumn switch
            {
                1 => desc ? query.OrderByDescending(x => x.Id) : query.OrderBy(x => x.Id),
                2 => desc ? query.OrderByDescending(x => x.Codigo) : query.OrderBy(x => x.Codigo),
                3 => desc ? query.OrderByDescending(x => x.Descripcion) : query.OrderBy(x => x.Descripcion),
                7 => desc ? query.OrderByDescending(x => x.CostoUnitario) : query.OrderBy(x => x.CostoUnitario),
                8 => desc ? query.OrderByDescending(x => x.IdProveedorNavigation!.Nombre) : query.OrderBy(x => x.IdProveedorNavigation!.Nombre),
                9 => desc ? query.OrderByDescending(x => x.FechaActualizacion) : query.OrderBy(x => x.FechaActualizacion),
                _ => desc ? query.OrderByDescending(x => x.Descripcion) : query.OrderBy(x => x.Descripcion)
            };
        }

    }
}
