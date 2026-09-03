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
            var antes = existente.Nombre;
            _db.Entry(existente).CurrentValues.SetValues(model);
            await _db.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _db, EntidadHistorialHelper.Cuenta, model.Id,
                EntidadHistorialHelper.AccionModificacion, $"cuenta \"{existente.Nombre}\"", antes, existente.Nombre);
            return true;
        }
        catch { return false; }
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

            var deps = new List<DeleteDependencia>();
            if (nPagos > 0)
                deps.Add(new DeleteDependencia { Entidad = "Pagos a proveedores", Cantidad = nPagos, Detalle = "Pagos registrados con esta cuenta", Cascadeable = false });
            if (nCajas > 0)
                deps.Add(new DeleteDependencia { Entidad = "Movimientos de caja", Cantidad = nCajas, Detalle = "Movimientos de caja asociados", Cascadeable = false });
            if (nTransf > 0)
                deps.Add(new DeleteDependencia { Entidad = "Transferencias", Cantidad = nTransf, Detalle = "Transferencias con esta cuenta como origen/destino", Cascadeable = false });
            if (nCheques > 0)
                deps.Add(new DeleteDependencia { Entidad = "Cheques emitidos", Cantidad = nCheques, Detalle = "Cheques a debitar desde esta cuenta", Cascadeable = false });

            if (deps.Count > 0)
            {
                return DeleteResult.Relacion(
                    "No se puede eliminar la cuenta porque tiene registros financieros asociados. Elimine o reasigne estos movimientos primero.",
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
