using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

public interface IMediosPagoRepository
{
    Task<List<MediosPago>> Listar(bool soloActivos = false);
    Task<MediosPago?> Obtener(int id);
    Task<MediosPago?> BuscarPorNombre(string nombre, int idExcluir);
    Task<bool> Insertar(MediosPago model);
    Task<bool> Actualizar(MediosPago model);
    Task<DeleteResult> Eliminar(int id);
}

public class MediosPagoRepository : IMediosPagoRepository
{
    private readonly SistemaKyoGroupContext _db;

    public MediosPagoRepository(SistemaKyoGroupContext context)
    {
        _db = context;
    }

    public Task<List<MediosPago>> Listar(bool soloActivos = false)
    {
        var query = _db.MediosPagos.AsNoTracking()
            .Include(m => m.IdCuentaDefectoNavigation)
            .AsQueryable();
        if (soloActivos) query = query.Where(m => m.Activo);

        return query.OrderBy(m => m.Orden).ThenBy(m => m.Nombre).ToListAsync();
    }

    public Task<MediosPago?> Obtener(int id)
        => _db.MediosPagos.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);

    public Task<MediosPago?> BuscarPorNombre(string nombre, int idExcluir)
    {
        var buscado = (nombre ?? "").Trim();
        return _db.MediosPagos.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Nombre == buscado && m.Id != idExcluir);
    }

    public async Task<bool> Insertar(MediosPago model)
    {
        model.Nombre = (model.Nombre ?? "").Trim();
        if (model.Nombre.Length == 0) return false;
        if (model.IdCuentaDefecto is <= 0) model.IdCuentaDefecto = null;

        _db.MediosPagos.Add(model);
        await _db.SaveChangesAsync();
        await EntidadHistorialHelper.LogNombreCatalogoAsync(
            _db, EntidadHistorialHelper.MedioPago, model.Id,
            EntidadHistorialHelper.AccionCreacion, $"medio de pago \"{model.Nombre}\"", null, model.Nombre);
        return true;
    }

    public async Task<bool> Actualizar(MediosPago model)
    {
        var existente = await _db.MediosPagos.FirstOrDefaultAsync(m => m.Id == model.Id);
        if (existente == null) return false;

        var antes = existente.Nombre;
        existente.Nombre = (model.Nombre ?? "").Trim();
        existente.IdCuentaDefecto = model.IdCuentaDefecto is > 0 ? model.IdCuentaDefecto : null;
        existente.AfectaCaja = model.AfectaCaja;
        existente.Activo = model.Activo;
        existente.Orden = model.Orden;
        await _db.SaveChangesAsync();

        await EntidadHistorialHelper.LogNombreCatalogoAsync(
            _db, EntidadHistorialHelper.MedioPago, model.Id,
            EntidadHistorialHelper.AccionModificacion, $"medio de pago \"{existente.Nombre}\"", antes, existente.Nombre);
        return true;
    }

    public async Task<DeleteResult> Eliminar(int id)
    {
        try
        {
            var model = await _db.MediosPagos.FindAsync(id);
            if (model == null) return DeleteResult.NotFound("el medio de pago");

            var nCajas = await _db.Cajas.CountAsync(x => x.IdMedioPago == id);
            var nGastos = await _db.GastosPagos.CountAsync(x => x.IdMedioPago == id);
            var nPagos = await _db.ProveedoresPagos.CountAsync(x => x.IdMedioPago == id);

            var deps = new List<DeleteDependencia>();
            if (nCajas > 0)
                deps.Add(new DeleteDependencia { Entidad = "Movimientos de caja", Cantidad = nCajas, Detalle = "Asientos registrados con este medio", Cascadeable = false });
            if (nGastos > 0)
                deps.Add(new DeleteDependencia { Entidad = "Pagos de gastos", Cantidad = nGastos, Detalle = "Pagos de gastos con este medio", Cascadeable = false });
            if (nPagos > 0)
                deps.Add(new DeleteDependencia { Entidad = "Pagos a proveedores", Cantidad = nPagos, Detalle = "Pagos a proveedores con este medio", Cascadeable = false });

            if (deps.Count > 0)
            {
                return DeleteResult.Relacion(
                    "No se puede eliminar el medio de pago porque tiene movimientos asociados. Desactívelo para dejar de ofrecerlo.",
                    deps,
                    cascadeDisponible: false);
            }

            var nombre = model.Nombre;
            _db.MediosPagos.Remove(model);
            await _db.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _db, EntidadHistorialHelper.MedioPago, id,
                EntidadHistorialHelper.AccionEliminacion, $"medio de pago \"{nombre}\"", nombre, null);
            return DeleteResult.Success("Medio de pago eliminado correctamente.");
        }
        catch (Exception ex)
        {
            return DeleteResult.Error("No se pudo eliminar el medio de pago: " + (ex.InnerException?.Message ?? ex.Message));
        }
    }
}
