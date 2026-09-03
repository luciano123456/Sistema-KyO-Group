using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;
using SistemaKyoGroup.DAL.Grid;
using System;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.DAL;

namespace SistemaKyoGroup.DAL.Repository
{
    public class InsumoRepository : IInsumoRepository<Insumo>
    {

        private readonly SistemaKyoGroupContext _dbcontext;

        public InsumoRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Insertar(Insumo model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // Normalización básica
                model.Id = 0;
                model.Descripcion = model.Descripcion?.Trim();
                model.Sku = model.Sku?.Trim();

                // En INSERT: NO tocar "modifica"
                model.IdUsuarioModifica = null;
                model.FechaModifica = null;

                // --- 1) Copiamos y normalizamos hijos EN MEMORIA (aún fuera del contexto) ---
                // Unidades de negocio (puede venir duplicado desde UI)
                var unidadesNegocio = (model.InsumosUnidadesNegocios ?? new List<InsumosUnidadesNegocio>())
                    .GroupBy(x => x.IdUnidadNegocio)
                    .Select(g => new InsumosUnidadesNegocio
                    {
                        Id = 0,
                        IdUnidadNegocio = g.Key
                        // si tenés más campos opcionales, mapéalos aquí
                    })
                    .ToList();

                // Proveedores (puede asociarse varias veces en distintos lados: deduplicamos por par clave)
                var Proveedores = (model.InsumosProveedores ?? new List<InsumosProveedor>())
                    .GroupBy(p => new { p.IdProveedor, p.IdListaProveedor })
                    .Select(g =>
                    {
                        var p = g.First();
                        return new InsumosProveedor
                        {
                            Id = 0,
                            IdProveedor = p.IdProveedor,
                            IdListaProveedor = p.IdListaProveedor,
                            // mapear otros campos NO clave si aplican (ej.: Precio, Moneda, etc.)
                            // Precio = p.Precio
                        };
                    })
                    .ToList();

                // MUY IMPORTANTE: quitar las colecciones antes de adjuntar el padre,
                // para que EF NO intente trackear el grafo y luego "severe" relaciones.
                model.InsumosUnidadesNegocios = null;
                model.InsumosProveedores = null;

                // --- 2) Insert del principal ---
                _dbcontext.Insumos.Add(model);

                // Aseguramos que "modifica" siga nulo
                var e = _dbcontext.Entry(model);
                e.Property(nameof(Insumo.IdUsuarioModifica)).CurrentValue = null;
                e.Property(nameof(Insumo.FechaModifica)).CurrentValue = null;

                await _dbcontext.SaveChangesAsync(); // ← ya tenemos model.Id

                // --- 3) Insert de hijos (ya con Id del padre) ---
                if (unidadesNegocio.Count > 0)
                {
                    foreach (var un in unidadesNegocio)
                    {
                        un.Id = 0;
                        un.IdInsumo = model.Id;
                    }
                    _dbcontext.InsumosUnidadesNegocios.AddRange(unidadesNegocio);
                }

                if (Proveedores.Count > 0)
                {
                    foreach (var pr in Proveedores)
                    {
                        pr.Id = 0;
                        pr.IdInsumo = model.Id;
                    }
                    _dbcontext.InsumosProveedores.AddRange(Proveedores);
                }

                var uid = model.IdUsuarioRegistra ?? 0;
                if (uid > 0)
                {
                    var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                    var catNom = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "CategoriaInsumo", model.IdCategoria);
                    var umNom = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadMedida", model.IdUnidadMedida);
                    EntidadHistorialHelper.Agregar(
                        _dbcontext, EntidadHistorialHelper.Insumo, model.Id,
                        EntidadHistorialHelper.AccionCreacion,
                        $"Alta de insumo \"{model.Descripcion}\"",
                        $"SKU: {model.Sku}. Categoría: {catNom}. UM: {umNom}. Proveedores: {Proveedores.Count}. UN: {unidadesNegocio.Count}.",
                        uid, nombre);
                }

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return true;
            }
            catch
            {
                await tx.RollbackAsync();
                throw; // que el Controller traduzca con tu DbErrorHelper
            }
        }



        public async Task<bool> Actualizar(Insumo model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var insumoExistente = await _dbcontext.Insumos
                    .Include(i => i.InsumosUnidadesNegocios)
                    .Include(i => i.InsumosProveedores)
                    .FirstOrDefaultAsync(i => i.Id == model.Id);

                if (insumoExistente == null) return false;

                var catAntes = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "CategoriaInsumo", insumoExistente.IdCategoria);
                var umAntes = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadMedida", insumoExistente.IdUnidadMedida);
                var unAntes = await EntidadHistorialHelper.NombresFkListaAsync(
                    _dbcontext, "UnidadNegocio", insumoExistente.InsumosUnidadesNegocios.Select(u => u.IdUnidadNegocio));

                var antes = EntidadHistorialHelper.Snapshot(
                    ("Descripción", insumoExistente.Descripcion),
                    ("SKU", insumoExistente.Sku),
                    ("Categoría", catAntes),
                    ("UM", umAntes),
                    ("Proveedores", insumoExistente.InsumosProveedores.Count),
                    ("UN", unAntes));

                var entry = _dbcontext.Entry(insumoExistente);
                entry.CurrentValues.SetValues(model);

                var pUsr = entry.Property(nameof(Insumo.IdUsuarioRegistra));
                var pUsrFecha = entry.Property(nameof(Insumo.FechaRegistra));
                pUsr.CurrentValue = pUsr.OriginalValue; pUsr.IsModified = false;
                pUsrFecha.CurrentValue = pUsrFecha.OriginalValue; pUsrFecha.IsModified = false;

                // Unidades
                var nuevosUn = model.InsumosUnidadesNegocios ?? new List<InsumosUnidadesNegocio>();
                var setUn = nuevosUn.Select(x => x.IdUnidadNegocio).ToHashSet();
                var aEliminarUn = insumoExistente.InsumosUnidadesNegocios.Where(x => !setUn.Contains(x.IdUnidadNegocio)).ToList();
                _dbcontext.InsumosUnidadesNegocios.RemoveRange(aEliminarUn);
                foreach (var un in nuevosUn)
                    if (!insumoExistente.InsumosUnidadesNegocios.Any(x => x.IdUnidadNegocio == un.IdUnidadNegocio))
                    { un.Id = 0; un.IdInsumo = model.Id; _dbcontext.InsumosUnidadesNegocios.Add(un); }

                // Proveedores
                var nuevosProv = model.InsumosProveedores ?? new List<InsumosProveedor>();
                var setLp = nuevosProv.Select(x => x.IdListaProveedor).ToHashSet();
                var aEliminarProv = insumoExistente.InsumosProveedores.Where(x => !setLp.Contains(x.IdListaProveedor)).ToList();
                _dbcontext.InsumosProveedores.RemoveRange(aEliminarProv);
                foreach (var pr in nuevosProv)
                    if (!insumoExistente.InsumosProveedores.Any(x => x.IdListaProveedor == pr.IdListaProveedor))
                    { pr.Id = 0; pr.IdInsumo = model.Id; _dbcontext.InsumosProveedores.Add(pr); }

                var catDespues = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "CategoriaInsumo", insumoExistente.IdCategoria);
                var umDespues = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadMedida", insumoExistente.IdUnidadMedida);
                var unDespues = await EntidadHistorialHelper.NombresFkListaAsync(_dbcontext, "UnidadNegocio", setUn);

                var despues = EntidadHistorialHelper.Snapshot(
                    ("Descripción", insumoExistente.Descripcion),
                    ("SKU", insumoExistente.Sku),
                    ("Categoría", catDespues),
                    ("UM", umDespues),
                    ("Proveedores", setLp.Count),
                    ("UN", unDespues));

                var uid = model.IdUsuarioModifica ?? insumoExistente.IdUsuarioRegistra ?? 0;
                if (uid > 0)
                {
                    var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                    EntidadHistorialHelper.AgregarSiCambio(
                        _dbcontext, EntidadHistorialHelper.Insumo, model.Id,
                        $"insumo \"{insumoExistente.Descripcion}\"", antes, despues, uid, nombre);
                }

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return true;
            }
            catch
            {
                await tx.RollbackAsync();
                throw; // <-- dejamos que lo maneje el controller
            }
        }

        public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var model = await _dbcontext.Insumos.FirstOrDefaultAsync(c => c.Id == id);
                if (model == null) return DeleteResult.NotFound("el insumo");

                var nRecetas = await _dbcontext.RecetasInsumos.CountAsync(x => x.IdInsumo == id);
                var nSub = await _dbcontext.SubRecetasInsumos.CountAsync(x => x.IdInsumo == id);
                var nCompras = await _dbcontext.ComprasInsumos.CountAsync(x => x.IdInsumo == id);
                var nOc = await _dbcontext.OrdenesComprasInsumos.CountAsync(x => x.IdInsumo == id);
                var nProv = await _dbcontext.InsumosProveedores.CountAsync(x => x.IdInsumo == id);
                var nHist = await _dbcontext.InsumosCostoHistoriales.CountAsync(x => x.IdInsumo == id);
                var nUn = await _dbcontext.InsumosUnidadesNegocios.CountAsync(x => x.IdInsumo == id);

                var deps = new List<DeleteDependencia>();
                if (nRecetas > 0) deps.Add(new DeleteDependencia { Entidad = "Recetas", Cantidad = nRecetas, Detalle = "Líneas de insumos en recetas", Cascadeable = true });
                if (nSub > 0) deps.Add(new DeleteDependencia { Entidad = "SubRecetas", Cantidad = nSub, Detalle = "Líneas de insumos en subrecetas", Cascadeable = true });
                if (nCompras > 0) deps.Add(new DeleteDependencia { Entidad = "Compras", Cantidad = nCompras, Detalle = "Líneas de detalle en compras", Cascadeable = true });
                if (nOc > 0) deps.Add(new DeleteDependencia { Entidad = "Órdenes de compra", Cantidad = nOc, Detalle = "Líneas de detalle en OC", Cascadeable = true });
                if (nProv > 0) deps.Add(new DeleteDependencia { Entidad = "Listas de proveedores", Cantidad = nProv, Detalle = "Vínculos con listas de precios", Cascadeable = true });
                if (nHist > 0) deps.Add(new DeleteDependencia { Entidad = "Historial de costos", Cantidad = nHist, Detalle = "Registros de historial de costo", Cascadeable = true });

                // UN propias se borran siempre; no hace falta listarlas como bloqueo
                var bloqueantes = deps.Where(d => d.Cascadeable).ToList();
                if (!cascade && bloqueantes.Count > 0)
                {
                    return DeleteResult.Relacion(
                        "No se puede eliminar el insumo porque está asociado a otros registros.",
                        bloqueantes,
                        cascadeDisponible: true);
                }

                if (cascade || nUn > 0 || nProv > 0 || nHist > 0 || nRecetas > 0 || nSub > 0 || nCompras > 0 || nOc > 0)
                {
                    if (nRecetas > 0) _dbcontext.RecetasInsumos.RemoveRange(await _dbcontext.RecetasInsumos.Where(x => x.IdInsumo == id).ToListAsync());
                    if (nSub > 0) _dbcontext.SubRecetasInsumos.RemoveRange(await _dbcontext.SubRecetasInsumos.Where(x => x.IdInsumo == id).ToListAsync());
                    if (nCompras > 0) _dbcontext.ComprasInsumos.RemoveRange(await _dbcontext.ComprasInsumos.Where(x => x.IdInsumo == id).ToListAsync());
                    if (nOc > 0) _dbcontext.OrdenesComprasInsumos.RemoveRange(await _dbcontext.OrdenesComprasInsumos.Where(x => x.IdInsumo == id).ToListAsync());
                    if (nProv > 0) _dbcontext.InsumosProveedores.RemoveRange(await _dbcontext.InsumosProveedores.Where(x => x.IdInsumo == id).ToListAsync());
                    if (nHist > 0) _dbcontext.InsumosCostoHistoriales.RemoveRange(await _dbcontext.InsumosCostoHistoriales.Where(x => x.IdInsumo == id).ToListAsync());
                    if (nUn > 0) _dbcontext.InsumosUnidadesNegocios.RemoveRange(await _dbcontext.InsumosUnidadesNegocios.Where(x => x.IdInsumo == id).ToListAsync());
                }

                var uid = model.IdUsuarioModifica ?? model.IdUsuarioRegistra ?? 0;
                var desc = model.Descripcion;
                _dbcontext.Insumos.Remove(model);
                if (uid > 0)
                {
                    var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                    EntidadHistorialHelper.Agregar(
                        _dbcontext, EntidadHistorialHelper.Insumo, id,
                        EntidadHistorialHelper.AccionEliminacion,
                        cascade
                            ? $"Eliminación en cascada de insumo \"{desc}\""
                            : $"Eliminación de insumo \"{desc}\"",
                        null, uid, nombre);
                }
                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return DeleteResult.Success(
                    cascade && bloqueantes.Count > 0
                        ? "Insumo y vínculos asociados eliminados correctamente."
                        : "Insumo eliminado correctamente.");
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return DeleteResult.Error(
                    "Error al eliminar el insumo: " + (ex.InnerException?.Message ?? ex.Message));
            }
        }


        public async Task<Insumo> Obtener(int id)
        {
            return await _dbcontext.Insumos
                .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation) // <-- FALTABA ESTO
                        .ThenInclude(lp => lp.IdProveedorNavigation) // <-- OPCIONAL si querés también el nombre del proveedor
                .Include(x => x.InsumosUnidadesNegocios)
                    .ThenInclude(x => x.IdUnidadNegocioNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                        .Include(p => p.IdUsuarioModificaNavigation)
                .FirstOrDefaultAsync(x => x.Id == id);
        }


        public async Task<IQueryable<Insumo>> ObtenerTodos()
        {
            IQueryable<Insumo> query = _dbcontext.Insumos
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation)
                        .ThenInclude(lp => lp.IdProveedorNavigation)
                .Include(x => x.InsumosUnidadesNegocios)
                    .ThenInclude(x => x.IdUnidadNegocioNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                .Include(p => p.IdUsuarioModificaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation);

            return await Task.FromResult(query);
        }

        public async Task<Insumo?> BuscarDuplicado(string sku, string descripcion, int idExcluir)
        {
            var s = (sku ?? "").Trim().ToUpperInvariant();
            var d = (descripcion ?? "").Trim().ToUpperInvariant();

            return await _dbcontext.Insumos.AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id != idExcluir &&
                    (i.Sku.ToUpper() == s || i.Descripcion.ToUpper() == d));
        }

        public async Task<IQueryable<Insumo>> ObtenerPorProveedor(int idProveedor)
        {
            var query = _dbcontext.Insumos
                .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation)
                        .ThenInclude(lp => lp.IdProveedorNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                        .Include(p => p.IdUsuarioModificaNavigation)
                .Where(c => c.InsumosProveedores.Any(p =>
                    p.IdProveedor == idProveedor ||
                    (p.IdListaProveedorNavigation != null &&
                     p.IdListaProveedorNavigation.IdProveedor == idProveedor)));

            return await Task.FromResult(query);
        }

        public async Task<IQueryable<Insumo>> ObtenerPorUnidadNegocio(int idUnidadNegocio)
        {
            var query = _dbcontext.Insumos
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation)
                        .ThenInclude(lp => lp.IdProveedorNavigation)
                .Include(x => x.InsumosUnidadesNegocios)
                    .ThenInclude(un => un.IdUnidadNegocioNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                        .Include(p => p.IdUsuarioModificaNavigation)
                .Where(c => c.InsumosUnidadesNegocios
                    .Any(un => un.IdUnidadNegocio == idUnidadNegocio || idUnidadNegocio == -1));

            return await Task.FromResult(query);
        }

        public async Task<IQueryable<Insumo>> ObtenerPorUnidadYProveedor(int idUnidadNegocio, int idProveedor)
        {
            var query =
                _dbcontext.Insumos
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.InsumosUnidadesNegocios)
                    .ThenInclude(un => un.IdUnidadNegocioNavigation)
                .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation)
                        .ThenInclude(lp => lp.IdProveedorNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation)
                .Include(x => x.IdUsuarioRegistraNavigation)
                .Include(x => x.IdUsuarioModificaNavigation)
                .Where(ins =>
                    // condición 1: pertenece a la UN seleccionada
                    ins.InsumosUnidadesNegocios.Any(un => un.IdUnidadNegocio == idUnidadNegocio)
                    &&
                    // condición 2: vinculado al proveedor (con o sin precio en lista)
                    ins.InsumosProveedores.Any(p =>
                        p.IdProveedor == idProveedor ||
                        (p.IdListaProveedorNavigation != null &&
                         p.IdListaProveedorNavigation.IdProveedor == idProveedor)
                    )
                );

            return await Task.FromResult(query);
        }

        public async Task<(int Total, int SinProveedor)> ObtenerKpis(int idUnidadNegocio)
        {
            var baseQuery = _dbcontext.Insumos.AsNoTracking()
                .Where(c => c.InsumosUnidadesNegocios.Any(un => un.IdUnidadNegocio == idUnidadNegocio || idUnidadNegocio == -1));

            var total = await baseQuery.CountAsync();
            var sinProveedor = await baseQuery.CountAsync(i => !i.InsumosProveedores.Any());
            return (total, sinProveedor);
        }

        public async Task<GridResult<Insumo>> ListarPaginado(int idUnidadNegocio, GridQuery q)
        {
            var baseQuery = _dbcontext.Insumos.AsNoTracking()
                .Where(c => c.InsumosUnidadesNegocios.Any(un => un.IdUnidadNegocio == idUnidadNegocio || idUnidadNegocio == -1));

            var total = await baseQuery.CountAsync();
            var filteredQuery = ApplyInsumoFilters(baseQuery, q);
            var filtered = await filteredQuery.CountAsync();
            filteredQuery = ApplyInsumoSort(filteredQuery, q.OrderColumn, q.OrderDesc);

            var items = await filteredQuery
                .AsSplitQuery()
                .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation)
                        .ThenInclude(lp => lp.IdProveedorNavigation)
                .Include(x => x.InsumosUnidadesNegocios)
                    .ThenInclude(x => x.IdUnidadNegocioNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                .Include(p => p.IdUsuarioModificaNavigation)
                .Skip(q.Skip)
                .Take(q.Take)
                .ToListAsync();

            return new GridResult<Insumo> { Total = total, Filtered = filtered, Items = items };
        }

        private static IQueryable<Insumo> ApplyInsumoFilters(IQueryable<Insumo> query, GridQuery q)
        {
            if (!string.IsNullOrWhiteSpace(q.Search))
            {
                var s = q.Search.Trim().ToLower();
                query = query.Where(i =>
                    i.Descripcion.ToLower().Contains(s) ||
                    i.Sku.ToLower().Contains(s) ||
                    (i.IdCategoriaNavigation != null && i.IdCategoriaNavigation.Nombre.ToLower().Contains(s)) ||
                    (i.IdUnidadMedidaNavigation != null && i.IdUnidadMedidaNavigation.Nombre.ToLower().Contains(s)));
            }

            foreach (var (col, val) in q.ColumnSearches)
            {
                if (string.IsNullOrWhiteSpace(val)) continue;
                var v = val.Trim();
                var vl = v.ToLower();
                switch (col)
                {
                    case 2:
                        query = query.Where(i => i.Descripcion.ToLower().Contains(vl));
                        break;
                    case 4:
                        query = query.Where(i => i.Sku.ToLower().Contains(vl));
                        break;
                    case 5:
                        query = query.Where(i => i.IdUnidadMedidaNavigation != null &&
                            i.IdUnidadMedidaNavigation.Nombre.ToLower().Contains(vl));
                        break;
                    case 6:
                        query = query.Where(i => i.IdCategoriaNavigation != null &&
                            i.IdCategoriaNavigation.Nombre.ToLower().Contains(vl));
                        break;
                    case 7:
                        query = query.Where(i => i.InsumosProveedores.Any(p =>
                            p.IdListaProveedorNavigation != null &&
                            p.IdListaProveedorNavigation.IdProveedorNavigation != null &&
                            p.IdListaProveedorNavigation.IdProveedorNavigation.Nombre.ToLower().Contains(vl)));
                        break;
                }
            }

            return query;
        }

        private static IQueryable<Insumo> ApplyInsumoSort(IQueryable<Insumo> query, int orderColumn, bool desc)
        {
            return orderColumn switch
            {
                1 => desc ? query.OrderByDescending(i => i.Id) : query.OrderBy(i => i.Id),
                2 => desc ? query.OrderByDescending(i => i.Descripcion) : query.OrderBy(i => i.Descripcion),
                3 => desc ? query.OrderByDescending(i => i.FechaActualizacion) : query.OrderBy(i => i.FechaActualizacion),
                4 => desc ? query.OrderByDescending(i => i.Sku) : query.OrderBy(i => i.Sku),
                5 => desc ? query.OrderByDescending(i => i.IdUnidadMedidaNavigation!.Nombre) : query.OrderBy(i => i.IdUnidadMedidaNavigation!.Nombre),
                6 => desc ? query.OrderByDescending(i => i.IdCategoriaNavigation!.Nombre) : query.OrderBy(i => i.IdCategoriaNavigation!.Nombre),
                _ => desc ? query.OrderByDescending(i => i.Descripcion) : query.OrderBy(i => i.Descripcion)
            };
        }

    }
}
