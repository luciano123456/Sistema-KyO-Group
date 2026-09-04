using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

public interface IGastosCategoriasRepository
{
    Task<List<GastosCategoria>> Listar(bool soloActivas = false);
    Task<GastosCategoria?> Obtener(int id);
    Task<GastosCategoria?> BuscarPorNombre(string nombre, int idExcluir);
    Task<bool> Insertar(GastosCategoria model);
    Task<bool> Actualizar(GastosCategoria model);
    Task<DeleteResult> Eliminar(int id);
}

public class GastosCategoriasRepository : IGastosCategoriasRepository
{
    private readonly SistemaKyoGroupContext _db;

    public GastosCategoriasRepository(SistemaKyoGroupContext context)
    {
        _db = context;
    }

    public Task<List<GastosCategoria>> Listar(bool soloActivas = false)
    {
        var query = _db.GastosCategorias.AsNoTracking()
            .Include(c => c.IdPadreNavigation)
            .AsQueryable();
        if (soloActivas) query = query.Where(c => c.Activa);

        return query.OrderBy(c => c.Orden).ThenBy(c => c.Nombre).ToListAsync();
    }

    public Task<GastosCategoria?> Obtener(int id)
        => _db.GastosCategorias.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);

    public Task<GastosCategoria?> BuscarPorNombre(string nombre, int idExcluir)
    {
        var buscado = (nombre ?? "").Trim();
        return _db.GastosCategorias.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Nombre == buscado && c.Id != idExcluir);
    }

    public async Task<bool> Insertar(GastosCategoria model)
    {
        model.Nombre = (model.Nombre ?? "").Trim();
        if (model.Nombre.Length == 0) return false;
        if (model.IdPadre is <= 0) model.IdPadre = null;

        _db.GastosCategorias.Add(model);
        await _db.SaveChangesAsync();
        await EntidadHistorialHelper.LogNombreCatalogoAsync(
            _db, EntidadHistorialHelper.CategoriaGasto, model.Id,
            EntidadHistorialHelper.AccionCreacion, $"categoría de gasto \"{model.Nombre}\"", null, model.Nombre);
        return true;
    }

    public async Task<bool> Actualizar(GastosCategoria model)
    {
        var existente = await _db.GastosCategorias.FirstOrDefaultAsync(c => c.Id == model.Id);
        if (existente == null) return false;

        // Una categoría no puede ser su propia padre ni colgarse de una hija.
        var idPadre = model.IdPadre is > 0 ? model.IdPadre : null;
        if (idPadre == model.Id || await EsDescendiente(model.Id, idPadre))
            idPadre = existente.IdPadre;

        var antes = existente.Nombre;
        existente.Nombre = (model.Nombre ?? "").Trim();
        existente.IdPadre = idPadre;
        existente.Color = model.Color;
        existente.Icono = model.Icono;
        existente.Activa = model.Activa;
        existente.Orden = model.Orden;
        await _db.SaveChangesAsync();

        await EntidadHistorialHelper.LogNombreCatalogoAsync(
            _db, EntidadHistorialHelper.CategoriaGasto, model.Id,
            EntidadHistorialHelper.AccionModificacion, $"categoría de gasto \"{existente.Nombre}\"", antes, existente.Nombre);
        return true;
    }

    private async Task<bool> EsDescendiente(int idCategoria, int? idCandidatoPadre)
    {
        var actual = idCandidatoPadre;
        var saltos = 0;
        while (actual is > 0 && saltos++ < 20)
        {
            if (actual == idCategoria) return true;
            actual = await _db.GastosCategorias.AsNoTracking()
                .Where(c => c.Id == actual)
                .Select(c => c.IdPadre)
                .FirstOrDefaultAsync();
        }
        return false;
    }

    public async Task<DeleteResult> Eliminar(int id)
    {
        try
        {
            var model = await _db.GastosCategorias.FindAsync(id);
            if (model == null) return DeleteResult.NotFound("la categoría");

            var nGastos = await _db.Gastos.CountAsync(g => g.IdCategoria == id);
            var nHijas = await _db.GastosCategorias.CountAsync(c => c.IdPadre == id);

            var deps = new List<DeleteDependencia>();
            if (nGastos > 0)
                deps.Add(new DeleteDependencia { Entidad = "Gastos", Cantidad = nGastos, Detalle = "Gastos clasificados en esta categoría", Cascadeable = false });
            if (nHijas > 0)
                deps.Add(new DeleteDependencia { Entidad = "Subcategorías", Cantidad = nHijas, Detalle = "Categorías hijas que dependen de esta", Cascadeable = false });

            if (deps.Count > 0)
            {
                return DeleteResult.Relacion(
                    "No se puede eliminar la categoría porque está en uso. Reclasifique los gastos o desactívela.",
                    deps,
                    cascadeDisponible: false);
            }

            var nombre = model.Nombre;
            _db.GastosCategorias.Remove(model);
            await _db.SaveChangesAsync();
            await EntidadHistorialHelper.LogNombreCatalogoAsync(
                _db, EntidadHistorialHelper.CategoriaGasto, id,
                EntidadHistorialHelper.AccionEliminacion, $"categoría de gasto \"{nombre}\"", nombre, null);
            return DeleteResult.Success("Categoría eliminada correctamente.");
        }
        catch (Exception ex)
        {
            return DeleteResult.Error("No se pudo eliminar la categoría: " + (ex.InnerException?.Message ?? ex.Message));
        }
    }
}
