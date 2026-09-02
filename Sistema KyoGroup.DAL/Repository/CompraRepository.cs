using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public class CompraRepository : ICompraRepository<Compra>
    {
        private readonly SistemaKyoGroupContext _db;

        public CompraRepository(SistemaKyoGroupContext context)
        {
            _db = context;
        }

        // ============================================================
        // RECALCULAR ORDEN COMPRA SEGÚN COMPRAS – RESPETA MANUAL
        // ============================================================
        private async Task RecalcularOrdenCompraDesdeCompras(int idOrdenCompra)
        {
            if (idOrdenCompra <= 0) return;

            var oc = await _db.OrdenesCompras
                .Include(o => o.OrdenesComprasInsumos)
                .FirstOrDefaultAsync(o => o.Id == idOrdenCompra);

            if (oc == null) return;

            var compras = await _db.Compras
                .Include(c => c.ComprasInsumos)
                .Where(c => c.IdOrdenCompra == idOrdenCompra)
                .ToListAsync();

            // SIN COMPRAS — RESET
            if (!compras.Any())
            {
                foreach (var det in oc.OrdenesComprasInsumos)
                {
                    det.CantidadEntregada = 0;
                    det.CantidadRestante = det.CantidadPedida;

                    // no pisar manual
                    if (det.IdEstado < 1 || det.IdEstado > 3)
                        det.IdEstado = 1;
                }

                oc.IdEstado = 1;
                oc.FechaEntrega = null;
                oc.FechaModifica = DateTime.Now;

                await _db.SaveChangesAsync();
                return;
            }

            var entregados = compras
                .SelectMany(c => c.ComprasInsumos)
                .GroupBy(x => new { x.IdInsumo, x.IdProveedorLista })
                .ToDictionary(
                    g => (g.Key.IdInsumo, (int?)g.Key.IdProveedorLista),
                    g => g.Sum(z => z.Cantidad)
                );

            foreach (var det in oc.OrdenesComprasInsumos)
            {
                var key = (det.IdInsumo, (int?)det.IdProveedorLista);

                decimal entregado = 0;
                if (entregados.TryGetValue(key, out var sum))
                    entregado = sum;

                if (entregado < 0) entregado = 0;
                if (entregado > det.CantidadPedida)
                    entregado = det.CantidadPedida;

                det.CantidadEntregada = entregado;
                det.CantidadRestante = det.CantidadPedida - entregado;

                // NO pisar manual
                if (det.IdEstado < 1 || det.IdEstado > 3)
                {
                    if (entregado <= 0)
                        det.IdEstado = 1;
                    else if (det.CantidadRestante <= 0)
                        det.IdEstado = 2;
                    else
                        det.IdEstado = 3;
                }
            }

            bool hayEntrega = oc.OrdenesComprasInsumos.Any(x => x.CantidadEntregada > 0);
            bool todoEntregado = oc.OrdenesComprasInsumos.All(x => x.CantidadRestante <= 0);

            if (!hayEntrega)
            {
                oc.IdEstado = 1;
                oc.FechaEntrega = null;
            }
            else if (todoEntregado)
            {
                oc.IdEstado = 2;
                oc.FechaEntrega = compras
                    .Select(c => c.Fecha)
                    .DefaultIfEmpty(DateTime.Now)
                    .Max();
            }
            else
            {
                oc.IdEstado = 3;
            }

            oc.FechaModifica = DateTime.Now;
            await _db.SaveChangesAsync();
        }

        // ============================================================
        // INSERTAR
        // ============================================================
        public async Task<bool> Insertar(Compra model)
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            try
            {
                var detalles = model.ComprasInsumos;
                model.ComprasInsumos = null;

                _db.Compras.Add(model);
                await _db.SaveChangesAsync();

                foreach (var d in detalles)
                {
                    d.IdCompra = model.Id;
                    d.SubtotalConDescuento = d.Cantidad * d.PrecioFinal;
                    d.SubtotalFinal = d.SubtotalConDescuento;

                    d.IdUsuarioRegistra = model.IdUsuarioRegistra;
                    d.FechaRegistra = DateTime.Now;
                }

                _db.ComprasInsumos.AddRange(detalles);
                await _db.SaveChangesAsync();

                if (model.IdOrdenCompra > 0)
                    await RecalcularOrdenCompraDesdeCompras(model.IdOrdenCompra);

                await tx.CommitAsync();
                return true;
            }
            catch
            {
                await tx.RollbackAsync();
                return false;
            }
        }

        // ============================================================
        // ACTUALIZAR
        // ============================================================
        // ============================================================
        // ACTUALIZAR COMPRA — VERSION FINAL CORREGIDA
        // ============================================================
        public async Task<bool> Actualizar(Compra model)
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            try
            {
                var existente = await _db.Compras
                    .Include(c => c.ComprasInsumos)
                    .FirstOrDefaultAsync(c => c.Id == model.Id);

                if (existente == null)
                    return false;

                // ====== CABECERA ======
                var entry = _db.Entry(existente);
                entry.CurrentValues.SetValues(model);

                // NO TOCAR auditoría de registro
                entry.Property(nameof(Compra.IdUsuarioRegistra)).IsModified = false;
                entry.Property(nameof(Compra.FechaRegistra)).IsModified = false;

                // Auditoría de modificación SIEMPRE debe ser manual
                existente.IdUsuarioModifica = model.IdUsuarioModifica;
                existente.FechaModifica = DateTime.Now;

                // ====== DETALLES ======
                var originales = existente.ComprasInsumos.ToList();

                foreach (var d in model.ComprasInsumos)
                {
                    d.SubtotalConDescuento = d.Cantidad * d.PrecioFinal;
                    d.SubtotalFinal = d.SubtotalConDescuento;

                    if (d.Id > 0)
                    {
                        // DETALLE EXISTENTE
                        var cur = originales.First(x => x.Id == d.Id);

                        var eDet = _db.Entry(cur);
                        eDet.CurrentValues.SetValues(d);

                        // NO PISAR FECHA REGISTRO
                        eDet.Property(nameof(ComprasInsumo.FechaRegistra)).IsModified = false;
                        eDet.Property(nameof(ComprasInsumo.IdUsuarioRegistra)).IsModified = false;

                        // AUDITORÍA MODIFICA
                        cur.IdUsuarioModifica = model.IdUsuarioModifica;
                        cur.FechaModifica = DateTime.Now;
                    }
                    else
                    {
                        // DETALLE NUEVO
                        d.Id = 0;
                        d.IdCompra = existente.Id;

                        d.IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra;
                        d.FechaRegistra = DateTime.Now;

                        _db.ComprasInsumos.Add(d);
                    }
                }

                // BORRADOS
                var idsNuevos = model.ComprasInsumos
                    .Where(x => x.Id > 0)
                    .Select(x => x.Id)
                    .ToHashSet();

                var bajas = originales.Where(x => !idsNuevos.Contains(x.Id)).ToList();
                if (bajas.Any())
                    _db.ComprasInsumos.RemoveRange(bajas);

                await _db.SaveChangesAsync();

                if (existente.IdOrdenCompra > 0)
                    await RecalcularOrdenCompraDesdeCompras(existente.IdOrdenCompra);

                await tx.CommitAsync();
                return true;
            }
            catch
            {
                await tx.RollbackAsync();
                return false;
            }
        }


        // ============================================================
        // ELIMINAR
        // ============================================================
        public async Task<(bool eliminado, string mensaje)> Eliminar(int id)
        {
            try
            {
                var cab = await _db.Compras.FirstOrDefaultAsync(c => c.Id == id);
                if (cab == null) return (false, "Compra no encontrada.");

                var idOc = cab.IdOrdenCompra;

                var det = await _db.ComprasInsumos
                    .Where(x => x.IdCompra == id)
                    .ToListAsync();

                if (det.Any()) _db.ComprasInsumos.RemoveRange(det);

                _db.Compras.Remove(cab);
                await _db.SaveChangesAsync();

                if (idOc > 0)
                    await RecalcularOrdenCompraDesdeCompras(idOc);

                return (true, "Compra eliminada correctamente.");
            }
            catch
            {
                return (false, "Error inesperado al eliminar la compra.");
            }
        }

        public async Task<Compra?> Obtener(int id)
        {
            try
            {
                return await _db.Compras
                    .Where(c => c.Id == id)

                    .Include(c => c.IdUnidadNegocioNavigation)
                    .Include(c => c.IdLocalNavigation)
                    .Include(c => c.IdProveedorNavigation)

                    .Include(c => c.IdOrdenCompraNavigation)
                        .ThenInclude(oc => oc.OrdenesComprasInsumos)
                            .ThenInclude(det => det.IdEstadoNavigation)

                    .Include(c => c.ComprasInsumos)
                        .ThenInclude(x => x.IdInsumoNavigation)

                    .Include(c => c.ComprasInsumos)
                        .ThenInclude(x => x.IdProveedorListaNavigation)

                    .AsNoTracking()
                    .FirstOrDefaultAsync();
            }
            catch
            {
                return null;
            }
        }

        public async Task<IQueryable<Compra>> ObtenerTodos()
        {
            return await Task.FromResult(_db.Compras.AsNoTracking());
        }

        public async Task<List<Compra>> ObtenerTodosConFiltros(
            int? idUnidadNegocio,
            int? idLocal,
            int? idProveedor,
            DateTime? fechaDesde,
            DateTime? fechaHasta,
            int? idUsuario)
        {
            var q = _db.Compras
                .Include(c => c.IdUnidadNegocioNavigation)
                .Include(c => c.IdLocalNavigation)
                .Include(c => c.IdProveedorNavigation)
                .Include(c => c.IdOrdenCompraNavigation)
                .AsQueryable();

            if (idUnidadNegocio > 0) q = q.Where(c => c.IdUnidadNegocio == idUnidadNegocio);
            if (idLocal > 0) q = q.Where(c => c.IdLocal == idLocal);
            if (idProveedor > 0) q = q.Where(c => c.IdProveedor == idProveedor);
            if (fechaDesde != null) q = q.Where(c => c.Fecha >= fechaDesde);
            if (fechaHasta != null) q = q.Where(c => c.Fecha <= fechaHasta);
            if (idUsuario != null && idUsuario > 0) q = q.Where(c => c.IdUsuarioRegistra == idUsuario);

            return await q.OrderByDescending(c => c.Fecha).ToListAsync();
        }
    }
}
