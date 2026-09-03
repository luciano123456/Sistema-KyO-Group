using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System.Globalization;
using System.Text;

namespace SistemaKyoGroup.DAL.Repository;

public class RubrosRepository : IRubrosRepository<Rubro>
{
    private readonly SistemaKyoGroupContext _db;

    public RubrosRepository(SistemaKyoGroupContext context)
    {
        _db = context;
    }

    public static string NormalizarNombre(string? nombre)
    {
        if (string.IsNullOrWhiteSpace(nombre)) return "";
        var s = nombre.Trim();
        s = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).ToUpperInvariant();
    }

    public async Task<bool> Actualizar(Rubro model)
    {
        var existente = await _db.Rubros.FirstOrDefaultAsync(x => x.Id == model.Id);
        if (existente == null) return false;
        var antes = existente.Nombre;
        existente.Nombre = model.Nombre?.Trim() ?? "";
        await _db.SaveChangesAsync();
        await EntidadHistorialHelper.LogNombreCatalogoAsync(
            _db, EntidadHistorialHelper.Rubro, model.Id,
            EntidadHistorialHelper.AccionModificacion, $"rubro \"{existente.Nombre}\"", antes, existente.Nombre);
        return true;
    }

    public async Task<bool> Eliminar(int id)
    {
        var model = await _db.Rubros.FirstOrDefaultAsync(c => c.Id == id);
        if (model == null) return false;
        var nombre = model.Nombre;
        _db.Rubros.Remove(model);
        await _db.SaveChangesAsync();
        await EntidadHistorialHelper.LogNombreCatalogoAsync(
            _db, EntidadHistorialHelper.Rubro, id,
            EntidadHistorialHelper.AccionEliminacion, $"rubro \"{nombre}\"", nombre, null);
        return true;
    }

    public async Task<bool> Insertar(Rubro model)
    {
        model.Nombre = model.Nombre?.Trim() ?? "";
        if (model.Nombre.Length == 0) return false;
        _db.Rubros.Add(model);
        await _db.SaveChangesAsync();
        await EntidadHistorialHelper.LogNombreCatalogoAsync(
            _db, EntidadHistorialHelper.Rubro, model.Id,
            EntidadHistorialHelper.AccionCreacion, $"rubro \"{model.Nombre}\"", null, model.Nombre);
        return true;
    }

    public async Task<Rubro> Obtener(int id)
        => await _db.Rubros.FindAsync(id);

    public Task<IQueryable<Rubro>> ObtenerTodos()
        => Task.FromResult(_db.Rubros.AsQueryable());

    public Task<List<Rubro>> ListarAsync()
        => _db.Rubros.AsNoTracking().OrderBy(r => r.Nombre).ToListAsync();

    public async Task<List<string>> ObtenerNombresNormalizadosAsync()
    {
        var nombres = await _db.Rubros.AsNoTracking().Select(r => r.Nombre).ToListAsync();
        return nombres.Select(NormalizarNombre).Where(n => n.Length > 0).Distinct().ToList();
    }

    public async Task<List<Rubro>> CrearSiNoExistenAsync(IEnumerable<string> nombres)
    {
        var existentes = await _db.Rubros.ToListAsync();
        var map = existentes
            .GroupBy(r => NormalizarNombre(r.Nombre))
            .Where(g => g.Key.Length > 0)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

        var creados = new List<Rubro>();
        foreach (var raw in nombres
            .Select(n => (n ?? "").Trim())
            .Where(n => n.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var key = NormalizarNombre(raw);
            if (key.Length == 0 || map.ContainsKey(key)) continue;
            var rubro = new Rubro { Nombre = raw };
            _db.Rubros.Add(rubro);
            creados.Add(rubro);
            map[key] = rubro;
        }

        if (creados.Count > 0)
        {
            await _db.SaveChangesAsync();
            foreach (var r in creados)
            {
                await EntidadHistorialHelper.LogNombreCatalogoAsync(
                    _db, EntidadHistorialHelper.Rubro, r.Id,
                    EntidadHistorialHelper.AccionCreacion, $"rubro \"{r.Nombre}\"", null, r.Nombre);
            }
        }

        return creados;
    }
}
