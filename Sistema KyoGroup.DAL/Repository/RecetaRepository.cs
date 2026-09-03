using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public class RecetaRepository : IRecetaRepository<Receta>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public RecetaRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        /* ============================================================
         * INSERTAR
         *  - Detach hijos ANTES del Add para evitar doble insert por cascade
         * ============================================================ */
        public async Task<(bool ok, string mensaje)> Insertar(Receta model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                if (model.IdUsuarioRegistra <= 0)
                    return (false, "Usuario no autenticado. Volvé a iniciar sesión.");

                if (model.IdUnidadNegocio <= 0 || model.IdCategoria <= 0 || model.IdUnidadMedida <= 0)
                    return (false, "Completá unidad de negocio, categoría y unidad de medida.");

                if (string.IsNullOrWhiteSpace(model.Descripcion))
                    return (false, "La descripción es obligatoria.");

                var insumos = (model.RecetasInsumos ?? new List<RecetasInsumo>()).ToList();
                var subRecetas = (model.RecetasSubReceta ?? new List<RecetasSubReceta>()).ToList();

                foreach (var i in insumos) i.Id = 0;
                foreach (var s in subRecetas) s.Id = 0;

                // Evitar doble insert por cascade: limpiar navegaciones antes del Add
                model.RecetasInsumos = new List<RecetasInsumo>();
                model.RecetasSubReceta = new List<RecetasSubReceta>();
                model.RecetasUnidadesNegocios = new List<RecetasUnidadesNegocio>();
                model.IdUsuarioRegistraNavigation = null!;
                model.IdUsuarioModificaNavigation = null;
                model.IdCategoriaNavigation = null!;
                model.IdUnidadMedidaNavigation = null!;
                model.IdUnidadNegocioNavigation = null!;

                _dbcontext.Recetas.Add(model);
                await _dbcontext.SaveChangesAsync();

                if (subRecetas.Count > 0)
                {
                    foreach (var s in subRecetas)
                    {
                        s.IdReceta = model.Id;
                        s.IdUsuarioRegistra = model.IdUsuarioRegistra;
                        s.FechaRegistra = DateTime.Now;
                        s.IdRecetaNavigation = null!;
                        s.IdSubRecetaNavigation = null!;
                        s.IdUsuarioRegistraNavigation = null!;
                        s.IdUsuarioModificaNavigation = null;
                    }
                    _dbcontext.RecetasSubRecetas.AddRange(subRecetas);
                }

                if (insumos.Count > 0)
                {
                    foreach (var i in insumos)
                    {
                        i.IdReceta = model.Id;
                        i.IdUsuarioRegistra = model.IdUsuarioRegistra > 0 ? model.IdUsuarioRegistra : i.IdUsuarioRegistra;
                        if (i.FechaRegistra == default) i.FechaRegistra = DateTime.Now;
                        i.IdInsumoNavigation = null!;
                        i.IdRecetaNavigation = null!;
                        i.IdUsuarioRegistraNavigation = null!;
                        i.IdUsuarioModificaNavigation = null;
                    }
                    _dbcontext.RecetasInsumos.AddRange(insumos);
                }

                var usuarioNombre = await _dbcontext.Usuarios.AsNoTracking()
                    .Where(u => u.Id == model.IdUsuarioRegistra)
                    .Select(u => u.Usuario)
                    .FirstOrDefaultAsync();

                RecetaHistorialHelper.Agregar(
                    _dbcontext,
                    RecetaHistorialHelper.TipoReceta,
                    model.Id,
                    "Creacion",
                    $"Alta de receta \"{model.Descripcion}\" (SKU {model.Sku})",
                    $"Insumos: {insumos.Count}. Subrecetas: {subRecetas.Count}. Costo unitario: {model.CostoUnitario:0.##}. Rendimiento: {model.Rendimiento:0.##}.",
                    model.IdUsuarioRegistra,
                    usuarioNombre);

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return (true, "Receta creada correctamente.");
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                var msg = ex.InnerException?.Message ?? ex.Message;
                return (false, "No se pudo crear la Receta: " + msg);
            }
        }

        /* ============================================================
         * ACTUALIZAR (con DIFF/UPSERT en hijos + historial)
         * ============================================================ */
        public async Task<(bool ok, string mensaje)> Actualizar(Receta model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var existente = await _dbcontext.Recetas
                    .Include(x => x.RecetasInsumos)
                    .Include(x => x.RecetasSubReceta)
                    .FirstOrDefaultAsync(x => x.Id == model.Id);

                if (existente == null)
                    return (false, "Receta no encontrada.");

                var cambios = new List<string>();
                void Diff(string campo, object? antes, object? despues)
                {
                    if (RecetaHistorialHelper.ValoresIguales(antes, despues)) return;
                    cambios.Add($"{campo}: {RecetaHistorialHelper.FormatearValor(antes)} → {RecetaHistorialHelper.FormatearValor(despues)}");
                }

                Diff("Descripción", existente.Descripcion, model.Descripcion);
                Diff("SKU", existente.Sku, model.Sku);
                Diff("Categoría",
                    await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "CategoriaReceta", existente.IdCategoria),
                    await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "CategoriaReceta", model.IdCategoria));
                Diff("Unidad medida",
                    await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadMedida", existente.IdUnidadMedida),
                    await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadMedida", model.IdUnidadMedida));
                Diff("UN",
                    await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadNegocio", existente.IdUnidadNegocio),
                    await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "UnidadNegocio", model.IdUnidadNegocio));
                Diff("Rendimiento", existente.Rendimiento, model.Rendimiento);
                Diff("Costo unitario", existente.CostoUnitario, model.CostoUnitario);
                Diff("Costo porción", existente.CostoPorcion, model.CostoPorcion);

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

                var entrantesSub = (model.RecetasSubReceta ?? new List<RecetasSubReceta>())
                    .GroupBy(x => x.IdSubReceta)
                    .Select(g =>
                    {
                        var last = g.OrderByDescending(z => z.Id).First();
                        return new RecetasSubReceta
                        {
                            IdSubReceta = g.Key,
                            Cantidad = g.Sum(z => z.Cantidad),
                            SubTotal = g.Sum(z => z.SubTotal ?? 0),
                            CostoUnitario = last.CostoUnitario
                        };
                    }).ToList();

                var entry = _dbcontext.Entry(existente);
                entry.CurrentValues.SetValues(model);

                entry.Property(nameof(Receta.IdUsuarioRegistra)).IsModified = false;
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
                    cambios.Add($"Duplicados de insumos eliminados ({duplicadosInsumo.Count})");
                }
                var actualesInsumos = existente.RecetasInsumos
                    .GroupBy(x => x.IdInsumo)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First());

                var duplicadosSub = existente.RecetasSubReceta
                    .GroupBy(x => x.IdSubReceta)
                    .SelectMany(g => g.OrderByDescending(x => x.Id).Skip(1))
                    .ToList();
                if (duplicadosSub.Count > 0)
                {
                    _dbcontext.RecetasSubRecetas.RemoveRange(duplicadosSub);
                    hayCambios = true;
                    cambios.Add($"Duplicados de subrecetas eliminados ({duplicadosSub.Count})");
                }
                var actualesSub = existente.RecetasSubReceta
                    .GroupBy(x => x.IdSubReceta)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First());

                foreach (var inc in entrantesInsumos)
                {
                    if (actualesInsumos.TryGetValue(inc.IdInsumo, out var cur))
                    {
                        if (cur.CostoUnitario != inc.CostoUnitario ||
                            cur.Cantidad != inc.Cantidad ||
                            cur.SubTotal != inc.SubTotal)
                        {
                            cur.CostoUnitario = inc.CostoUnitario;
                            cur.Cantidad = inc.Cantidad;
                            cur.SubTotal = inc.SubTotal;
                            cur.IdUsuarioModifica = model.IdUsuarioModifica;
                            cur.FechaModifica = DateTime.Now;
                            hayCambios = true;
                            cambios.Add($"Insumo Id {inc.IdInsumo} actualizado (cant {inc.Cantidad}, costo {inc.CostoUnitario:0.##})");
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
                            IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra,
                            FechaRegistra = DateTime.Now
                        };
                        await _dbcontext.RecetasInsumos.AddAsync(nuevo);
                        hayCambios = true;
                        cambios.Add($"Insumo Id {inc.IdInsumo} agregado");
                    }
                }

                var idsInsumoEntrantes = new HashSet<int>(entrantesInsumos.Select(x => x.IdInsumo));
                var bajasInsumos = existente.RecetasInsumos.Where(x => !idsInsumoEntrantes.Contains(x.IdInsumo)).ToList();
                if (bajasInsumos.Count > 0)
                {
                    foreach (var b in bajasInsumos)
                        cambios.Add($"Insumo quitado (Id {b.IdInsumo})");
                    _dbcontext.RecetasInsumos.RemoveRange(bajasInsumos);
                    hayCambios = true;
                }

                foreach (var inc in entrantesSub)
                {
                    if (actualesSub.TryGetValue(inc.IdSubReceta, out var cur))
                    {
                        if (cur.CostoUnitario != inc.CostoUnitario ||
                            cur.Cantidad != inc.Cantidad ||
                            cur.SubTotal != inc.SubTotal)
                        {
                            cur.CostoUnitario = inc.CostoUnitario;
                            cur.Cantidad = inc.Cantidad;
                            cur.SubTotal = inc.SubTotal;
                            cur.IdUsuarioModifica = model.IdUsuarioModifica;
                            cur.FechaModifica = DateTime.Now;
                            hayCambios = true;
                            cambios.Add($"Subreceta Id {inc.IdSubReceta} actualizada");
                        }
                    }
                    else
                    {
                        var nueva = new RecetasSubReceta
                        {
                            IdReceta = existente.Id,
                            IdSubReceta = inc.IdSubReceta,
                            CostoUnitario = inc.CostoUnitario,
                            Cantidad = inc.Cantidad,
                            SubTotal = inc.SubTotal,
                            IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra,
                            FechaRegistra = DateTime.Now
                        };
                        await _dbcontext.RecetasSubRecetas.AddAsync(nueva);
                        hayCambios = true;
                        cambios.Add($"Subreceta Id {inc.IdSubReceta} agregada");
                    }
                }

                var idsSubEntrantes = new HashSet<int>(entrantesSub.Select(x => x.IdSubReceta));
                var bajasSub = existente.RecetasSubReceta.Where(x => !idsSubEntrantes.Contains(x.IdSubReceta)).ToList();
                if (bajasSub.Count > 0)
                {
                    foreach (var b in bajasSub)
                        cambios.Add($"Subreceta quitada (Id {b.IdSubReceta})");
                    _dbcontext.RecetasSubRecetas.RemoveRange(bajasSub);
                    hayCambios = true;
                }

                if (!hayCambios)
                {
                    await tx.CommitAsync();
                    return (true, "Sin cambios para guardar.");
                }

                existente.FechaActualizacion = DateTime.Now;
                existente.IdUsuarioModifica = model.IdUsuarioModifica;
                existente.FechaModifica = DateTime.Now;

                var uid = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra;
                var usuarioNombre = await _dbcontext.Usuarios.AsNoTracking()
                    .Where(u => u.Id == uid)
                    .Select(u => u.Usuario)
                    .FirstOrDefaultAsync();

                RecetaHistorialHelper.Agregar(
                    _dbcontext,
                    RecetaHistorialHelper.TipoReceta,
                    model.Id,
                    "Modificacion",
                    $"Modificación de receta \"{existente.Descripcion}\"",
                    string.Join(" | ", cambios),
                    uid,
                    usuarioNombre);

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return (true, "Receta actualizada correctamente.");
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                var msg = ex.InnerException?.Message ?? ex.Message;
                return (false, "No se pudo actualizar la Receta: " + msg);
            }
        }

        /* ============================================================
         * ELIMINAR
         * ============================================================ */
        public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var ventasRefs = await _dbcontext.ImportacionesRecetas
                    .Where(x => x.IdReceta == id)
                    .Select(x => x.Id)
                    .ToListAsync();

                if (!cascade && ventasRefs.Count > 0)
                {
                    return DeleteResult.Relacion(
                        "No se puede eliminar la Receta porque está vinculada a importaciones de ventas.",
                        new[]
                        {
                            new DeleteDependencia
                            {
                                Entidad = "Ventas (importaciones)",
                                Cantidad = ventasRefs.Count,
                                Detalle = "Se desvinculará de las líneas de importación",
                                Cascadeable = true
                            }
                        },
                        cascadeDisponible: true);
                }

                if (cascade && ventasRefs.Count > 0)
                {
                    var rows = await _dbcontext.ImportacionesRecetas
                        .Where(x => x.IdReceta == id)
                        .ToListAsync();
                    foreach (var row in rows)
                        row.IdReceta = null;
                }

                var subRecetas = await _dbcontext.RecetasSubRecetas.Where(s => s.IdReceta == id).ToListAsync();
                var insumos = await _dbcontext.RecetasInsumos.Where(i => i.IdReceta == id).ToListAsync();
                var uns = await _dbcontext.RecetasUnidadesNegocios.Where(u => u.IdReceta == id).ToListAsync();

                if (subRecetas.Count > 0) _dbcontext.RecetasSubRecetas.RemoveRange(subRecetas);
                if (insumos.Count > 0) _dbcontext.RecetasInsumos.RemoveRange(insumos);
                if (uns.Count > 0) _dbcontext.RecetasUnidadesNegocios.RemoveRange(uns);

                var cab = await _dbcontext.Recetas.FirstOrDefaultAsync(c => c.Id == id);
                if (cab == null)
                    return DeleteResult.NotFound("la Receta");

                var desc = cab.Descripcion;
                var uid = cab.IdUsuarioModifica ?? cab.IdUsuarioRegistra;
                var usuarioNombre = await _dbcontext.Usuarios.AsNoTracking()
                    .Where(u => u.Id == uid)
                    .Select(u => u.Usuario)
                    .FirstOrDefaultAsync();

                RecetaHistorialHelper.Agregar(
                    _dbcontext,
                    RecetaHistorialHelper.TipoReceta,
                    id,
                    "Eliminacion",
                    cascade
                        ? $"Eliminación en cascada de receta \"{desc}\""
                        : $"Eliminación de receta \"{desc}\"",
                    $"Insumos eliminados: {insumos.Count}. Subrecetas eliminadas: {subRecetas.Count}.",
                    uid > 0 ? uid : 1,
                    usuarioNombre);

                _dbcontext.Recetas.Remove(cab);

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return DeleteResult.Success("Receta eliminada correctamente.");
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return DeleteResult.Error(
                    "Error inesperado al eliminar la Receta: " + (ex.InnerException?.Message ?? ex.Message));
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
                    .Include(p => p.RecetasSubReceta)
                        .ThenInclude(p => p.IdSubRecetaNavigation)
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

        public async Task<IQueryable<Receta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId)
        {
            try
            {
                var baseQuery = _dbcontext.Recetas
                    .AsNoTracking()
                    .Include(r => r.IdCategoriaNavigation)
                    .Include(r => r.IdUnidadMedidaNavigation)
                    .Include(r => r.IdUnidadNegocioNavigation)
                    .Include(r => r.IdUsuarioRegistraNavigation)
                    .Include(r => r.IdUsuarioModificaNavigation)
                    .Where(r => r.IdUnidadNegocio > 0);

                if (idUnidadNegocio != -1)
                    return await Task.FromResult(baseQuery.Where(r => r.IdUnidadNegocio == idUnidadNegocio));

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

        public Task<bool> InsertarInsumos(List<RecetasInsumo> insumos)
            => throw new NotImplementedException();

        public Task<bool> ActualizarInsumos(List<RecetasInsumo> insumos)
            => throw new NotImplementedException();

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
    }
}
