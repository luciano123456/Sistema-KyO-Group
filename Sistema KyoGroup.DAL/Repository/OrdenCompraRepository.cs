// DAL/Repository/OrdenCompraRepository.cs
using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public class OrdenCompraRepository : IOrdenCompraRepository<OrdenesCompra>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public OrdenCompraRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
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
                    d.IdOrdenCompra = 0;         // se setea luego
                    d.CantidadPedida = d.CantidadPedida; // por las dudas
                    d.CantidadEntregada = d.CantidadEntregada;
                    d.CantidadRestante = d.CantidadPedida - d.CantidadEntregada;

                    d.Subtotal = d.PrecioLista * d.CantidadPedida;

                    // Estado por defecto (si viene en 0)
                    if (d.IdEstado == 0)
                        d.IdEstado = 1;

                    // Auditoría de registro en detalle
                    if (d.FechaRegistra == default)
                        d.FechaRegistra = DateTime.Now;

                    if (d.IdUsuarioRegistra == 0)
                        d.IdUsuarioRegistra = model.IdUsuarioRegistra;
                }

                // ----------- Costo total cabecera -----------
                model.CostoTotal = model.OrdenesComprasInsumos.Sum(x => x.Subtotal);

                // IMPORTANTE: Id = 0 para que EF lo trate como nuevo
                model.Id = 0;

                _dbcontext.OrdenesCompras.Add(model);
                await _dbcontext.SaveChangesAsync();  // => model.Id disponible

                // ----------- Detalle: vinculo al padre e inserto -----------
                if (model.OrdenesComprasInsumos.Count > 0)
                {
                    foreach (var d in model.OrdenesComprasInsumos)
                    {
                        d.Id = 0;
                        d.IdOrdenCompra = model.Id;
                    }

                    await _dbcontext.OrdenesComprasInsumos.AddRangeAsync(model.OrdenesComprasInsumos);
                    await _dbcontext.SaveChangesAsync();
                }

                await tx.CommitAsync();
                return true;
            }
            catch
            {
                await tx.RollbackAsync();
                return false;
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

                bool hayCambios = false;

                // ================== 2) CABECERA ==================
                var entryCab = _dbcontext.Entry(existente);
                entryCab.CurrentValues.SetValues(model);

                // No tocar auditoría de registro
                entryCab.Property(nameof(OrdenesCompra.IdUsuarioRegistra)).IsModified = false;
                entryCab.Property(nameof(OrdenesCompra.FechaRegistra)).IsModified = false;

                // Detectar si hubo cambios simples (sin contar auditoría de registro)
                bool cambiosCabeceraSimples = entryCab.Properties.Any(p =>
                    p.IsModified &&
                    p.Metadata.Name != nameof(OrdenesCompra.IdUsuarioRegistra) &&
                    p.Metadata.Name != nameof(OrdenesCompra.FechaRegistra)
                );

                hayCambios |= cambiosCabeceraSimples;

                // ================== 3) DETALLE ==================
                model.OrdenesComprasInsumos ??= new List<OrdenesComprasInsumo>();

                // Snapshot de los detalles ORIGINALES (tal como estaban en DB)
                var detallesOriginales = existente.OrdenesComprasInsumos.ToList();

                // Diccionario por Id (solo los que ya existían en DB)
                var originalesPorId = detallesOriginales.ToDictionary(d => d.Id, d => d);

                // Conjunto de Ids que vienen en el modelo (solo > 0 = existentes)
                var idsEntrantes = new HashSet<int>(
                    model.OrdenesComprasInsumos
                         .Where(d => d.Id > 0)
                         .Select(d => d.Id)
                );

                // -------- 3.a) Actualizar existentes + insertar nuevos --------
                foreach (var inc in model.OrdenesComprasInsumos)
                {
                    // Normalización de cantidades y subtotal
                    var cantPedida = inc.CantidadPedida;
                    var cantEntregada = inc.CantidadEntregada;
                    inc.CantidadRestante = cantPedida - cantEntregada;
                    inc.Subtotal = inc.PrecioLista * cantPedida;

                    if (inc.IdEstado == 0)
                        inc.IdEstado = 1;

                    if (inc.Id > 0 && originalesPorId.TryGetValue(inc.Id, out var cur))
                    {
                        // ===== Modificación de un detalle existente =====
                        bool mod = false;

                        if (cur.IdProveedorLista != inc.IdProveedorLista) { cur.IdProveedorLista = inc.IdProveedorLista; mod = true; }
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

                            // Preservar auditoría de registro
                            eDet.Property(nameof(OrdenesComprasInsumo.IdUsuarioRegistra)).IsModified = false;
                            eDet.Property(nameof(OrdenesComprasInsumo.FechaRegistra)).IsModified = false;

                            // Auditoría de modificación
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
                        // ===== Alta de un nuevo detalle (Id == 0 en el modelo) =====
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

                // -------- 3.b) Bajas: SOLO los que estaban originalmente y ya no vienen en el modelo --------
                var bajas = detallesOriginales
                    .Where(d => !idsEntrantes.Contains(d.Id))
                    .ToList();

                if (bajas.Count > 0)
                {
                    _dbcontext.OrdenesComprasInsumos.RemoveRange(bajas);
                    hayCambios = true;
                }

                // ================== 4) Recalcular costo total ==================
                await _dbcontext.SaveChangesAsync(); // asegura que Subtotal de cada detalle esté actualizado

                existente.CostoTotal = await _dbcontext.OrdenesComprasInsumos
                    .Where(d => d.IdOrdenCompra == existente.Id)
                    .SumAsync(d => d.Subtotal);

                // Auditoría de modificación de cabecera (solo si hubo cambios en algo)
                if (hayCambios && model.IdUsuarioModifica.HasValue)
                {
                    existente.IdUsuarioModifica = model.IdUsuarioModifica;
                    existente.FechaModifica = DateTime.Now;
                }

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

        /* ============================================================
         * ELIMINAR
         *  - Bloquea si tiene compras asociadas
         * ============================================================ */
        public async Task<(bool eliminado, string mensaje)> Eliminar(int id)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // ¿Hay compras asociadas?
                var tieneCompras = await _dbcontext.Compras
                    .AsNoTracking()
                    .AnyAsync(c => c.IdOrdenCompra == id);

                if (tieneCompras)
                    return (false, "No se puede eliminar: la orden posee compras asociadas.");

                var det = await _dbcontext.OrdenesComprasInsumos
                    .Where(d => d.IdOrdenCompra == id)
                    .ToListAsync();

                if (det.Count > 0)
                    _dbcontext.OrdenesComprasInsumos.RemoveRange(det);

                var cab = await _dbcontext.OrdenesCompras.FirstOrDefaultAsync(o => o.Id == id);
                if (cab == null) return (false, "Orden de compra no encontrada.");

                _dbcontext.OrdenesCompras.Remove(cab);
                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return (true, "Orden de compra eliminada correctamente.");
            }
            catch
            {
                await tx.RollbackAsync();
                return (false, "Error inesperado al eliminar la orden de compra.");
            }
        }

        /* ============================================================
         * OBTENER (para editar/ver)
         * ============================================================ */
        public async Task<OrdenesCompra?> Obtener(int id)
        {
            try
            {
                return await _dbcontext.OrdenesCompras
                    .Include(o => o.IdUnidadNegocioNavigation)
                    .Include(o => o.IdLocalNavigation)
                    .Include(o => o.IdProveedorNavigation)
                    .Include(o => o.IdEstadoNavigation)
                    .Include(o => o.OrdenesComprasInsumos)
                        .ThenInclude(d => d.IdProveedorListaNavigation)
                    .FirstOrDefaultAsync(o => o.Id == id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<IQueryable<OrdenesCompra>> ObtenerTodos()
        {
            IQueryable<OrdenesCompra> q = _dbcontext.OrdenesCompras.AsNoTracking();
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

        /* ============================================================
         * OBTENER TODOS por Unidad de Negocio / Usuario
         * ============================================================ */
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
    }
}
