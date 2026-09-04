using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

public class CuentasRepository : ICuentasRepository
{
    private readonly SistemaKyoGroupContext _db;

    public CuentasRepository(SistemaKyoGroupContext context)
    {
        _db = context;
    }

    public async Task<bool> Insertar(Cuenta model)
    {
        try
        {
            Normalizar(model);
            _db.Cuentas.Add(model);
            await _db.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _db, EntidadHistorialHelper.Cuenta, model.Id,
                EntidadHistorialHelper.AccionCreacion, $"cuenta \"{model.Nombre}\"", null, model.Nombre);
            return true;
        }
        catch { return false; }
    }

    public async Task<bool> Actualizar(Cuenta model)
    {
        try
        {
            var existente = await _db.Cuentas.FirstOrDefaultAsync(x => x.Id == model.Id);
            if (existente == null) return false;

            Normalizar(model);
            var antes = existente.Nombre;
            var saldoInicialAntes = existente.SaldoInicial;

            existente.Nombre = model.Nombre;
            existente.IdTipo = model.IdTipo;
            existente.IdLocal = model.IdLocal;
            existente.Moneda = model.Moneda;
            existente.SaldoInicial = model.SaldoInicial;
            existente.Banco = model.Banco;
            existente.Cbu = model.Cbu;
            existente.Alias = model.Alias;
            existente.Titular = model.Titular;
            existente.Activa = model.Activa;
            existente.PermiteNegativo = model.PermiteNegativo;
            existente.RequiereArqueo = model.RequiereArqueo;
            existente.Color = model.Color;
            existente.Icono = model.Icono;
            existente.Orden = model.Orden;
            await _db.SaveChangesAsync();

            var extra = saldoInicialAntes != existente.SaldoInicial
                ? $"Saldo inicial: {saldoInicialAntes:0.##} → {existente.SaldoInicial:0.##}"
                : null;
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _db, EntidadHistorialHelper.Cuenta, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"cuenta \"{existente.Nombre}\"", antes, existente.Nombre, extra);
            return true;
        }
        catch { return false; }
    }

    private static void Normalizar(Cuenta model)
    {
        model.Nombre = (model.Nombre ?? "").Trim();
        model.Moneda = string.IsNullOrWhiteSpace(model.Moneda) ? "ARS" : model.Moneda.Trim().ToUpperInvariant();
        model.IdTipo = model.IdTipo > 0 ? model.IdTipo : CuentaTipo.Efectivo;
        if (model.IdLocal is <= 0) model.IdLocal = null;
    }

    public Task<List<Cuenta>> Listar(bool soloActivas = false, int? idLocal = null)
    {
        var query = _db.Cuentas.AsNoTracking()
            .Include(c => c.IdTipoNavigation)
            .Include(c => c.IdLocalNavigation)
            .AsQueryable();

        if (soloActivas) query = query.Where(c => c.Activa);
        if (idLocal is > 0) query = query.Where(c => c.IdLocal == idLocal || c.IdLocal == null);

        return query.OrderBy(c => c.Orden).ThenBy(c => c.Nombre).ToListAsync();
    }

    public Task<Cuenta?> BuscarPorNombre(string nombre, int idExcluir)
    {
        var buscado = (nombre ?? "").Trim();
        return _db.Cuentas.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Nombre == buscado && c.Id != idExcluir);
    }

    public async Task<bool> CambiarEstado(int id, bool activa)
    {
        var cuenta = await _db.Cuentas.FirstOrDefaultAsync(c => c.Id == id);
        if (cuenta == null) return false;

        cuenta.Activa = activa;
        await _db.SaveChangesAsync();

        var uid = EntidadHistorialHelper.ResolveUserId();
        if (uid > 0)
        {
            EntidadHistorialHelper.Agregar(
                _db, EntidadHistorialHelper.Cuenta, id,
                EntidadHistorialHelper.AccionModificacion,
                $"Modificación de cuenta \"{cuenta.Nombre}\"",
                activa ? "Cuenta reactivada" : "Cuenta desactivada",
                uid, await EntidadHistorialHelper.NombreUsuarioAsync(_db, uid));
            await _db.SaveChangesAsync();
        }
        return true;
    }

    public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
    {
        try
        {
            var model = await _db.Cuentas.FindAsync(id);
            if (model == null) return DeleteResult.NotFound("la cuenta");

            var nPagos = await _db.ProveedoresPagos.CountAsync(x => x.IdCuenta == id);
            var nCajas = await _db.Cajas.CountAsync(x => x.IdCuenta == id);
            var nTransf = await _db.CajasTransferenciasCuentas
                .CountAsync(x => x.IdCuentaOrigen == id || x.IdCuentaDestino == id);
            var nCheques = await _db.ChequesEmitidos.CountAsync(x => x.IdCuentaDebitar == id);
            var nGastosPagos = await _db.GastosPagos.CountAsync(x => x.IdCuenta == id);
            var nSesiones = await _db.CajasSesiones.CountAsync(x => x.IdCuenta == id);

            var deps = new List<DeleteDependencia>();
            if (nPagos > 0)
                deps.Add(new DeleteDependencia { Entidad = "Pagos a proveedores", Cantidad = nPagos, Detalle = "Pagos registrados con esta cuenta", Cascadeable = false });
            if (nCajas > 0)
                deps.Add(new DeleteDependencia { Entidad = "Movimientos de caja", Cantidad = nCajas, Detalle = "Movimientos de caja asociados", Cascadeable = false });
            if (nTransf > 0)
                deps.Add(new DeleteDependencia { Entidad = "Transferencias", Cantidad = nTransf, Detalle = "Transferencias con esta cuenta como origen/destino", Cascadeable = false });
            if (nCheques > 0)
                deps.Add(new DeleteDependencia { Entidad = "Cheques emitidos", Cantidad = nCheques, Detalle = "Cheques a debitar desde esta cuenta", Cascadeable = false });
            if (nGastosPagos > 0)
                deps.Add(new DeleteDependencia { Entidad = "Pagos de gastos", Cantidad = nGastosPagos, Detalle = "Gastos pagados desde esta cuenta", Cascadeable = false });
            if (nSesiones > 0)
                deps.Add(new DeleteDependencia { Entidad = "Sesiones de caja", Cantidad = nSesiones, Detalle = "Aperturas y cierres de esta cuenta", Cascadeable = false });

            if (deps.Count > 0)
            {
                return DeleteResult.Relacion(
                    "No se puede eliminar la cuenta porque tiene registros financieros asociados. Desactívela para dejar de operarla y conservar el histórico.",
                    deps,
                    cascadeDisponible: false);
            }

            var nombre = model.Nombre;
            _db.Cuentas.Remove(model);
            await _db.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _db, EntidadHistorialHelper.Cuenta, id,
                EntidadHistorialHelper.AccionEliminacion, $"cuenta \"{nombre}\"", nombre, null);
            return DeleteResult.Success("Cuenta eliminada correctamente.");
        }
        catch (Exception ex)
        {
            return DeleteResult.Error(
                "No se pudo eliminar la cuenta: " + (ex.InnerException?.Message ?? ex.Message));
        }
    }

    public async Task<Cuenta?> Obtener(int id)
        => await _db.Cuentas.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);

    public async Task<IQueryable<Cuenta>> ObtenerTodos()
        => await Task.FromResult(_db.Cuentas.AsNoTracking().AsQueryable());
}
