using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IProveedoresCuentaCorrienteRepository
    {
        Task<List<(Proveedor proveedor, decimal saldo)>> ListarProveedoresConSaldo(string? buscar, bool soloConSaldo);
        Task<List<ProveedoresCuentaCorriente>> Movimientos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto);
        Task<decimal> Saldo(int idProveedor);
        Task<decimal> SaldoAnterior(int idProveedor, DateTime fechaDesde);
        Task<decimal> DeudaTotal();
        Task<(decimal debe, decimal haber, int cantidad)> Resumen(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto);
        Task<int> RegistrarMovimientoCompra(int idProveedor, int idCompra, decimal importe, DateTime fecha, string concepto);
        Task<int> RegistrarPago(ProveedoresPago pago);
        Task<List<ProveedoresPago>> ListarPagos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? texto);
        Task<bool> EliminarPago(int idPago);
        Task EliminarMovimientosCompra(int idCompra);
        Task ActualizarMovimientoCompra(int idCompra, decimal nuevoImporte, DateTime fecha, string concepto);
        Task<bool> EliminarMovimiento(int idMovimiento);
    }

    public class ProveedoresCuentaCorrienteRepository : IProveedoresCuentaCorrienteRepository
    {
        public const string TipoCompra = CuentaCorrienteTipoMov.Compra;
        public const string TipoPago = CuentaCorrienteTipoMov.Pago;

        private readonly SistemaKyoGroupContext _db;
        private readonly ICajasRepository _cajas;

        public ProveedoresCuentaCorrienteRepository(SistemaKyoGroupContext db, ICajasRepository cajas)
        {
            _db = db;
            _cajas = cajas;
        }

        public async Task<List<(Proveedor proveedor, decimal saldo)>> ListarProveedoresConSaldo(string? buscar, bool soloConSaldo)
        {
            var query = _db.Proveedores.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(buscar))
                query = query.Where(x => x.Nombre.Contains(buscar) || (x.Cuit != null && x.Cuit.Contains(buscar)));

            var proveedores = await query.OrderBy(x => x.Nombre).ToListAsync();
            var ids = proveedores.Select(x => x.Id).ToList();

            var saldosRaw = await _db.ProveedoresCuentaCorrientes
                .AsNoTracking()
                .Where(x => ids.Contains(x.IdProveedor))
                .GroupBy(x => x.IdProveedor)
                .Select(g => new { IdProveedor = g.Key, Saldo = g.Sum(m => m.Debe - m.Haber) })
                .ToListAsync();

            var saldos = saldosRaw.ToDictionary(x => x.IdProveedor, x => x.Saldo);

            var lista = proveedores
                .Select(p => (proveedor: p, saldo: saldos.TryGetValue(p.Id, out var s) ? s : 0m))
                .ToList();

            if (soloConSaldo)
                lista = lista.Where(x => x.saldo != 0).ToList();

            return lista;
        }

        private IQueryable<ProveedoresCuentaCorriente> QueryMovimientos(int idProveedor)
            => _db.ProveedoresCuentaCorrientes.AsNoTracking().Where(x => x.IdProveedor == idProveedor);

        public async Task<List<ProveedoresCuentaCorriente>> Movimientos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto)
        {
            var query = QueryMovimientos(idProveedor);

            if (fechaDesde.HasValue)
                query = query.Where(x => x.Fecha >= fechaDesde.Value.Date);
            if (fechaHasta.HasValue)
            {
                var hasta = fechaHasta.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(x => x.Fecha <= hasta);
            }
            if (!string.IsNullOrWhiteSpace(tipoMov))
                query = query.Where(x => x.TipoMov == tipoMov);
            if (!string.IsNullOrWhiteSpace(texto))
                query = query.Where(x => x.Concepto.Contains(texto));

            return await query.OrderBy(x => x.Fecha).ThenBy(x => x.Id).ToListAsync();
        }

        public async Task<decimal> Saldo(int idProveedor)
            => await QueryMovimientos(idProveedor).SumAsync(x => x.Debe - x.Haber);

        public async Task<decimal> SaldoAnterior(int idProveedor, DateTime fechaDesde)
            => await QueryMovimientos(idProveedor)
                .Where(x => x.Fecha < fechaDesde.Date)
                .SumAsync(x => x.Debe - x.Haber);

        /// <summary>Deuda consolidada: sólo los proveedores con saldo a favor suman.</summary>
        public async Task<decimal> DeudaTotal()
        {
            var saldos = await _db.ProveedoresCuentaCorrientes.AsNoTracking()
                .GroupBy(x => x.IdProveedor)
                .Select(g => g.Sum(m => m.Debe - m.Haber))
                .ToListAsync();
            return saldos.Where(s => s > 0).Sum();
        }

        public async Task<(decimal debe, decimal haber, int cantidad)> Resumen(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? tipoMov, string? texto)
        {
            var query = QueryMovimientos(idProveedor);

            if (fechaDesde.HasValue)
                query = query.Where(x => x.Fecha >= fechaDesde.Value.Date);
            if (fechaHasta.HasValue)
            {
                var hasta = fechaHasta.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(x => x.Fecha <= hasta);
            }
            if (!string.IsNullOrWhiteSpace(tipoMov))
                query = query.Where(x => x.TipoMov == tipoMov);
            if (!string.IsNullOrWhiteSpace(texto))
                query = query.Where(x => x.Concepto.Contains(texto));

            var debe = await query.SumAsync(x => x.Debe);
            var haber = await query.SumAsync(x => x.Haber);
            var cantidad = await query.CountAsync();
            return (debe, haber, cantidad);
        }

        public async Task<int> RegistrarMovimientoCompra(int idProveedor, int idCompra, decimal importe, DateTime fecha, string concepto)
        {
            var mov = new ProveedoresCuentaCorriente
            {
                IdProveedor = idProveedor,
                Fecha = fecha.Date,
                TipoMov = TipoCompra,
                IdMov = idCompra,
                Concepto = concepto,
                Debe = importe,
                Haber = 0
            };
            _db.ProveedoresCuentaCorrientes.Add(mov);
            await _db.SaveChangesAsync();
            return mov.Id;
        }

        /// <summary>
        /// Un pago escribe en tres lugares a la vez: el pago en sí, el Haber de la
        /// cuenta corriente y el egreso en el libro de caja. Va en una transacción
        /// para que no pueda quedar un saldo de proveedor sin su contrapartida de caja.
        /// </summary>
        public async Task<int> RegistrarPago(ProveedoresPago pago)
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            pago.Fecha = pago.Fecha.Date;
            pago.Anulado = false;
            if (pago.IdMedioPago is <= 0) pago.IdMedioPago = null;

            _db.ProveedoresPagos.Add(pago);
            await _db.SaveChangesAsync();

            var mov = new ProveedoresCuentaCorriente
            {
                IdProveedor = pago.IdProveedor,
                Fecha = pago.Fecha,
                TipoMov = TipoPago,
                IdMov = pago.Id,
                Concepto = pago.Concepto,
                Debe = 0,
                Haber = pago.Importe
            };
            _db.ProveedoresCuentaCorrientes.Add(mov);
            await _db.SaveChangesAsync();

            var proveedor = await _db.Proveedores.AsNoTracking()
                .Where(p => p.Id == pago.IdProveedor)
                .Select(p => p.Nombre)
                .FirstOrDefaultAsync();

            var asiento = await _cajas.Registrar(new CajaAsiento
            {
                IdCuenta = pago.IdCuenta,
                Fecha = pago.Fecha,
                TipoMov = CajaTipoMov.PagoProveedor,
                IdMov = pago.Id,
                Concepto = $"Pago a {proveedor ?? "proveedor"} — {pago.Concepto}",
                Egreso = pago.Importe,
                IdMedioPago = pago.IdMedioPago,
                NotaInterna = pago.NotaInterna,
                IdUsuario = pago.IdUsuarioRegistra
            });

            pago.IdCaja = asiento.Id;
            pago.IdCuentaCorriente = mov.Id;
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
            return mov.Id;
        }

        public async Task<List<ProveedoresPago>> ListarPagos(int idProveedor, DateTime? fechaDesde, DateTime? fechaHasta, string? texto)
        {
            var query = _db.ProveedoresPagos.AsNoTracking()
                .Include(x => x.IdCuentaNavigation)
                .Include(x => x.IdMedioPagoNavigation)
                .Include(x => x.IdUsuarioRegistraNavigation)
                .Where(x => x.IdProveedor == idProveedor && !x.Anulado);

            if (fechaDesde.HasValue)
                query = query.Where(x => x.Fecha >= fechaDesde.Value.Date);
            if (fechaHasta.HasValue)
            {
                var hasta = fechaHasta.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(x => x.Fecha <= hasta);
            }
            if (!string.IsNullOrWhiteSpace(texto))
                query = query.Where(x =>
                    x.Concepto.Contains(texto) ||
                    (x.NotaInterna != null && x.NotaInterna.Contains(texto)));

            return await query
                .OrderByDescending(x => x.Fecha)
                .ThenByDescending(x => x.Id)
                .ToListAsync();
        }

        /// <summary>
        /// Da de baja el pago: quita el Haber de la cuenta corriente y anula el asiento
        /// de caja (el asiento no se borra, queda como anulado para poder auditarlo).
        /// </summary>
        public async Task<bool> EliminarPago(int idPago)
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            var pago = await _db.ProveedoresPagos.FindAsync(idPago);
            if (pago == null) return false;

            var movs = await _db.ProveedoresCuentaCorrientes
                .Where(x => x.TipoMov == TipoPago && x.IdMov == idPago)
                .ToListAsync();
            if (movs.Count > 0)
                _db.ProveedoresCuentaCorrientes.RemoveRange(movs);

            await _cajas.AnularPorOrigen(
                CajaTipoMov.PagoProveedor, idPago,
                pago.IdUsuarioModifica ?? pago.IdUsuarioRegistra,
                "Pago a proveedor eliminado");

            _db.ProveedoresPagos.Remove(pago);
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
            return true;
        }

        public async Task EliminarMovimientosCompra(int idCompra)
        {
            var movs = await _db.ProveedoresCuentaCorrientes
                .Where(x => x.TipoMov == TipoCompra && x.IdMov == idCompra)
                .ToListAsync();
            if (movs.Any())
            {
                _db.ProveedoresCuentaCorrientes.RemoveRange(movs);
                await _db.SaveChangesAsync();
            }
        }

        public async Task ActualizarMovimientoCompra(int idCompra, decimal nuevoImporte, DateTime fecha, string concepto)
        {
            var mov = await _db.ProveedoresCuentaCorrientes
                .FirstOrDefaultAsync(x => x.TipoMov == TipoCompra && x.IdMov == idCompra);
            if (mov == null) return;
            mov.Debe = nuevoImporte;
            mov.Fecha = fecha.Date;
            mov.Concepto = concepto;
            await _db.SaveChangesAsync();
        }

        public async Task<bool> EliminarMovimiento(int idMovimiento)
        {
            var mov = await _db.ProveedoresCuentaCorrientes.FindAsync(idMovimiento);
            if (mov == null) return false;
            _db.ProveedoresCuentaCorrientes.Remove(mov);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
