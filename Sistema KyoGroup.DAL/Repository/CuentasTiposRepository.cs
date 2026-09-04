using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

public interface ICuentasTiposRepository
{
    Task<List<CuentasTipo>> Listar();
    Task<CuentasTipo?> Obtener(int id);
    Task<CuentasTipo?> BuscarPorNombre(string nombre, int idExcluir);
    Task<bool> Insertar(CuentasTipo model);
    Task<bool> Actualizar(CuentasTipo model);
    Task<DeleteResult> Eliminar(int id);
}

public class CuentasTiposRepository : ICuentasTiposRepository
{
    private readonly SistemaKyoGroupContext _db;

    public CuentasTiposRepository(SistemaKyoGroupContext context)
    {
        _db = context;
    }

    public Task<List<CuentasTipo>> Listar()
        => _db.CuentasTipos.AsNoTracking().OrderBy(t => t.Id).ToListAsync();

    public Task<CuentasTipo?> Obtener(int id)
        => _db.CuentasTipos.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);

    public Task<CuentasTipo?> BuscarPorNombre(string nombre, int idExcluir)
    {
        var buscado = (nombre ?? "").Trim();
        return _db.CuentasTipos.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Nombre == buscado && t.Id != idExcluir);
    }

    public async Task<bool> Insertar(CuentasTipo model)
    {
        model.Nombre = (model.Nombre ?? "").Trim();
        if (model.Nombre.Length == 0) return false;

        _db.CuentasTipos.Add(model);
        await _db.SaveChangesAsync();
        await EntidadHistorialHelper.LogNombreCatalogoAsync(
            _db, EntidadHistorialHelper.CuentaTipo, model.Id,
            EntidadHistorialHelper.AccionCreacion, $"tipo de cuenta \"{model.Nombre}\"", null, model.Nombre);
        return true;
    }

    public async Task<bool> Actualizar(CuentasTipo model)
    {
        var existente = await _db.CuentasTipos.FirstOrDefaultAsync(t => t.Id == model.Id);
        if (existente == null) return false;

        var antes = existente.Nombre;
        existente.Nombre = (model.Nombre ?? "").Trim();
        existente.EsEfectivo = model.EsEfectivo;
        await _db.SaveChangesAsync();

        await EntidadHistorialHelper.LogNombreCatalogoAsync(
            _db, EntidadHistorialHelper.CuentaTipo, model.Id,
            EntidadHistorialHelper.AccionModificacion, $"tipo de cuenta \"{existente.Nombre}\"", antes, existente.Nombre);
        return true;
    }

    public async Task<DeleteResult> Eliminar(int id)
    {
        try
        {
            var model = await _db.CuentasTipos.FindAsync(id);
            if (model == null) return DeleteResult.NotFound("el tipo de cuenta");

            var nCuentas = await _db.Cuentas.CountAsync(c => c.IdTipo == id);
            if (nCuentas > 0)
            {
                return DeleteResult.Relacion(
                    "No se puede eliminar el tipo porque hay cuentas que lo usan.",
                    new[]
                    {
                        new DeleteDependencia
                        {
                            Entidad = "Cuentas",
                            Cantidad = nCuentas,
                            Detalle = "Cuentas de fondos de este tipo",
                            Cascadeable = false
                        }
                    },
                    cascadeDisponible: false);
            }

            var nombre = model.Nombre;
            _db.CuentasTipos.Remove(model);
            await _db.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _db, EntidadHistorialHelper.CuentaTipo, id,
                EntidadHistorialHelper.AccionEliminacion, $"tipo de cuenta \"{nombre}\"", nombre, null);
            return DeleteResult.Success("Tipo de cuenta eliminado correctamente.");
        }
        catch (Exception ex)
        {
            return DeleteResult.Error("No se pudo eliminar el tipo de cuenta: " + (ex.InnerException?.Message ?? ex.Message));
        }
    }
}
