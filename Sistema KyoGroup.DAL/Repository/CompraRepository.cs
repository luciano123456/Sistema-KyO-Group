using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Data.SqlTypes;
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

        /* =========================================================
         * MÉTODO PRIVADO: Recalcular OC desde todas las compras
         *  - Recalcula CantidadEntregada / Restante / Estado por línea
         *  - Actualiza IdEstado y FechaEntrega de cabecera
         * ========================================================= */
        private async Task RecalcularOrdenCompraDesdeCompras(int idOrdenCompra)
        {
            if (idOrdenCompra <= 0) return;

            // =============================
            // 1) Traigo cabecera + detalle
            // =============================
            var oc = await _db.OrdenesCompras
                .Include(o => o.OrdenesComprasInsumos)
                .FirstOrDefaultAsync(o => o.Id == idOrdenCompra);

            if (oc == null) return;

            // =============================
            // 2) Traigo todas las compras
            // =============================
            var compras = await _db.Compras
                .Include(c => c.ComprasInsumos)
                .Where(c => c.IdOrdenCompra == idOrdenCompra)
                .ToListAsync();

            // ==============================================================
            // 3) Si NO hay compras → TODO vuelve a PENDIENTE
            // ==============================================================
            if (compras.Count == 0)
            {
                foreach (var det in oc.OrdenesComprasInsumos)
                {
                    det.CantidadEntregada = 0;
                    det.CantidadRestante = det.CantidadPedida;
                    // solo si el estado está raro lo forzamos a Pendiente
                    if (det.IdEstado > 3)
                        det.IdEstado = 1;
                }

                oc.IdEstado = 1;      // Pendiente
                oc.FechaEntrega = null;
                oc.FechaModifica = DateTime.Now;

                await _db.SaveChangesAsync();
                return;
            }

            // ==============================================================
            // 4) Agrupo lo entregado por (IdInsumo, IdProveedorLista)
            //    => key SIEMPRE (int, int?)
            //    IMPORTANTE: la suma puede ser negativa; la clampamos después
            // ==============================================================
            Dictionary<(int IdInsumo, int? IdProveedorLista), decimal> entregados =
                compras
                    .SelectMany(c => c.ComprasInsumos)
                    .GroupBy(d => new { d.IdInsumo, d.IdProveedorLista })
                    .ToDictionary(
                        g => (g.Key.IdInsumo, (int?)g.Key.IdProveedorLista),
                        g => g.Sum(x => x.Cantidad)
                    );

            // ==============================================================
            // 5) Actualizo cada línea de la OC
            // ==============================================================
            foreach (var det in oc.OrdenesComprasInsumos)
            {
                var key = (det.IdInsumo, (int?)det.IdProveedorLista);

                decimal cantEntregada = 0;
                if (entregados.TryGetValue(key, out var totalEntregado))
                    cantEntregada = totalEntregado;

                // ---- CLAMP: nunca < 0 y nunca > CantidadPedida ----
                if (cantEntregada < 0)
                    cantEntregada = 0;

                if (cantEntregada > det.CantidadPedida)
                    cantEntregada = det.CantidadPedida;

                det.CantidadEntregada = cantEntregada;
                det.CantidadRestante = det.CantidadPedida - cantEntregada;

                // ---- Estado de la línea ----
                // Si ya viene un estado válido (1,2,3) NO lo tocamos.
                // Solo calculamos si está en 0 o fuera de rango.
                if (det.IdEstado > 3)
                {
                    if (det.CantidadEntregada <= 0)
                        det.IdEstado = 1;        // Pendiente
                    else if (det.CantidadRestante <= 0)
                        det.IdEstado = 2;        // Entregado
                    else
                        det.IdEstado = 3;        // Parcial / Incompleto
                }
            }

            // ==============================================================
            // 6) Estado de cabecera + FechaEntrega
            // ==============================================================
            bool hayEntregas = oc.OrdenesComprasInsumos.Any(d => d.CantidadEntregada > 0);
            bool todoEntregado = oc.OrdenesComprasInsumos.All(d => d.CantidadRestante <= 0);

            if (!hayEntregas)
            {
                oc.IdEstado = 1;           // Pendiente
                oc.FechaEntrega = null;
            }
            else if (todoEntregado)
            {
                oc.IdEstado = 2;           // Entregado

                oc.FechaEntrega = compras
                    .Where(c => c.Fecha != default)
                    .Select(c => c.Fecha)
                    .DefaultIfEmpty(DateTime.Now)
                    .Max();
            }
            else
            {
                oc.IdEstado = 3;           // Parcial
            }

            oc.FechaModifica = DateTime.Now;

            await _db.SaveChangesAsync();
        }


        /* =========================================================
         * INSERTAR COMPRA
         *  - Usa el mismo IdProveedorLista que la OC (si existe)
         * ========================================================= */
        public async Task<bool> Insertar(Compra model)
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                // Guardo una referencia a los detalles y "desengancho" la navegación
                var detalles = model.ComprasInsumos ?? new List<ComprasInsumo>();
                model.ComprasInsumos = null; // 👈 así EF no inserta los detalles por cascada

                // 1) Cabecera
                model.Id = 0;
                model.FechaRegistra = DateTime.Now;

                _db.Compras.Add(model);
                await _db.SaveChangesAsync(); // => genera model.Id

                // 2) Normalizo detalle con el Id de la compra recién generado
                foreach (var d in detalles)
                {
                    d.Id = 0;
                    d.IdCompra = model.Id;
                    d.FechaRegistra = DateTime.Now;

                    // Si te llega IdProveedorLista desde el JS, EF lo respeta tal cual
                    // (no lo pisamos acá)

                    d.SubtotalConDescuento = d.Cantidad * d.PrecioFinal;
                    d.SubtotalFinal = d.SubtotalConDescuento;
                }

                // 3) Inserto detalle UNA sola vez
                await _db.ComprasInsumos.AddRangeAsync(detalles);
                await _db.SaveChangesAsync();

                // 4) Recalcular OC si corresponde
                if (model.IdOrdenCompra > 0)
                {
                    await RecalcularOrdenCompraDesdeCompras(model.IdOrdenCompra);
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

        /* =========================================================
         * ACTUALIZAR COMPRA
         * ========================================================= */
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

                // ===== Normalizar fechas para no romper SqlDateTime =====
                var minSqlDate = (DateTime)SqlDateTime.MinValue;
                if (model.Fecha < minSqlDate)
                {
                    // si llegara 0001-01-01 desde el modelo, conservamos la de DB
                    model.Fecha = existente.Fecha;
                }

                // ===== CABECERA =====
                var entry = _db.Entry(existente);
                entry.CurrentValues.SetValues(model);

                // No pisar auditoría de registro
                entry.Property(nameof(Compra.IdUsuarioRegistra)).IsModified = false;
                entry.Property(nameof(Compra.FechaRegistra)).IsModified = false;

                // La auditoría de modificación la seteamos nosotros a mano
                entry.Property(nameof(Compra.IdUsuarioModifica)).IsModified = false;
                entry.Property(nameof(Compra.FechaModifica)).IsModified = false;

                // ===== DETALLE =====
                model.ComprasInsumos ??= new List<ComprasInsumo>();

                var originales = existente.ComprasInsumos.ToList();
                var idsNuevos = model.ComprasInsumos
                    .Where(x => x.Id > 0)
                    .Select(x => x.Id)
                    .ToHashSet();

                foreach (var inc in model.ComprasInsumos)
                {
                    inc.SubtotalConDescuento = inc.Cantidad * inc.PrecioFinal;
                    inc.SubtotalFinal = inc.SubtotalConDescuento;

                    if (inc.Id > 0)
                    {
                        var cur = originales.First(x => x.Id == inc.Id);

                        var eDet = _db.Entry(cur);
                        eDet.CurrentValues.SetValues(inc);

                        // No pisar auditoría de registro en el detalle
                        eDet.Property(nameof(ComprasInsumo.IdUsuarioRegistra)).IsModified = false;
                        eDet.Property(nameof(ComprasInsumo.FechaRegistra)).IsModified = false;

                        // Auditoría de modificación
                        cur.IdUsuarioModifica = model.IdUsuarioModifica;
                        cur.FechaModifica = DateTime.Now;
                    }
                    else
                    {
                        inc.IdCompra = existente.Id;

                        // Auditoría de registro del detalle nuevo
                        inc.IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra;
                        inc.FechaRegistra = DateTime.Now;

                        _db.ComprasInsumos.Add(inc);
                    }
                }

                var bajas = originales.Where(x => !idsNuevos.Contains(x.Id)).ToList();
                if (bajas.Any()) _db.ComprasInsumos.RemoveRange(bajas);

                // Auditoría de modificación de la cabecera
                existente.IdUsuarioModifica = model.IdUsuarioModifica;
                existente.FechaModifica = DateTime.Now;

                await _db.SaveChangesAsync();

                if (existente.IdOrdenCompra > 0)
                {
                    await RecalcularOrdenCompraDesdeCompras(existente.IdOrdenCompra);
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
        /* =========================================================
         * ELIMINAR
         * ========================================================= */
        public async Task<(bool eliminado, string mensaje)> Eliminar(int id)
        {
            try
            {
                var cab = await _db.Compras.FirstOrDefaultAsync(c => c.Id == id);
                if (cab == null) return (false, "Compra no encontrada.");

                var idOrdenCompra = cab.IdOrdenCompra;

                var det = await _db.ComprasInsumos
                    .Where(d => d.IdCompra == id)
                    .ToListAsync();

                if (det.Any()) _db.ComprasInsumos.RemoveRange(det);

                _db.Compras.Remove(cab);
                await _db.SaveChangesAsync();

                if (idOrdenCompra > 0)
                {
                    await RecalcularOrdenCompraDesdeCompras(idOrdenCompra);
                }

                return (true, "Compra eliminada correctamente.");
            }
            catch
            {
                return (false, "Error inesperado al eliminar la compra.");
            }
        }


        /* =========================================================
         * OBTENER
         * ========================================================= */
        public async Task<Compra?> Obtener(int id)
        {
            try
            {
                return await _db.Compras
                    .Where(c => c.Id == id)

                    // ================= CABECERA =================
                    .Include(c => c.IdUnidadNegocioNavigation)
                    .Include(c => c.IdLocalNavigation)
                    .Include(c => c.IdProveedorNavigation)

                    // 👉 OC + su detalle
                    .Include(c => c.IdOrdenCompraNavigation)
                        .ThenInclude(oc => oc.OrdenesComprasInsumos)

                    .Include(c => c.IdUsuarioRegistraNavigation)
                    .Include(c => c.IdUsuarioModificaNavigation)

                    // ================= DETALLE ==================
                    .Include(c => c.ComprasInsumos)
                        .ThenInclude(d => d.IdInsumoNavigation)

                    .Include(c => c.ComprasInsumos)
                        .ThenInclude(d => d.IdProveedorListaNavigation)

                    .Include(c => c.ComprasInsumos)
                        .ThenInclude(d => d.IdUsuarioRegistraNavigation)

                    .Include(c => c.ComprasInsumos)
                        .ThenInclude(d => d.IdUsuarioModificaNavigation)

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
            IQueryable<Compra> q = _db.Compras.AsNoTracking();
            return await Task.FromResult(q);
        }

        /* =========================================================
         * OBTENER TODOS CON FILTROS
         * ========================================================= */
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
