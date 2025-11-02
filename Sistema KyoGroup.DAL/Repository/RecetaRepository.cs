using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.DAL.DataContext;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public class RecetaRepository : IRecetaRepository<Receta>
    {
        private readonly SistemaKyoGroupContext _dbcontext;
        private readonly IHttpContextAccessor _httpContextAccessor;

        // IHttpContextAccessor opcional (si no está registrado, -1 devolverá vacío)
        public RecetaRepository(
            SistemaKyoGroupContext context,
            IHttpContextAccessor httpContextAccessor = null)
        {
            _dbcontext = context;
            _httpContextAccessor = httpContextAccessor;
        }

        /* ============================================================
         * INSERTAR
         * ============================================================ */
        public async Task<bool> Insertar(Receta model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                model.RecetasInsumos ??= new List<RecetasInsumo>();
                model.RecetasSubreceta ??= new List<RecetasSubreceta>();

                foreach (var i in model.RecetasInsumos) i.Id = 0;
                foreach (var s in model.RecetasSubreceta) s.Id = 0;

                var subrecetas = model.RecetasSubreceta.ToList();
                model.RecetasSubreceta = null;

                _dbcontext.Recetas.Add(model);
                await _dbcontext.SaveChangesAsync(); // model.Id

                if (subrecetas.Count > 0)
                {
                    foreach (var sub in subrecetas)
                    {
                        sub.Id = 0;
                        sub.IdReceta = model.Id;
                    }
                    await _dbcontext.RecetasSubrecetas.AddRangeAsync(subrecetas);
                }

                if (model.RecetasInsumos.Count > 0)
                {
                    foreach (var i in model.RecetasInsumos)
                    {
                        i.Id = 0;
                        i.IdReceta = model.Id;
                    }
                    await _dbcontext.RecetasInsumos.AddRangeAsync(model.RecetasInsumos);
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
         * ACTUALIZAR (con DIFF/UPSERT en hijos)
         * ============================================================ */
        public async Task<bool> Actualizar(Receta model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var existente = await _dbcontext.Recetas
                    .Include(x => x.RecetasInsumos)
                    .Include(x => x.RecetasSubreceta)
                    .FirstOrDefaultAsync(x => x.Id == model.Id);

                if (existente == null) return false;

                bool hayCambios = false;

                var entrantesInsumos = (model.RecetasInsumos ?? new List<RecetasInsumo>())
                    .GroupBy(x => x.IdInsumo)
                    .Select(g =>
                    {
                        var last = g.OrderByDescending(z => z.Id).First();
                        return new RecetasInsumo
                        {
                            IdInsumo = g.Key,
                            Cantidad = g.Sum(z => z.Cantidad),
                            SubTotal = g.Sum(z => z.SubTotal),
                            CostoUnitario = last.CostoUnitario
                        };
                    }).ToList();

                var entrantesSub = (model.RecetasSubreceta ?? new List<RecetasSubreceta>())
                    .GroupBy(x => x.IdSubreceta)
                    .Select(g =>
                    {
                        var last = g.OrderByDescending(z => z.Id).First();
                        return new RecetasSubreceta
                        {
                            IdSubreceta = g.Key,
                            Cantidad = g.Sum(z => z.Cantidad),
                            SubTotal = g.Sum(z => z.SubTotal),
                            CostoUnitario = last.CostoUnitario
                        };
                    }).ToList();

                var entry = _dbcontext.Entry(existente);
                entry.CurrentValues.SetValues(model);

                if (entry.Properties.Any(p => p.Metadata.Name == nameof(Receta.IdUsuarioRegistra)))
                    entry.Property(nameof(Receta.IdUsuarioRegistra)).IsModified = false;
                if (entry.Properties.Any(p => p.Metadata.Name == nameof(Receta.FechaRegistra)))
                    entry.Property(nameof(Receta.FechaRegistra)).IsModified = false;

                bool cambiosSimples = entry.Properties.Any(p =>
                    p.IsModified &&
                    p.Metadata.Name != nameof(Receta.IdUsuarioRegistra) &&
                    p.Metadata.Name != nameof(Receta.FechaRegistra));

                hayCambios |= cambiosSimples;

                var duplicadosInsumo = existente.RecetasInsumos
                    .GroupBy(x => x.IdInsumo)
                    .SelectMany(g => g.OrderByDescending(x => x.Id).Skip(1))
                    .ToList();
                if (duplicadosInsumo.Count > 0)
                {
                    _dbcontext.RecetasInsumos.RemoveRange(duplicadosInsumo);
                    hayCambios = true;
                }
                var actualesInsumos = existente.RecetasInsumos
                    .GroupBy(x => x.IdInsumo)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First());

                var duplicadosSub = existente.RecetasSubreceta
                    .GroupBy(x => x.IdSubreceta)
                    .SelectMany(g => g.OrderByDescending(x => x.Id).Skip(1))
                    .ToList();
                if (duplicadosSub.Count > 0)
                {
                    _dbcontext.RecetasSubrecetas.RemoveRange(duplicadosSub);
                    hayCambios = true;
                }
                var actualesSub = existente.RecetasSubreceta
                    .GroupBy(x => x.IdSubreceta)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First());

                foreach (var inc in entrantesInsumos)
                {
                    if (actualesInsumos.TryGetValue(inc.IdInsumo, out var cur))
                    {
                        bool mod = cur.CostoUnitario != inc.CostoUnitario ||
                                   cur.Cantidad != inc.Cantidad ||
                                   cur.SubTotal != inc.SubTotal;

                        if (mod)
                        {
                            cur.CostoUnitario = inc.CostoUnitario;
                            cur.Cantidad = inc.Cantidad;
                            cur.SubTotal = inc.SubTotal;

                            var eCur = _dbcontext.Entry(cur);
                            if (eCur.Properties.Any(p => p.Metadata.Name == nameof(RecetasInsumo.IdUsuarioRegistra)))
                                eCur.Property(nameof(RecetasInsumo.IdUsuarioRegistra)).IsModified = false;
                            if (eCur.Properties.Any(p => p.Metadata.Name == nameof(RecetasInsumo.FechaRegistra)))
                                eCur.Property(nameof(RecetasInsumo.FechaRegistra)).IsModified = false;

                            if ((model.IdUsuarioModifica ?? 0) > 0)
                            {
                                if (eCur.Properties.Any(p => p.Metadata.Name == nameof(RecetasInsumo.IdUsuarioModifica)))
                                    cur.IdUsuarioModifica = model.IdUsuarioModifica;
                                if (eCur.Properties.Any(p => p.Metadata.Name == nameof(RecetasInsumo.FechaModifica)))
                                    cur.FechaModifica = DateTime.Now;
                            }

                            hayCambios = true;
                        }
                    }
                    else
                    {
                        var nuevo = new RecetasInsumo
                        {
                            IdReceta = existente.Id,
                            IdInsumo = inc.IdInsumo,
                            CostoUnitario = inc.CostoUnitario,
                            Cantidad = inc.Cantidad,
                            SubTotal = inc.SubTotal,
                        };
                        nuevo.IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra;
                        nuevo.FechaRegistra = DateTime.Now;

                        await _dbcontext.RecetasInsumos.AddAsync(nuevo);
                        hayCambios = true;
                    }
                }

                var idsInsumoEntrantes = new HashSet<int>(entrantesInsumos.Select(x => x.IdInsumo));
                var bajasInsumos = existente.RecetasInsumos.Where(x => !idsInsumoEntrantes.Contains(x.IdInsumo)).ToList();
                if (bajasInsumos.Count > 0)
                {
                    _dbcontext.RecetasInsumos.RemoveRange(bajasInsumos);
                    hayCambios = true;
                }

                foreach (var inc in entrantesSub)
                {
                    if (actualesSub.TryGetValue(inc.IdSubreceta, out var cur))
                    {
                        bool mod = cur.CostoUnitario != inc.CostoUnitario ||
                                   cur.Cantidad != inc.Cantidad ||
                                   cur.SubTotal != inc.SubTotal;

                        if (mod)
                        {
                            cur.CostoUnitario = inc.CostoUnitario;
                            cur.Cantidad = inc.Cantidad;
                            cur.SubTotal = inc.SubTotal;

                            var eCur = _dbcontext.Entry(cur);
                            if (eCur.Properties.Any(p => p.Metadata.Name == nameof(RecetasSubreceta.IdUsuarioRegistra)))
                                eCur.Property(nameof(RecetasSubreceta.IdUsuarioRegistra)).IsModified = false;
                            if (eCur.Properties.Any(p => p.Metadata.Name == nameof(RecetasSubreceta.FechaRegistra)))
                                eCur.Property(nameof(RecetasSubreceta.FechaRegistra)).IsModified = false;

                            if ((model.IdUsuarioModifica ?? 0) > 0)
                            {
                                if (eCur.Properties.Any(p => p.Metadata.Name == nameof(RecetasSubreceta.IdUsuarioModifica)))
                                    cur.IdUsuarioModifica = model.IdUsuarioModifica;
                                if (eCur.Properties.Any(p => p.Metadata.Name == nameof(RecetasSubreceta.FechaModifica)))
                                    cur.FechaModifica = DateTime.Now;
                            }

                            hayCambios = true;
                        }
                    }
                    else
                    {
                        var nueva = new RecetasSubreceta
                        {
                            IdReceta = existente.Id,
                            IdSubreceta = inc.IdSubreceta,
                            CostoUnitario = inc.CostoUnitario,
                            Cantidad = inc.Cantidad,
                            SubTotal = inc.SubTotal,
                        };
                        nueva.IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra;
                        nueva.FechaRegistra = DateTime.Now;

                        await _dbcontext.RecetasSubrecetas.AddAsync(nueva);
                        hayCambios = true;
                    }
                }

                var idsSubEntrantes = new HashSet<int>(entrantesSub.Select(x => x.IdSubreceta));
                var bajasSub = existente.RecetasSubreceta.Where(x => !idsSubEntrantes.Contains(x.IdSubreceta)).ToList();
                if (bajasSub.Count > 0)
                {
                    _dbcontext.RecetasSubrecetas.RemoveRange(bajasSub);
                    hayCambios = true;
                }

                if (hayCambios && (model.IdUsuarioModifica ?? 0) > 0)
                {
                    if (entry.Properties.Any(p => p.Metadata.Name == nameof(Receta.IdUsuarioModifica)))
                        existente.IdUsuarioModifica = model.IdUsuarioModifica;
                    if (entry.Properties.Any(p => p.Metadata.Name == nameof(Receta.FechaModifica)))
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
         * ============================================================ */
        public async Task<bool> Eliminar(int id)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var subrecetas = await _dbcontext.RecetasSubrecetas.Where(s => s.IdReceta == id).ToListAsync();
                if (subrecetas.Count > 0) _dbcontext.RecetasSubrecetas.RemoveRange(subrecetas);

                var insumos = await _dbcontext.RecetasInsumos.Where(i => i.IdReceta == id).ToListAsync();
                if (insumos.Count > 0) _dbcontext.RecetasInsumos.RemoveRange(insumos);

                var cab = await _dbcontext.Recetas.FirstOrDefaultAsync(c => c.Id == id);
                if (cab == null) { await tx.RollbackAsync(); return false; }

                _dbcontext.Recetas.Remove(cab);

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
         * OBTENER
         * ============================================================ */
        public async Task<Receta> Obtener(int id)
        {
            try
            {
                var model = await _dbcontext.Recetas
                    .Include(p => p.RecetasInsumos)
                        .ThenInclude(p => p.IdInsumoNavigation)
                    .Include(p => p.RecetasSubreceta)
                        .ThenInclude(p => p.IdSubrecetaNavigation)
                    .FirstOrDefaultAsync(p => p.Id == id);

                return model;
            }
            catch
            {
                return null;
            }
        }

        public async Task<IQueryable<Receta>> ObtenerTodos()
        {
            return await Task.FromResult(_dbcontext.Recetas.AsNoTracking());
        }

        /* ============================================================
         * OBTENER TODOS POR UNIDAD (con -1 = solo las permitidas)
         * ============================================================ */
        public async Task<IQueryable<Receta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId)
        {
            try
            {
                // Base: excluir recetas sin unidad (null o 0)
                var baseQuery = _dbcontext.Recetas
                    .AsNoTracking()
                    .Where(r => r.IdUnidadNegocio > 0);

                // Unidad puntual: mantener comportamiento original
                if (idUnidadNegocio != -1)
                    return await Task.FromResult(baseQuery.Where(r => r.IdUnidadNegocio == idUnidadNegocio));


                // Ids de unidades asignadas al usuario
                var idsPermitidos = await _dbcontext.UsuariosUnidadesNegocios
                    .AsNoTracking()
                    .Where(x => x.IdUsuario == userId)
                    .Select(x => x.IdUnidadNegocio)
                    .Distinct()
                    .ToListAsync();

                if (idsPermitidos == null || idsPermitidos.Count == 0)
                    return Enumerable.Empty<Receta>().AsQueryable();

                var filtrado = baseQuery.Where(r => idsPermitidos.Contains(r.IdUnidadNegocio));
                return await Task.FromResult(filtrado);
            }
            catch
            {
                return Enumerable.Empty<Receta>().AsQueryable();
            }
        }

        /* ============================================================
         * INSUMOS
         * ============================================================ */
        public async Task<List<RecetasInsumo>> ObtenerInsumos(int idReceta)
        {
            try
            {
                return await _dbcontext.RecetasInsumos
                    .Include(c => c.IdRecetaNavigation)
                    .Include(c => c.IdInsumoNavigation)
                    .Where(c => c.IdReceta == idReceta)
                    .ToListAsync();
            }
            catch
            {
                return null;
            }
        }

        public Task<bool> InsertarInsumos(List<RecetasInsumo> insumos)
            => throw new NotImplementedException();

        public Task<bool> ActualizarInsumos(List<RecetasInsumo> insumos)
            => throw new NotImplementedException();

        /* ============================================================
         * Helpers
         * ============================================================ */
        private int? GetCurrentUserId()
        {
            try
            {
                var user = _httpContextAccessor?.HttpContext?.User;
                if (user?.Identity?.IsAuthenticated != true) return null;

                // Busca en varios claim types comunes
                var idStr =
                    user.FindFirst("Id")?.Value ??
                    user.FindFirst("id")?.Value ??
                    user.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
                    user.FindFirst("sub")?.Value;

                if (int.TryParse(idStr, out var id)) return id;
                return null;
            }
            catch { return null; }
        }
    }
}
