using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

public class ProveedoresRepository : IProveedoresRepository<Proveedor>
{
    private readonly SistemaKyoGroupContext _dbcontext;
    private readonly ICompraRepository<Compra> _compraRepo;
    private readonly IOrdenCompraRepository<OrdenesCompra> _ocRepo;

    public ProveedoresRepository(
        SistemaKyoGroupContext context,
        ICompraRepository<Compra> compraRepo,
        IOrdenCompraRepository<OrdenesCompra> ocRepo)
    {
        _dbcontext = context;
        _compraRepo = compraRepo;
        _ocRepo = ocRepo;
    }

    public async Task<bool> Insertar(Proveedor model)
    {
        try
        {
            _dbcontext.Proveedores.Add(model);
            await _dbcontext.SaveChangesAsync();

            var uid = model.IdUsuarioRegistra ?? 0;
            if (uid > 0)
            {
                var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                EntidadHistorialHelper.Agregar(
                    _dbcontext, EntidadHistorialHelper.Proveedor, model.Id,
                    EntidadHistorialHelper.AccionCreacion,
                    $"Alta de proveedor \"{model.Nombre}\"",
                    $"Nombre: {model.Nombre}. Apodo: {model.Apodo}. CUIT: {model.Cuit}. Tel: {model.Telefono}.",
                    uid, nombre);
                await _dbcontext.SaveChangesAsync();
            }
            return true;
        }
        catch { return false; }
    }

    public async Task<bool> Actualizar(Proveedor model)
    {
        try
        {
            var existente = await _dbcontext.Proveedores.FirstOrDefaultAsync(p => p.Id == model.Id);
            if (existente == null) return false;

            var antes = EntidadHistorialHelper.Snapshot(
                ("Nombre", existente.Nombre),
                ("Apodo", existente.Apodo),
                ("Ubicación", existente.Ubicacion),
                ("Teléfono", existente.Telefono),
                ("CBU", existente.Cbu),
                ("CUIT", existente.Cuit));

            existente.Nombre = model.Nombre;
            existente.Apodo = model.Apodo;
            existente.Ubicacion = model.Ubicacion;
            existente.Telefono = model.Telefono;
            existente.Cbu = model.Cbu;
            existente.Cuit = model.Cuit;
            existente.IdUsuarioModifica = model.IdUsuarioModifica;
            existente.FechaModifica = model.FechaModifica ?? DateTime.Now;

            var despues = EntidadHistorialHelper.Snapshot(
                ("Nombre", existente.Nombre),
                ("Apodo", existente.Apodo),
                ("Ubicación", existente.Ubicacion),
                ("Teléfono", existente.Telefono),
                ("CBU", existente.Cbu),
                ("CUIT", existente.Cuit));

            var uid = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra ?? 0;
            if (uid > 0)
            {
                var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                EntidadHistorialHelper.AgregarSiCambio(
                    _dbcontext, EntidadHistorialHelper.Proveedor, existente.Id,
                    $"proveedor \"{existente.Nombre}\"", antes, despues, uid, nombre);
            }

            await _dbcontext.SaveChangesAsync();
            return true;
        }
        catch { return false; }
    }

