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
    public class SubRecetaRepository : ISubRecetaRepository<SubReceta>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public SubRecetaRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        /* ============================================================
         * INSERTAR
         *  - Inserta la subReceta
         *  - Vincula hijos con el nuevo Id
         *  - Inserta insumos
         * ============================================================ */
        public async Task<(bool ok, string mensaje)> Insertar(SubReceta model)
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

                var insumos = (model.SubRecetasInsumos ?? new List<SubRecetasInsumo>()).ToList();
                var hijos = (model.SubRecetasSubRecetaIdSubRecetaHijaNavigations
                    ?? model.SubRecetasSubRecetaIdSubRecetaPadreNavigations
                    ?? new List<SubRecetasSubReceta>()).ToList();

                foreach (var i in insumos) i.Id = 0;
                foreach (var h in hijos) h.Id = 0;

                // Evitar doble insert por cascade: limpiar navegaciones antes del Add
                model.SubRecetasInsumos = new List<SubRecetasInsumo>();
                model.SubRecetasSubRecetaIdSubRecetaHijaNavigations = new List<SubRecetasSubReceta>();
                model.SubRecetasSubRecetaIdSubRecetaPadreNavigations = new List<SubRecetasSubReceta>();
                model.RecetasSubReceta = new List<RecetasSubReceta>();
                model.SubRecetasUnidadesNegocios = new List<SubRecetasUnidadesNegocio>();
                model.IdUsuarioRegistraNavigation = null!;
                model.IdUsuarioModificaNavigation = null;
                model.IdCategoriaNavigation = null!;
                model.IdUnidadMedidaNavigation = null!;
                model.IdUnidadNegocioNavigation = null!;

                _dbcontext.SubRecetas.Add(model);
                await _dbcontext.SaveChangesAsync();

                if (hijos.Count > 0)
                {
                    foreach (var h in hijos)
                    {
                        h.IdSubRecetaPadre = model.Id;
                        h.IdUsuarioRegistra = model.IdUsuarioRegistra;
                        h.FechaRegistra = DateTime.Now;
                        h.IdSubRecetaHijaNavigation = null!;
                        h.IdSubRecetaPadreNavigation = null!;
                        h.IdUsuarioRegistraNavigation = null!;
                        h.IdUsuarioModificaNavigation = null;
                    }
                    _dbcontext.SubRecetasSubRecetas.AddRange(hijos);
                }

                if (insumos.Count > 0)
                {
                    foreach (var i in insumos)
                    {
                        i.IdSubReceta = model.Id;
                        i.IdUsuarioRegistra = model.IdUsuarioRegistra > 0 ? model.IdUsuarioRegistra : i.IdUsuarioRegistra;
                        if (i.FechaRegistra == default) i.FechaRegistra = DateTime.Now;
                        i.IdInsumoNavigation = null!;
                        i.IdSubRecetaNavigation = null!;
                        i.IdUsuarioRegistraNavigation = null!;
                        i.IdUsuarioModificaNavigation = null;
                    }
                    _dbcontext.SubRecetasInsumos.AddRange(insumos);
                }

                var usuarioNombre = await _dbcontext.Usuarios.AsNoTracking()
                    .Where(u => u.Id == model.IdUsuarioRegistra)
                    .Select(u => u.Usuario)
                    .FirstOrDefaultAsync();

                RecetaHistorialHelper.Agregar(
                    _dbcontext,
                    RecetaHistorialHelper.TipoSubReceta,
                    model.Id,
                    "Creacion",
                    $"Alta de subreceta \"{model.Descripcion}\" (SKU {model.Sku})",
                    $"Insumos: {insumos.Count}. Subrecetas hijas: {hijos.Count}. Costo unitario: {model.CostoUnitario:0.##}. Rendimiento: {model.Rendimiento:0.##}.",
                    model.IdUsuarioRegistra,
                    usuarioNombre);

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return (true, "SubReceta creada correctamente.");
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                var msg = ex.InnerException?.Message ?? ex.Message;
                return (false, "No se pudo crear la SubReceta: " + msg);
            }
        }

        /* ============================================================
         * ACTUALIZAR (con DIFF)
         *  - No toca IdUsuarioRegistra / FechaRegistra
         *  - Actualiza escalares
         *  - Upsert de Insumos y SubRecetas hija (agrega/actualiza/borra)
         *  - Transacción
         * ============================================================ */
        public async Task<(bool ok, string mensaje)> Actualizar(SubReceta model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // Cargar existente + colecciones
                var existente = await _dbcontext.SubRecetas
                    .Include(x => x.SubRecetasInsumos)
                    .Include(x => x.SubRecetasSubRecetaIdSubRecetaPadreNavigations)
                    .FirstOrDefaultAsync(x => x.Id == model.Id);

                if (existente == null)
                    return (false, "SubReceta no encontrada.");

                var cambios = new List<string>();
                void Diff(string campo, object? antes, object? despues)
                {
                    if (RecetaHistorialHelper.ValoresIguales(antes, despues)) return;
                    cambios.Add($"{campo}: {RecetaHistorialHelper.FormatearValor(antes)} → {RecetaHistorialHelper.FormatearValor(despues)}");
                }

                Diff("Descripción", existente.Descripcion, model.Descripcion);
                Diff("SKU", existente.Sku, model.Sku);
                Diff("Categoría",
                    await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "CategoriaSubReceta", existente.IdCategoria),
                    await EntidadHistorialHelper.NombreFkAsync(_dbcontext, "CategoriaSubReceta", model.IdCategoria));
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

                // ===== Campos simples de la SubReceta (preservando auditoría de registro)
                var entry = _dbcontext.Entry(existente);
                entry.CurrentValues.SetValues(model);

                // No tocar auditoría de registro
                entry.Property(nameof(SubReceta.IdUsuarioRegistra)).IsModified = false;
                entry.Property(nameof(SubReceta.FechaRegistra)).IsModified = false;

                // Detectar si hubo cambios en campos simples (excluyendo auditoría de registro)
                bool cambiosSimples = entry.Properties.Any(p =>
                    p.IsModified &&
                    p.Metadata.Name != nameof(SubReceta.IdUsuarioRegistra) &&
                    p.Metadata.Name != nameof(SubReceta.FechaRegistra)
                );

                hayCambios |= cambiosSimples;

                // =========================================================
                // ============ DETALLE: INSUMOS (delta por IdInsumo) ======
                // =========================================================
                var actualesInsumos = existente.SubRecetasInsumos
                    .ToDictionary(x => x.IdInsumo, x => x);

                var nuevosInsumos = (model.SubRecetasInsumos ?? new List<SubRecetasInsumo>())
                    .GroupBy(x => x.IdInsumo)
                    .Select(g => g.First())
                    .ToList();

                var idsNuevosIns = nuevosInsumos.Select(x => x.IdInsumo).ToHashSet();
                var idsActualesIns = actualesInsumos.Keys.ToHashSet();

                // Borrar
                foreach (var idIns in idsActualesIns.Except(idsNuevosIns))
                {
                    _dbcontext.SubRecetasInsumos.Remove(actualesInsumos[idIns]);
                    hayCambios = true;
                    cambios.Add($"Insumo quitado (Id {idIns})");
                }

                // Upsert
                foreach (var n in nuevosInsumos)
                {
                    if (actualesInsumos.TryGetValue(n.IdInsumo, out var act))
                    {
                        if (act.Cantidad != n.Cantidad || act.CostoUnitario != n.CostoUnitario || act.SubTotal != n.SubTotal)
                        {
                            act.Cantidad = n.Cantidad;
                            act.CostoUnitario = n.CostoUnitario;
                            act.SubTotal = n.SubTotal;
                            act.IdUsuarioModifica = model.IdUsuarioModifica;
                            act.FechaModifica = DateTime.Now;
                            hayCambios = true;
                            cambios.Add($"Insumo Id {n.IdInsumo} actualizado (cant {n.Cantidad}, costo {n.CostoUnitario:0.##})");
                        }
                    }
                    else
                    {
                        n.Id = 0;
                        n.IdSubReceta = model.Id;
                        n.IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra;
                        n.FechaRegistra = DateTime.Now;
                        n.IdInsumoNavigation = null!;
                        n.IdSubRecetaNavigation = null!;
                        n.IdUsuarioRegistraNavigation = null!;
                        existente.SubRecetasInsumos.Add(n);
                        hayCambios = true;
                        cambios.Add($"Insumo Id {n.IdInsumo} agregado");
                    }
                }

                // =========================================================
                // ======== DETALLE: SUBRECETAS HIJAS (delta por IdHija) ====
                // =========================================================
                var actualesHijas = existente.SubRecetasSubRecetaIdSubRecetaPadreNavigations
                    .ToDictionary(x => x.IdSubRecetaHija, x => x);

                var nuevasHijas = (model.SubRecetasSubRecetaIdSubRecetaPadreNavigations
                    ?? model.SubRecetasSubRecetaIdSubRecetaHijaNavigations
                    ?? new List<SubRecetasSubReceta>())
                    .GroupBy(x => x.IdSubRecetaHija)
                    .Select(g => g.First())
                    .ToList();

                var idsNuevasH = nuevasHijas.Select(x => x.IdSubRecetaHija).ToHashSet();
                var idsActualesH = actualesHijas.Keys.ToHashSet();

                foreach (var idH in idsActualesH.Except(idsNuevasH))
                {
                    _dbcontext.SubRecetasSubRecetas.Remove(actualesHijas[idH]);
                    hayCambios = true;
                    cambios.Add($"Subreceta hija Id {idH} quitada");
                }

                foreach (var n in nuevasHijas)
                {
                    if (actualesHijas.TryGetValue(n.IdSubRecetaHija, out var act))
                    {
                        if (act.Cantidad != n.Cantidad || act.CostoUnitario != n.CostoUnitario || act.Subtotal != n.Subtotal)
                        {
                            act.Cantidad = n.Cantidad;
                            act.CostoUnitario = n.CostoUnitario;
                            act.Subtotal = n.Subtotal;
                            act.IdUsuarioModifica = model.IdUsuarioModifica;
                            act.FechaModifica = DateTime.Now;
                            hayCambios = true;
                            cambios.Add($"Subreceta hija Id {n.IdSubRecetaHija} actualizada");
                        }
                    }
                    else
                    {
                        n.Id = 0;
                        n.IdSubRecetaPadre = model.Id;
                        n.IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra;
                        n.FechaRegistra = DateTime.Now;
                        n.IdSubRecetaHijaNavigation = null!;
                        n.IdSubRecetaPadreNavigation = null!;
                        n.IdUsuarioRegistraNavigation = null!;
                        existente.SubRecetasSubRecetaIdSubRecetaPadreNavigations.Add(n);
                        hayCambios = true;
                        cambios.Add($"Subreceta hija Id {n.IdSubRecetaHija} agregada");
                    }
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
                    RecetaHistorialHelper.TipoSubReceta,
                    model.Id,
                    "Modificacion",
                    $"Modificación de subreceta \"{existente.Descripcion}\"",
                    string.Join(" | ", cambios),
                    uid,
                    usuarioNombre);

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return (true, "SubReceta actualizada correctamente.");
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                var msg = ex.InnerException?.Message ?? ex.Message;
                return (false, "No se pudo actualizar la SubReceta: " + msg);
            }
        }



        /* ============================================================
         * ELIMINAR (con validaciones / cascada)
         *  - Sin cascade: lista Recetas y SubRecetas padre
         *  - Con cascade: desvincula usos + borra hijos propios + UN
         * ============================================================ */
        public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var RecetasUsadas = await (from rs in _dbcontext.RecetasSubRecetas
                                           join r in _dbcontext.Recetas on rs.IdReceta equals r.Id
                                           where rs.IdSubReceta == id
                                           select r.Descripcion).ToListAsync();

                var subRecetasPadre = await (from ss in _dbcontext.SubRecetasSubRecetas
                                             join sr in _dbcontext.SubRecetas on ss.IdSubRecetaPadre equals sr.Id
                                             where ss.IdSubRecetaHija == id
                                             select sr.Descripcion).ToListAsync();

                var ventasCount = await _dbcontext.ImportacionesSubRecetas
                    .CountAsync(x => x.IdSubReceta == id);

                if (!cascade && (RecetasUsadas.Any() || subRecetasPadre.Any() || ventasCount > 0))
                {
                    var deps = new List<DeleteDependencia>();
                    if (RecetasUsadas.Any())
                    {
                        var names = RecetasUsadas.Distinct().ToList();
                        deps.Add(new DeleteDependencia
                        {
                            Entidad = "Recetas",
                            Cantidad = names.Count,
                            Detalle = string.Join(", ", names),
                            Cascadeable = true
                        });
                    }
                    if (subRecetasPadre.Any())
                    {
                        var names = subRecetasPadre.Distinct().ToList();
                        deps.Add(new DeleteDependencia
                        {
                            Entidad = "SubRecetas",
                            Cantidad = names.Count,
                            Detalle = "Usada como hija en: " + string.Join(", ", names),
                            Cascadeable = true
                        });
                    }
                    if (ventasCount > 0)
                    {
                        deps.Add(new DeleteDependencia
                        {
                            Entidad = "Ventas (detalle)",
                            Cantidad = ventasCount,
                            Detalle = "Líneas de importación de ventas que referencian esta subreceta",
                            Cascadeable = true
                        });
                    }

                    return DeleteResult.Relacion(
                        "No se puede eliminar la SubReceta porque está siendo utilizada.",
                        deps,
                        cascadeDisponible: true);
                }

                if (cascade)
                {
                    var enRecetas = await _dbcontext.RecetasSubRecetas
                        .Where(x => x.IdSubReceta == id).ToListAsync();
                    if (enRecetas.Count > 0) _dbcontext.RecetasSubRecetas.RemoveRange(enRecetas);

                    var comoHija = await _dbcontext.SubRecetasSubRecetas
                        .Where(x => x.IdSubRecetaHija == id).ToListAsync();
                    if (comoHija.Count > 0) _dbcontext.SubRecetasSubRecetas.RemoveRange(comoHija);

                    var enVentas = await _dbcontext.ImportacionesSubRecetas
                        .Where(x => x.IdSubReceta == id).ToListAsync();
                    if (enVentas.Count > 0) _dbcontext.ImportacionesSubRecetas.RemoveRange(enVentas);
                }

                var hijos = await _dbcontext.SubRecetasSubRecetas
                    .Where(s => s.IdSubRecetaPadre == id)
                    .ToListAsync();

                var insumos = await _dbcontext.SubRecetasInsumos
                    .Where(i => i.IdSubReceta == id)
                    .ToListAsync();

                var uns = await _dbcontext.SubRecetasUnidadesNegocios
                    .Where(u => u.IdSubReceta == id)
                    .ToListAsync();

                if (hijos.Count > 0) _dbcontext.SubRecetasSubRecetas.RemoveRange(hijos);
                if (insumos.Count > 0) _dbcontext.SubRecetasInsumos.RemoveRange(insumos);
                if (uns.Count > 0) _dbcontext.SubRecetasUnidadesNegocios.RemoveRange(uns);

                var cab = await _dbcontext.SubRecetas.FirstOrDefaultAsync(c => c.Id == id);
                if (cab == null) return DeleteResult.NotFound("la SubReceta");

                var desc = cab.Descripcion;
                var uid = cab.IdUsuarioModifica ?? cab.IdUsuarioRegistra;
                var usuarioNombre = await _dbcontext.Usuarios.AsNoTracking()
                    .Where(u => u.Id == uid)
                    .Select(u => u.Usuario)
                    .FirstOrDefaultAsync();

                RecetaHistorialHelper.Agregar(
                    _dbcontext,
                    RecetaHistorialHelper.TipoSubReceta,
                    id,
                    "Eliminacion",
                    cascade
                        ? $"Eliminación en cascada de subreceta \"{desc}\""
                        : $"Eliminación de subreceta \"{desc}\"",
                    null,
                    uid > 0 ? uid : 1,
                    usuarioNombre);

                _dbcontext.SubRecetas.Remove(cab);

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return DeleteResult.Success(
                    cascade
                        ? "SubReceta y vínculos asociados eliminados correctamente."
                        : "SubReceta eliminada correctamente.");
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return DeleteResult.Error(
                    "Error inesperado al eliminar la SubReceta: " + (ex.InnerException?.Message ?? ex.Message));
            }
        }

        /* ============================================================
         * OBTENER
         * ============================================================ */
        public async Task<SubReceta> Obtener(int id)
        {
            try
            {
                var model = await _dbcontext.SubRecetas
                    .Include(p => p.SubRecetasInsumos)
                        .ThenInclude(p => p.IdInsumoNavigation)
                    .Include(p => p.SubRecetasSubRecetaIdSubRecetaPadreNavigations)
                        .ThenInclude(p => p.IdSubRecetaHijaNavigation)
                    .FirstOrDefaultAsync(p => p.Id == id);

                return model;
            }
            catch
            {
                return null;
            }
        }

        public async Task<IQueryable<SubReceta>> ObtenerTodos()
        {
            IQueryable<SubReceta> query = _dbcontext.SubRecetas;
            return await Task.FromResult(query);
        }

        public async Task<IQueryable<SubReceta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId)
        {
            try
            {
                // Base: excluir Recetas sin unidad (null o 0)
                var baseQuery = _dbcontext.SubRecetas
                    .AsNoTracking()
                    .Include(r => r.IdCategoriaNavigation)
                    .Include(r => r.IdUnidadMedidaNavigation)
                    .Include(r => r.IdUnidadNegocioNavigation)
                    .Include(r => r.IdUsuarioRegistraNavigation)
                    .Include(r => r.IdUsuarioModificaNavigation)
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
                    return Enumerable.Empty<SubReceta>().AsQueryable();

                var filtrado = baseQuery.Where(r => idsPermitidos.Contains(r.IdUnidadNegocio));
                return await Task.FromResult(filtrado);
            }
            catch
            {
                return Enumerable.Empty<SubReceta>().AsQueryable();
            }
        }

        /* ============================================================
         * (Opcional) Métodos legacy — mantenidos por compatibilidad
         *  Si vas a usar Actualizar con DIFF, no los necesitás.
         * ============================================================ */

        public async Task<bool> InsertarInsumos(List<SubRecetasInsumo> insumos)
        {
            foreach (var p in insumos)
            {
                var existente = await _dbcontext.SubRecetasInsumos
                    .FirstOrDefaultAsync(x => x.IdSubReceta == p.IdSubReceta && x.IdInsumo == p.IdInsumo);

                if (existente != null)
                {
                    existente.CostoUnitario = p.CostoUnitario;
                    existente.SubTotal = p.SubTotal;
                    existente.Cantidad = p.Cantidad;
                }
                else
                {
                    _dbcontext.SubRecetasInsumos.Add(p);
                }
            }

            // Eliminar los que ya no están
            var idsSubReceta = insumos.Select(p => p.IdSubReceta).Distinct().ToList();
            var idsInsumo = insumos.Select(p => p.IdInsumo).ToHashSet();

            var eliminar = await _dbcontext.SubRecetasInsumos
                .Where(x => idsSubReceta.Contains(x.IdSubReceta) && !idsInsumo.Contains(x.IdInsumo))
                .ToListAsync();

            if (eliminar.Count > 0) _dbcontext.SubRecetasInsumos.RemoveRange(eliminar);

            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ActualizarInsumos(List<SubRecetasInsumo> insumos)
        {
            foreach (var p in insumos)
                _dbcontext.SubRecetasInsumos.Update(p);

            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<List<SubRecetasInsumo>> ObtenerInsumos(int idSubReceta)
        {
            try
            {
                return await _dbcontext.SubRecetasInsumos
                    .Include(c => c.IdSubRecetaNavigation)
                    .Include(c => c.IdInsumoNavigation)
                    .Where(c => c.IdSubReceta == idSubReceta)
                    .ToListAsync();
            }
            catch
            {
                return null;
            }
        }
    }
}
