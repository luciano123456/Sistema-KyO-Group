// DAL/Repository/OrdenCompraRepository.cs
using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public class OrdenCompraRepository : IOrdenCompraRepository<OrdenesCompra>
    {
        private readonly SistemaKyoGroupContext _dbcontext;
        private readonly ICompraRepository<Compra> _compraRepo;

        public OrdenCompraRepository(
            SistemaKyoGroupContext context,
            ICompraRepository<Compra> compraRepo)
        {
            _dbcontext = context;
            _compraRepo = compraRepo;
        }

        /* ============================================================
         * INSERTAR
         *  - Inserta cabecera
         *  - Vincula hijos con el nuevo Id
         *  - Inserta detalle
         *  - Recalcula CostoTotal
         * ============================================================ */
        public async Task<bool> Insertar(OrdenesCompra model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                model.OrdenesComprasInsumos ??= new List<OrdenesComprasInsumo>();

                // ----------- Normalizo detalle EN MEMORIA ----------- 
                foreach (var d in model.OrdenesComprasInsumos)
                {
                    d.Id = 0;                    // identity
                    d.IdOrdenCompra = 0;         // EF lo setea luego automáticamente

                    d.CantidadPedida = d.CantidadPedida;
                    d.CantidadEntregada = d.CantidadEntregada;
                    d.CantidadRestante = d.CantidadPedida - d.CantidadEntregada;

                    // 0 no es un Id válido de lista → FK
                    if (d.IdProveedorLista is null or <= 0)
                        d.IdProveedorLista = null;

                    d.Subtotal = d.PrecioLista * d.CantidadPedida;

                    // Estado por defecto (si viene en 0)
                    if (d.IdEstado == 0)
                        d.IdEstado = 1;          // Pendiente

                    // Auditoría de registro en detalle
                    if (d.FechaRegistra == default)
                        d.FechaRegistra = DateTime.Now;

                    if (d.IdUsuarioRegistra == 0)
                        d.IdUsuarioRegistra = model.IdUsuarioRegistra;
                }

                if (model.IdEstado <= 0)
                    model.IdEstado = 1;

                // ----------- Costo total cabecera ----------- 
                model.CostoTotal = model.OrdenesComprasInsumos.Sum(x => x.Subtotal);

                // IMPORTANTE: Id = 0 para que EF lo trate como nuevo
                model.Id = 0;

                // SOLO agregamos la cabecera con sus hijos. EF inserta todo de una.
                _dbcontext.OrdenesCompras.Add(model);

                await _dbcontext.SaveChangesAsync();  // Inserta cabecera + detalle

                var uid = model.IdUsuarioRegistra;
                if (uid > 0)
                {
                    var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                    var cant = model.OrdenesComprasInsumos?.Count ?? 0;
                    var provNom = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "Proveedor", model.IdProveedor);
                    var estNom = await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "EstadoOrdenCompra", model.IdEstado);
                    EntidadHistorialHelper.Agregar(
                        _dbcontext, EntidadHistorialHelper.OrdenCompra, model.Id,
                        EntidadHistorialHelper.AccionCreacion,
                        $"Alta de OC #{model.Id}",
                        $"Proveedor: {provNom}. Total: {EntidadHistorialHelper.S(model.CostoTotal)}. Ítems: {cant}. Estado: {estNom}.",
                        uid, nombre);
                    await _dbcontext.SaveChangesAsync();
                }

                await tx.CommitAsync();
                return true;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                throw new InvalidOperationException(
                    "No se pudo guardar la orden de compra: " + (ex.InnerException?.Message ?? ex.Message),
                    ex);
            }
        }


        /* ============================================================
         * ACTUALIZAR (con DIFF en detalle)
         *  - No toca IdUsuarioRegistra / FechaRegistra de cabecera
         *  - Upsert de detalle (altas / modificaciones / bajas)
         *  - Recalcula CostoTotal
         * ============================================================ */
        public async Task<bool> Actualizar(OrdenesCompra model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // ================== 1) Traer cabecera + detalle existente ==================
                var existente = await _dbcontext.OrdenesCompras
                    .Include(o => o.OrdenesComprasInsumos)
                    .FirstOrDefaultAsync(o => o.Id == model.Id);

                if (existente == null)
                    return false;

                var antesSnap = EntidadHistorialHelper.Snapshot(
                    ("Proveedor", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "Proveedor", existente.IdProveedor)),
                    ("Estado", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "EstadoOrdenCompra", existente.IdEstado)),
                    ("Local", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "Local", existente.IdLocal)),
                    ("UN", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadNegocio", existente.IdUnidadNegocio)),
                    ("Total", existente.CostoTotal),
                    ("Ítems", existente.OrdenesComprasInsumos?.Count ?? 0));

                bool hayCambios = false;

                // ================== 2) CABECERA ==================
                var entryCab = _dbcontext.Entry(existente);
                entryCab.CurrentValues.SetValues(model);

                // No tocar auditoría de registro
                entryCab.Property(nameof(OrdenesCompra.IdUsuarioRegistra)).IsModified = false;
                entryCab.Property(nameof(OrdenesCompra.FechaRegistra)).IsModified = false;

                bool cambiosCabeceraSimples = entryCab.Properties.Any(p =>
                    p.IsModified &&
                    p.Metadata.Name != nameof(OrdenesCompra.IdUsuarioRegistra) &&
                    p.Metadata.Name != nameof(OrdenesCompra.FechaRegistra)
                );

                hayCambios |= cambiosCabeceraSimples;

                // ================== 3) DETALLE ==================
                model.OrdenesComprasInsumos ??= new List<OrdenesComprasInsumo>();

                var detallesOriginales = existente.OrdenesComprasInsumos.ToList();
                var originalesPorId = detallesOriginales.ToDictionary(d => d.Id, d => d);
                var idsEntrantes = new HashSet<int>(
                    model.OrdenesComprasInsumos.Where(d => d.Id > 0).Select(d => d.Id)
                );

                foreach (var inc in model.OrdenesComprasInsumos)
                {
                    var cantPedida = inc.CantidadPedida;
                    var cantEntregada = inc.CantidadEntregada;
                    inc.CantidadRestante = cantPedida - cantEntregada;
                    inc.Subtotal = inc.PrecioLista * cantPedida;

                    if (inc.IdEstado == 0)
                        inc.IdEstado = 1;

                    if (inc.Id > 0 && originalesPorId.TryGetValue(inc.Id, out var cur))
                    {
                        bool mod = false;

                        if (cur.IdInsumo != inc.IdInsumo) { cur.IdInsumo = inc.IdInsumo; mod = true; }
                        if (cur.CantidadPedida != inc.CantidadPedida) { cur.CantidadPedida = inc.CantidadPedida; mod = true; }
                        if (cur.CantidadEntregada != inc.CantidadEntregada) { cur.CantidadEntregada = inc.CantidadEntregada; mod = true; }
                        if (cur.CantidadRestante != inc.CantidadRestante) { cur.CantidadRestante = inc.CantidadRestante; mod = true; }
                        if (cur.PrecioLista != inc.PrecioLista) { cur.PrecioLista = inc.PrecioLista; mod = true; }
                        if (cur.Subtotal != inc.Subtotal) { cur.Subtotal = inc.Subtotal; mod = true; }
                        if (cur.IdEstado != inc.IdEstado) { cur.IdEstado = inc.IdEstado; mod = true; }
                        if (cur.NotaInterna != inc.NotaInterna) { cur.NotaInterna = inc.NotaInterna; mod = true; }

                        if (mod)
                        {
                            var eDet = _dbcontext.Entry(cur);

                            eDet.Property(nameof(OrdenesComprasInsumo.IdUsuarioRegistra)).IsModified = false;
                            eDet.Property(nameof(OrdenesComprasInsumo.FechaRegistra)).IsModified = false;

                            if (model.IdUsuarioModifica.HasValue)
                            {
                                cur.IdUsuarioModifica = model.IdUsuarioModifica;
                                cur.FechaModifica = DateTime.Now;
                            }

                            hayCambios = true;
                        }
                    }
                    else
                    {
                        var nuevo = new OrdenesComprasInsumo
                        {
                            Id = 0,
                            IdOrdenCompra = existente.Id,
                            IdInsumo = inc.IdInsumo,
                            IdProveedorLista = inc.IdProveedorLista,
                            CantidadPedida = inc.CantidadPedida,
                            CantidadEntregada = inc.CantidadEntregada,
                            CantidadRestante = inc.CantidadRestante,
                            PrecioLista = inc.PrecioLista,
                            Subtotal = inc.Subtotal,
                            IdEstado = inc.IdEstado,
                            NotaInterna = inc.NotaInterna,
                            IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra,
                            FechaRegistra = DateTime.Now
                        };

                        await _dbcontext.OrdenesComprasInsumos.AddAsync(nuevo);
                        hayCambios = true;
                    }
                }

                var bajas = detallesOriginales
                    .Where(d => !idsEntrantes.Contains(d.Id))
                    .ToList();

                if (bajas.Count > 0)
                {
                    _dbcontext.OrdenesComprasInsumos.RemoveRange(bajas);
                    hayCambios = true;
                }

                await _dbcontext.SaveChangesAsync();

                existente.CostoTotal = await _dbcontext.OrdenesComprasInsumos
                    .Where(d => d.IdOrdenCompra == existente.Id)
                    .SumAsync(d => d.Subtotal);

                if (hayCambios && model.IdUsuarioModifica.HasValue)
                {
                    existente.IdUsuarioModifica = model.IdUsuarioModifica;
                    existente.FechaModifica = DateTime.Now;
                }

                await _dbcontext.SaveChangesAsync();

                var uid = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra;
                if (uid > 0)
                {
                    var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                    var despuesSnap = EntidadHistorialHelper.Snapshot(
                        ("Proveedor", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "Proveedor", existente.IdProveedor)),
                        ("Estado", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "EstadoOrdenCompra", existente.IdEstado)),
                        ("Local", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "Local", existente.IdLocal)),
                        ("UN", await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadNegocio", existente.IdUnidadNegocio)),
                        ("Total", existente.CostoTotal),
                        ("Ítems", await _dbcontext.OrdenesComprasInsumos.CountAsync(d => d.IdOrdenCompra == existente.Id)));
                    EntidadHistorialHelper.AgregarSiCambio(
                        _dbcontext, EntidadHistorialHelper.OrdenCompra, existente.Id,
                        $"OC #{existente.Id}", antesSnap, despuesSnap, uid, nombre);
                    await _dbcontext.SaveChangesAsync();
                }

                await tx.CommitAsync();
                return true;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                throw new InvalidOperationException(
                    "No se pudo actualizar la orden de compra: " + (ex.InnerException?.Message ?? ex.Message),
                    ex);
            }
        }

        public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
        {
            try
            {
                var comprasIds = await _dbcontext.Compras
                    .AsNoTracking()
                    .Where(c => c.IdOrdenCompra == id)
                    .Select(c => c.Id)
                    .ToListAsync();

                if (comprasIds.Count > 0 && !cascade)
                {
                    var detalle = comprasIds.Count <= 8
                        ? "Compras #" + string.Join(", #", comprasIds)
                        : $"Compras #{string.Join(", #", comprasIds.Take(8))}… (+{comprasIds.Count - 8})";

                    return DeleteResult.Relacion(
                        "No se puede eliminar: la orden posee compras asociadas.",
                        new[]
                        {
                            new DeleteDependencia
                            {
                                Entidad = "Compras",
                                Cantidad = comprasIds.Count,
                                Detalle = detalle,
                                Cascadeable = true
                            }
                        },
                        cascadeDisponible: true);
                }

                if (comprasIds.Count > 0 && cascade)
                {
                    foreach (var idCompra in comprasIds)
                    {
                        var (okCompra, msgCompra) = await _compraRepo.Eliminar(idCompra);
                        if (!okCompra)
                            return DeleteResult.Error(msgCompra ?? $"No se pudo eliminar la compra #{idCompra}.");
                    }
                }

                await using var tx = await _dbcontext.Database.BeginTransactionAsync();
                try
                {
                    var det = await _dbcontext.OrdenesComprasInsumos
                        .Where(d => d.IdOrdenCompra == id)
                        .ToListAsync();

                    if (det.Count > 0)
                        _dbcontext.OrdenesComprasInsumos.RemoveRange(det);

                    var cab = await _dbcontext.OrdenesCompras.FirstOrDefaultAsync(o => o.Id == id);
                    if (cab == null) return DeleteResult.NotFound("la orden de compra");

                    var uid = cab.IdUsuarioModifica ?? cab.IdUsuarioRegistra;
                    _dbcontext.OrdenesCompras.Remove(cab);
                    if (uid > 0)
                    {
                        var nombre = await EntidadHistorialHelper.NombreUsuarioAsync(_dbcontext, uid);
                        EntidadHistorialHelper.Agregar(
                            _dbcontext, EntidadHistorialHelper.OrdenCompra, id,
                            EntidadHistorialHelper.AccionEliminacion,
                            cascade
                                ? $"Eliminación en cascada de OC #{id}"
                                : $"Eliminación de OC #{id}",
                            $"Proveedor: {cab.IdProveedor}. Total: {EntidadHistorialHelper.S(cab.CostoTotal)}."
                                + (comprasIds.Count > 0 ? $" Compras eliminadas: {comprasIds.Count}." : ""),
                            uid, nombre);
                    }
                    await _dbcontext.SaveChangesAsync();
                    await tx.CommitAsync();
                    return DeleteResult.Success(
                        cascade && comprasIds.Count > 0
                            ? "Orden de compra y compras asociadas eliminadas correctamente."
                            : "Orden de compra eliminada correctamente.");
                }
                catch
                {
                    await tx.RollbackAsync();
                    return DeleteResult.Error("Error inesperado al eliminar la orden de compra.");
                }
            }
            catch (Exception ex)
            {
                return DeleteResult.Error(
                    "Error inesperado al eliminar la orden de compra: "
                    + (ex.InnerException?.Message ?? ex.Message));
            }
        }

        /* ============================================================
         * OBTENER (para editar/ver)
         * ============================================================ */
        public async Task<OrdenesCompra?> Obtener(int id)
        {
            return await _dbcontext.OrdenesCompras
                .Where(o => o.Id == id)

                // Cabecera
                .Include(o => o.IdUnidadNegocioNavigation)
                .Include(o => o.IdLocalNavigation)
                .Include(o => o.IdProveedorNavigation)
                .Include(o => o.IdEstadoNavigation)

                // Detalle OC
                .Include(o => o.OrdenesComprasInsumos)
                    .ThenInclude(d => d.IdInsumoNavigation)
                .Include(o => o.OrdenesComprasInsumos)
                    .ThenInclude(d => d.IdEstadoNavigation)
                .Include(o => o.OrdenesComprasInsumos)
                    .ThenInclude(d => d.IdProveedorListaNavigation)

                // Compras asociadas + su detalle
                .Include(o => o.Compras)
                    .ThenInclude(c => c.ComprasInsumos)
                .Include(o => o.Compras)
                    .ThenInclude(c => c.ComprasInsumos)
                        .ThenInclude(ci => ci.IdInsumoNavigation)

                .AsNoTracking()
                .FirstOrDefaultAsync();
        }


        public async Task<IQueryable<OrdenesCompra>> ObtenerTodos()
        {
            IQueryable<OrdenesCompra> q = _dbcontext.OrdenesCompras.AsNoTracking();
            return await Task.FromResult(q);
        }

        public async Task<IQueryable<OrdenesCompra>> ObtenerPendientes()
        {
            IQueryable<OrdenesCompra> q = _dbcontext.OrdenesCompras
                .Where(x => x.IdEstado == 1)

                .Include(o => o.IdUnidadNegocioNavigation)
                .Include(o => o.IdLocalNavigation)
                .Include(o => o.IdProveedorNavigation)
                .Include(o => o.IdEstadoNavigation)

                .Include(o => o.OrdenesComprasInsumos)
                    .ThenInclude(d => d.IdInsumoNavigation)
                .Include(o => o.OrdenesComprasInsumos)
                    .ThenInclude(d => d.IdEstadoNavigation)
                .Include(o => o.OrdenesComprasInsumos)
                    .ThenInclude(d => d.IdProveedorListaNavigation)

                .AsNoTracking()
                .AsQueryable();

            return await Task.FromResult(q);
        }

        public async Task<List<OrdenesCompra>> ObtenerTodosConFiltros(
            int? idUnidadNegocio = null,
            int? idLocal = null,
            int? idProveedor = null,
            int? idEstado = null,
            DateTime? fechaDesde = null,
            DateTime? fechaHasta = null,
            int? idUsuario = null)
        {
            var query = _dbcontext.OrdenesCompras
                .Include(o => o.IdUnidadNegocioNavigation)
                .Include(o => o.IdLocalNavigation)
                .Include(o => o.IdProveedorNavigation)
                .Include(o => o.IdEstadoNavigation)
                .Include(o => o.OrdenesComprasInsumos)
                .Include(o => o.Compras)
                .AsQueryable();

            if (idUnidadNegocio.HasValue && idUnidadNegocio > 0)
                query = query.Where(o => o.IdUnidadNegocio == idUnidadNegocio);

            if (idLocal.HasValue && idLocal > 0)
                query = query.Where(o => o.IdLocal == idLocal);

            if (idProveedor.HasValue && idProveedor > 0)
                query = query.Where(o => o.IdProveedor == idProveedor);

            if (idEstado.HasValue && idEstado > 0)
                query = query.Where(o => o.IdEstado == idEstado);

            if (fechaDesde.HasValue)
                query = query.Where(o => o.FechaEmision >= fechaDesde);

            if (fechaHasta.HasValue)
                query = query.Where(o => o.FechaEmision <= fechaHasta);

            if (idUsuario.HasValue && idUsuario > 0)
                query = query.Where(o => o.IdUsuarioRegistra == idUsuario);

            return await query
                .OrderByDescending(o => o.FechaEmision)
                .ToListAsync();
        }

        public async Task<IQueryable<OrdenesCompra>> ObtenerTodosUnidadNegocio(
            int idUnidadNegocio,
            int userId,
            int? idEstado = null)
        {
            try
            {
                var baseQuery = _dbcontext.OrdenesCompras
                    .AsNoTracking()
                    .Where(o => o.IdUnidadNegocio > 0);

                if (idUnidadNegocio != -1)
                {
                    baseQuery = baseQuery.Where(o => o.IdUnidadNegocio == idUnidadNegocio);
                }
                else
                {
                    var idsPermitidos = await _dbcontext.UsuariosUnidadesNegocios
                        .AsNoTracking()
                        .Where(x => x.IdUsuario == userId)
                        .Select(x => x.IdUnidadNegocio)
                        .Distinct()
                        .ToListAsync();

                    if (idsPermitidos == null || idsPermitidos.Count == 0)
                        return Enumerable.Empty<OrdenesCompra>().AsQueryable();

                    baseQuery = baseQuery.Where(o => idsPermitidos.Contains(o.IdUnidadNegocio));
                }

                if (idEstado.HasValue)
                    baseQuery = baseQuery.Where(o => o.IdEstado == idEstado.Value);

                return await Task.FromResult(baseQuery);
            }
            catch
            {
                return Enumerable.Empty<OrdenesCompra>().AsQueryable();
            }
        }

        public async Task ActualizarEstadosDetalle(int idOrdenCompra, IDictionary<int, int> estadosPorDetalle)
        {
            if (estadosPorDetalle == null || !estadosPorDetalle.Any())
                return;

            var ids = estadosPorDetalle.Keys.ToList();

            var detalles = await _dbcontext.OrdenesComprasInsumos
                .Where(d => d.IdOrdenCompra == idOrdenCompra && ids.Contains(d.Id))
                .ToListAsync();

            foreach (var det in detalles)
            {
                if (estadosPorDetalle.TryGetValue(det.Id, out var nuevoEstado) && nuevoEstado > 0)
                {
                    det.IdEstado = nuevoEstado;
                }
            }

            await _dbcontext.SaveChangesAsync();
        }
    }
}