    public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
    {
        try
        {
            var model = await _dbcontext.Proveedores.FirstOrDefaultAsync(c => c.Id == id);
            if (model == null) return DeleteResult.NotFound("el proveedor");

            var ocIds = await _dbcontext.OrdenesCompras.AsNoTracking()
                .Where(x => x.IdProveedor == id).Select(x => x.Id).ToListAsync();
            var compraIds = await _dbcontext.Compras.AsNoTracking()
                .Where(x => x.IdProveedor == id).Select(x => x.Id).ToListAsync();
            var nListas = await _dbcontext.ProveedoresInsumosListas.CountAsync(x => x.IdProveedor == id);
            var nCc = await _dbcontext.ProveedoresCuentaCorrientes.CountAsync(x => x.IdProveedor == id);
            var nPagos = await _dbcontext.ProveedoresPagos.CountAsync(x => x.IdProveedor == id);
            var nVinc = await _dbcontext.InsumosProveedores.CountAsync(x => x.IdProveedor == id);

            var deps = new List<DeleteDependencia>();
            if (ocIds.Count > 0)
                deps.Add(new DeleteDependencia { Entidad = "Órdenes de compra", Cantidad = ocIds.Count, Detalle = "OC #" + string.Join(", #", ocIds.Take(8)) + (ocIds.Count > 8 ? "…" : ""), Cascadeable = true });
            if (compraIds.Count > 0)
                deps.Add(new DeleteDependencia { Entidad = "Compras", Cantidad = compraIds.Count, Detalle = "Compras #" + string.Join(", #", compraIds.Take(8)) + (compraIds.Count > 8 ? "…" : ""), Cascadeable = true });
            if (nListas > 0)
                deps.Add(new DeleteDependencia { Entidad = "Listas de precios", Cantidad = nListas, Detalle = "Ítems de lista de precios del proveedor", Cascadeable = true });
            if (nCc > 0)
                deps.Add(new DeleteDependencia { Entidad = "Cuenta corriente", Cantidad = nCc, Detalle = "Movimientos de cuenta corriente", Cascadeable = true });
            if (nPagos > 0)
                deps.Add(new DeleteDependencia { Entidad = "Pagos", Cantidad = nPagos, Detalle = "Pagos registrados al proveedor", Cascadeable = true });
            if (nVinc > 0)
                deps.Add(new DeleteDependencia { Entidad = "Vínculos de insumos", Cantidad = nVinc, Detalle = "Asignaciones insumo↔proveedor", Cascadeable = true });

            if (!cascade && deps.Count > 0)
            {
                return DeleteResult.Relacion(
                    "No se puede eliminar el proveedor porque tiene registros asociados.",
                    deps,
                    cascadeDisponible: true);
            }

            if (cascade)
            {
                // Pagos
                var pagos = await _dbcontext.ProveedoresPagos.Where(x => x.IdProveedor == id).ToListAsync();
                if (pagos.Count > 0) _dbcontext.ProveedoresPagos.RemoveRange(pagos);

                // CC
                var cc = await _dbcontext.ProveedoresCuentaCorrientes.Where(x => x.IdProveedor == id).ToListAsync();
                if (cc.Count > 0) _dbcontext.ProveedoresCuentaCorrientes.RemoveRange(cc);
                await _dbcontext.SaveChangesAsync();

                // Compras (vía repo completo)
                foreach (var idCompra in compraIds)
                {
                    var (okC, msgC) = await _compraRepo.Eliminar(idCompra);
                    if (!okC) return DeleteResult.Error(msgC ?? $"No se pudo eliminar la compra #{idCompra}.");
                }

                // Releer OCs (algunas pudieron quedar tras borrar compras)
                ocIds = await _dbcontext.OrdenesCompras.AsNoTracking()
                    .Where(x => x.IdProveedor == id).Select(x => x.Id).ToListAsync();
                foreach (var idOc in ocIds)
                {
                    var rOc = await _ocRepo.Eliminar(idOc, cascade: true);
                    if (!rOc.Ok) return DeleteResult.Error(rOc.Mensaje ?? $"No se pudo eliminar la OC #{idOc}.");
                }

                // Vínculos e insumos-lista
                var vinc = await _dbcontext.InsumosProveedores.Where(x => x.IdProveedor == id).ToListAsync();
                if (vinc.Count > 0) _dbcontext.InsumosProveedores.RemoveRange(vinc);

                    var listas = await _dbcontext.ProveedoresInsumosListas.Where(x => x.IdProveedor == id).ToListAsync();
                if (listas.Count > 0)
                {
                    var listaIds = listas.Select(l => l.Id).ToList();
                    var ocDet = await _dbcontext.OrdenesComprasInsumos
                        .Where(x => x.IdProveedorLista.HasValue && listaIds.Contains(x.IdProveedorLista.Value))
                        .ToListAsync();
                    foreach (var d in ocDet) d.IdProveedorLista = null;

                    var cDet = await _dbcontext.ComprasInsumos
                        .Where(x => listaIds.Contains(x.IdProveedorLista))
                        .ToListAsync();
                    if (cDet.Count > 0) _dbcontext.ComprasInsumos.RemoveRange(cDet);

                    _dbcontext.ProveedoresInsumosListas.RemoveRange(listas);
                }
                await _dbcontext.SaveChangesAsync();
            }

            var uid = model.IdUsuarioModifica ?? model.IdUsuarioRegistra ?? 0;
            var nombreProv = model.Nombre;
            _dbcontext.Proveedores.Remove(model);
            if (uid > 0)
            {
                var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                EntidadHistorialHelper.Agregar(
                    _dbcontext, EntidadHistorialHelper.Proveedor, id,
                    EntidadHistorialHelper.AccionEliminacion,
                    cascade
                        ? $"Eliminación en cascada de proveedor \"{nombreProv}\""
                        : $"Eliminación de proveedor \"{nombreProv}\"",
                    null, uid, nombre);
            }
            await _dbcontext.SaveChangesAsync();
            return DeleteResult.Success(
                cascade && deps.Count > 0
                    ? "Proveedor y registros asociados eliminados correctamente."
                    : "Proveedor eliminado correctamente.");
        }
        catch (Exception ex)
        {
            return DeleteResult.Error(
                "No se pudo eliminar el proveedor: " + (ex.InnerException?.Message ?? ex.Message));
        }
    }

