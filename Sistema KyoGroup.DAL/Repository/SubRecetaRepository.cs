using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
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
        public async Task<bool> Insertar(SubReceta model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // Normalizamos colecciones nulas
                model.SubRecetasInsumos ??= new List<SubRecetasInsumo>();
                model.SubRecetasSubRecetaIdSubRecetaHijaNavigations ??= new List<SubRecetasSubReceta>();

                // Reseteo de Ids de detalle (por las dudas)
                foreach (var i in model.SubRecetasInsumos) i.Id = 0;
                foreach (var h in model.SubRecetasSubRecetaIdSubRecetaHijaNavigations) h.Id = 0;

                // Me guardo (en memoria) los vínculos a hijas, porque necesito el Id del padre
                var hijos = model.SubRecetasSubRecetaIdSubRecetaHijaNavigations.ToList();
                model.SubRecetasSubRecetaIdSubRecetaHijaNavigations = null;

                _dbcontext.SubRecetas.Add(model);
                await _dbcontext.SaveChangesAsync(); // model.Id disponible

                // Hijos → linkeo al padre nuevo
                if (hijos.Count > 0)
                {
                    foreach (var h in hijos)
                    {
                        h.IdSubRecetaPadre = model.Id;
                    }

                    _dbcontext.SubRecetasSubRecetas.AddRange(hijos);
                }

                // Insumos → forzar IdSubReceta
                if (model.SubRecetasInsumos.Count > 0)
                {
                    foreach (var i in model.SubRecetasInsumos)
                        i.IdSubReceta = model.Id;

                    _dbcontext.SubRecetasInsumos.AddRange(model.SubRecetasInsumos);
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
         * ACTUALIZAR (con DIFF)
         *  - No toca IdUsuarioRegistra / FechaRegistra
         *  - Actualiza escalares
         *  - Upsert de Insumos y SubRecetas hija (agrega/actualiza/borra)
         *  - Transacción
         * ============================================================ */
        public async Task<bool> Actualizar(SubReceta model)
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
                    return false;

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
                    .ToDictionary(i => i.IdInsumo, i => i);

                var entrantesInsumos = model.SubRecetasInsumos ?? new List<SubRecetasInsumo>();

                // Altas/Modificaciones
                foreach (var inc in entrantesInsumos)
                {
                    if (actualesInsumos.TryGetValue(inc.IdInsumo, out var cur))
                    {
                        bool mod =
                              cur.CostoUnitario != inc.CostoUnitario
                           || cur.Cantidad != inc.Cantidad
                           || cur.SubTotal != inc.SubTotal;

                        if (mod)
                        {
                            cur.CostoUnitario = inc.CostoUnitario;
                            cur.Cantidad = inc.Cantidad;
                            cur.SubTotal = inc.SubTotal;

                            var eCur = _dbcontext.Entry(cur);
                            // Preservar registro
                            eCur.Property(nameof(SubRecetasInsumo.IdUsuarioRegistra)).IsModified = false;
                            eCur.Property(nameof(SubRecetasInsumo.FechaRegistra)).IsModified = false;

                            // Auditoría de modificación si corresponde
                            if (model.IdUsuarioModifica > 0)
                            {
                                cur.IdUsuarioModifica = model.IdUsuarioModifica ?? cur.IdUsuarioModifica;
                                cur.FechaModifica = DateTime.Now;
                            }

                            hayCambios = true;
                        }
                    }
                    else
                    {
                        // Alta
                        var nuevo = new SubRecetasInsumo
                        {
                            Id = 0,
                            IdSubReceta = existente.Id,
                            IdInsumo = inc.IdInsumo,
                            CostoUnitario = inc.CostoUnitario,
                            Cantidad = inc.Cantidad,
                            SubTotal = inc.SubTotal,
                            // Auditoría de registro para nuevo ítem en una actualización
                            IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra,
                            FechaRegistra = DateTime.Now
                        };
                        await _dbcontext.SubRecetasInsumos.AddAsync(nuevo);
                        hayCambios = true;
                    }
                }

                // Bajas (IdInsumo que ya no vienen)
                var idsInsumoEntrantes = new HashSet<int>(entrantesInsumos.Select(x => x.IdInsumo));
                var bajasInsumos = existente.SubRecetasInsumos
                    .Where(x => !idsInsumoEntrantes.Contains(x.IdInsumo))
                    .ToList();
                if (bajasInsumos.Count > 0)
                {
                    _dbcontext.SubRecetasInsumos.RemoveRange(bajasInsumos);
                    hayCambios = true;
                }

                // =========================================================
                // ===== DETALLE: SUBRecetaS HIJAS (delta por Hija) ========
                // =========================================================
                var actualesHijas = existente.SubRecetasSubRecetaIdSubRecetaPadreNavigations
                    .ToDictionary(s => s.IdSubRecetaHija, s => s);

                var entrantesHijas = model.SubRecetasSubRecetaIdSubRecetaPadreNavigations ?? new List<SubRecetasSubReceta>();

                foreach (var inc in entrantesHijas)
                {
                    var idHija = inc.IdSubRecetaHija;

                    if (actualesHijas.TryGetValue(idHija, out var cur))
                    {
                        bool mod =
                              cur.CostoUnitario != inc.CostoUnitario
                           || cur.Cantidad != inc.Cantidad
                           || cur.Subtotal != inc.Subtotal; // ⚠ entidad usa 'Subtotal'

                        if (mod)
                        {
                            cur.CostoUnitario = inc.CostoUnitario;
                            cur.Cantidad = inc.Cantidad;
                            cur.Subtotal = inc.Subtotal;

                            var eCur = _dbcontext.Entry(cur);
                            // Preservar registro
                            eCur.Property(nameof(SubRecetasSubReceta.IdUsuarioRegistra)).IsModified = false;
                            eCur.Property(nameof(SubRecetasSubReceta.FechaRegistra)).IsModified = false;

                            if (model.IdUsuarioModifica > 0)
                            {
                                cur.IdUsuarioModifica = model.IdUsuarioModifica ?? cur.IdUsuarioModifica;
                                cur.FechaModifica = DateTime.Now;
                            }

                            hayCambios = true;
                        }
                    }
                    else
                    {
                        var nueva = new SubRecetasSubReceta
                        {
                            Id = 0,
                            IdSubRecetaPadre = existente.Id,
                            IdSubRecetaHija = idHija,
                            CostoUnitario = inc.CostoUnitario,
                            Cantidad = inc.Cantidad,
                            Subtotal = inc.Subtotal, // ⚠ entidad usa 'Subtotal'
                            IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra,
                            FechaRegistra = DateTime.Now
                        };

                        await _dbcontext.SubRecetasSubRecetas.AddAsync(nueva);
                        hayCambios = true;
                    }
                }

                // Bajas (por IdSubRecetaHija)
                var idsHijaEntrantes = new HashSet<int>(entrantesHijas.Select(x => x.IdSubRecetaHija));
                var bajasHijas = existente.SubRecetasSubRecetaIdSubRecetaPadreNavigations
                    .Where(x => !idsHijaEntrantes.Contains(x.IdSubRecetaHija))
                    .ToList();
                if (bajasHijas.Count > 0)
                {
                    _dbcontext.SubRecetasSubRecetas.RemoveRange(bajasHijas);
                    hayCambios = true;
                }

                // ===== Auditoría de modificación de la SubReceta (solo si hubo cambios)
                if (hayCambios && model.IdUsuarioModifica > 0)
                {
                    existente.IdUsuarioModifica = model.IdUsuarioModifica;
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
         * ELIMINAR (con validaciones)
         *  - Bloquea si la subReceta está en Recetas o como hija de otra subReceta
         *  - Transacción
         * ============================================================ */
        public async Task<(bool eliminado, string mensaje)> Eliminar(int id)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // ¿Usada en Recetas?
                var RecetasUsadas = await (from rs in _dbcontext.RecetasSubRecetas
                                           join r in _dbcontext.Recetas on rs.IdReceta equals r.Id
                                           where rs.IdSubReceta == id
                                           select r.Descripcion).ToListAsync();

                // ¿Usada como hija?
                var subRecetasPadre = await (from ss in _dbcontext.SubRecetasSubRecetas
                                             join sr in _dbcontext.SubRecetas on ss.IdSubRecetaPadre equals sr.Id
                                             where ss.IdSubRecetaHija == id
                                             select sr.Descripcion).ToListAsync();

                if (RecetasUsadas.Any() || subRecetasPadre.Any())
                {
                    string msg = "No se puede eliminar la SubReceta porque está siendo utilizada en:\n";
                    if (RecetasUsadas.Any())
                        msg += "- Recetas: " + string.Join(", ", RecetasUsadas.Distinct()) + "\n";
                    if (subRecetasPadre.Any())
                        msg += "- SubRecetas: " + string.Join(", ", subRecetasPadre.Distinct());
                    return (false, msg);
                }

                // Relaciones (hijas) y detalle (insumos)
                var hijos = await _dbcontext.SubRecetasSubRecetas
                    .Where(s => s.IdSubRecetaPadre == id)
                    .ToListAsync();

                var insumos = await _dbcontext.SubRecetasInsumos
                    .Where(i => i.IdSubReceta == id)
                    .ToListAsync();

                if (hijos.Count > 0) _dbcontext.SubRecetasSubRecetas.RemoveRange(hijos);
                if (insumos.Count > 0) _dbcontext.SubRecetasInsumos.RemoveRange(insumos);

                var cab = await _dbcontext.SubRecetas.FirstOrDefaultAsync(c => c.Id == id);
                if (cab == null) return (false, "SubReceta no encontrada.");

                _dbcontext.SubRecetas.Remove(cab);

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return (true, "SubReceta eliminada correctamente.");
            }
            catch
            {
                await tx.RollbackAsync();
                return (false, "Error inesperado al eliminar la SubReceta.");
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