    public async Task<Proveedor> Obtener(int id)
    {
        try
        {
            return await _dbcontext.Proveedores
                .Include(p => p.IdUsuarioRegistraNavigation)
                .Include(p => p.IdUsuarioModificaNavigation)
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id);
        }
        catch { return null; }
    }

    public async Task<IQueryable<Proveedor>> ObtenerTodos()
    {
        try
        {
            IQueryable<Proveedor> query = _dbcontext.Proveedores
                .AsNoTracking()
                .Include(p => p.IdUsuarioRegistraNavigation)
                .Include(p => p.IdUsuarioModificaNavigation);
            return await Task.FromResult(query);
        }
        catch { return null; }
    }

    public async Task<Proveedor?> BuscarDuplicado(string nombre, string? cuit, int idExcluir)
    {
        var n = (nombre ?? "").Trim().ToUpperInvariant();
        var c = (cuit ?? "").Trim();

        return await _dbcontext.Proveedores.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id != idExcluir &&
                (p.Nombre.ToUpper() == n || (!string.IsNullOrEmpty(c) && p.Cuit == c)));
    }

    public async Task<GridResult<Proveedor>> ListarPaginado(GridQuery q)
    {
        var baseQuery = _dbcontext.Proveedores.AsNoTracking();
        var total = await baseQuery.CountAsync();
        var filteredQuery = ApplyProvFilters(baseQuery, q);
        var filtered = await filteredQuery.CountAsync();
        filteredQuery = ApplyProvSort(filteredQuery, q.OrderColumn, q.OrderDesc);

        var items = await filteredQuery
            .Include(p => p.IdUsuarioRegistraNavigation)
            .Include(p => p.IdUsuarioModificaNavigation)
            .Skip(q.Skip)
            .Take(q.Take)
            .ToListAsync();

        return new GridResult<Proveedor> { Total = total, Filtered = filtered, Items = items };
    }

    private static IQueryable<Proveedor> ApplyProvFilters(IQueryable<Proveedor> query, GridQuery q)
    {
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim().ToLower();
            query = query.Where(p =>
                p.Nombre.ToLower().Contains(s) ||
                (p.Apodo != null && p.Apodo.ToLower().Contains(s)) ||
                (p.Cuit != null && p.Cuit.ToLower().Contains(s)));
        }

        foreach (var (col, val) in q.ColumnSearches)
        {
            if (string.IsNullOrWhiteSpace(val)) continue;
            var vl = val.Trim().ToLower();
            switch (col)
            {
                case 2: query = query.Where(p => p.Nombre.ToLower().Contains(vl)); break;
                case 3: query = query.Where(p => p.Apodo != null && p.Apodo.ToLower().Contains(vl)); break;
                case 4: query = query.Where(p => p.Ubicacion != null && p.Ubicacion.ToLower().Contains(vl)); break;
                case 5: query = query.Where(p => p.Telefono != null && p.Telefono.ToLower().Contains(vl)); break;
                case 6: query = query.Where(p => p.Cbu != null && p.Cbu.ToLower().Contains(vl)); break;
                case 7: query = query.Where(p => p.Cuit != null && p.Cuit.ToLower().Contains(vl)); break;
            }
        }

        return query;
    }

    private static IQueryable<Proveedor> ApplyProvSort(IQueryable<Proveedor> query, int orderColumn, bool desc)
    {
        return orderColumn switch
        {
            1 => desc ? query.OrderByDescending(p => p.Id) : query.OrderBy(p => p.Id),
            2 => desc ? query.OrderByDescending(p => p.Nombre) : query.OrderBy(p => p.Nombre),
            3 => desc ? query.OrderByDescending(p => p.Apodo) : query.OrderBy(p => p.Apodo),
            4 => desc ? query.OrderByDescending(p => p.Ubicacion) : query.OrderBy(p => p.Ubicacion),
            _ => desc ? query.OrderByDescending(p => p.Nombre) : query.OrderBy(p => p.Nombre)
        };
    }
}
