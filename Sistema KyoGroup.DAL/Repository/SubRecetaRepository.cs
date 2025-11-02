using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public class SubrecetaRepository : ISubrecetaRepository<Subreceta>
    {
        private readonly SistemaKyoGroupContext _dbcontext;

        public SubrecetaRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        /* ============================================================
         * INSERTAR
         *  - Inserta la subreceta
         *  - Vincula hijos con el nuevo Id
         *  - Inserta insumos
         * ============================================================ */
        public async Task<bool> Insertar(Subreceta model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // Normalizamos colecciones nulas
                model.SubrecetasInsumos ??= new List<SubrecetasInsumo>();
                model.SubrecetasSubrecetaIdSubrecetaHijaNavigations ??= new List<SubrecetasSubreceta>();

                // Reseteo de Ids de detalle (por las dudas)
                foreach (var i in model.SubrecetasInsumos) i.Id = 0;
                foreach (var h in model.SubrecetasSubrecetaIdSubrecetaHijaNavigations) h.Id = 0;

                // Me guardo (en memoria) los vínculos a hijas, porque necesito el Id del padre
                var hijos = model.SubrecetasSubrecetaIdSubrecetaHijaNavigations.ToList();
                model.SubrecetasSubrecetaIdSubrecetaHijaNavigations = null;

                _dbcontext.Subrecetas.Add(model);
                await _dbcontext.SaveChangesAsync(); // model.Id disponible

                // Hijos → linkeo al padre nuevo
                if (hijos.Count > 0)
                {
                    foreach (var h in hijos)
                    {
                        h.IdSubrecetaPadre = model.Id;
                    }

                    _dbcontext.SubrecetasSubrecetas.AddRange(hijos);
                }

                // Insumos → forzar IdSubreceta
                if (model.SubrecetasInsumos.Count > 0)
                {
                    foreach (var i in model.SubrecetasInsumos)
                        i.IdSubreceta = model.Id;

                    _dbcontext.SubrecetasInsumos.AddRange(model.SubrecetasInsumos);
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
         *  - Upsert de Insumos y Subrecetas hija (agrega/actualiza/borra)
         *  - Transacción
         * ============================================================ */
        public async Task<bool> Actualizar(Subreceta model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // Cargar existente + colecciones
                var existente = await _dbcontext.Subrecetas
                    .Include(x => x.SubrecetasInsumos)
                    .Include(x => x.SubrecetasSubrecetaIdSubrecetaPadreNavigations)
                    .FirstOrDefaultAsync(x => x.Id == model.Id);

                if (existente == null)
                    return false;

                bool hayCambios = false;

                // ===== Campos simples de la Subreceta (preservando auditoría de registro)
                var entry = _dbcontext.Entry(existente);
                entry.CurrentValues.SetValues(model);

                // No tocar auditoría de registro
                entry.Property(nameof(Subreceta.IdUsuarioRegistra)).IsModified = false;
                entry.Property(nameof(Subreceta.FechaRegistra)).IsModified = false;

                // Detectar si hubo cambios en campos simples (excluyendo auditoría de registro)
                bool cambiosSimples = entry.Properties.Any(p =>
                    p.IsModified &&
                    p.Metadata.Name != nameof(Subreceta.IdUsuarioRegistra) &&
                    p.Metadata.Name != nameof(Subreceta.FechaRegistra)
                );

                hayCambios |= cambiosSimples;

                // =========================================================
                // ============ DETALLE: INSUMOS (delta por IdInsumo) ======
                // =========================================================
                var actualesInsumos = existente.SubrecetasInsumos
                    .ToDictionary(i => i.IdInsumo, i => i);

                var entrantesInsumos = model.SubrecetasInsumos ?? new List<SubrecetasInsumo>();

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
                            eCur.Property(nameof(SubrecetasInsumo.IdUsuarioRegistra)).IsModified = false;
                            eCur.Property(nameof(SubrecetasInsumo.FechaRegistra)).IsModified = false;

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
                        var nuevo = new SubrecetasInsumo
                        {
                            Id = 0,
                            IdSubreceta = existente.Id,
                            IdInsumo = inc.IdInsumo,
                            CostoUnitario = inc.CostoUnitario,
                            Cantidad = inc.Cantidad,
                            SubTotal = inc.SubTotal,
                            // Auditoría de registro para nuevo ítem en una actualización
                            IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra,
                            FechaRegistra = DateTime.Now
                        };
                        await _dbcontext.SubrecetasInsumos.AddAsync(nuevo);
                        hayCambios = true;
                    }
                }

                // Bajas (IdInsumo que ya no vienen)
                var idsInsumoEntrantes = new HashSet<int>(entrantesInsumos.Select(x => x.IdInsumo));
                var bajasInsumos = existente.SubrecetasInsumos
                    .Where(x => !idsInsumoEntrantes.Contains(x.IdInsumo))
                    .ToList();
                if (bajasInsumos.Count > 0)
                {
                    _dbcontext.SubrecetasInsumos.RemoveRange(bajasInsumos);
                    hayCambios = true;
                }

                // =========================================================
                // ===== DETALLE: SUBRECETAS HIJAS (delta por Hija) ========
                // =========================================================
                var actualesHijas = existente.SubrecetasSubrecetaIdSubrecetaPadreNavigations
                    .ToDictionary(s => s.IdSubrecetaHija, s => s);

                var entrantesHijas = model.SubrecetasSubrecetaIdSubrecetaPadreNavigations ?? new List<SubrecetasSubreceta>();

                foreach (var inc in entrantesHijas)
                {
                    var idHija = inc.IdSubrecetaHija;

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
                            eCur.Property(nameof(SubrecetasSubreceta.IdUsuarioRegistra)).IsModified = false;
                            eCur.Property(nameof(SubrecetasSubreceta.FechaRegistra)).IsModified = false;

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
                        var nueva = new SubrecetasSubreceta
                        {
                            Id = 0,
                            IdSubrecetaPadre = existente.Id,
                            IdSubrecetaHija = idHija,
                            CostoUnitario = inc.CostoUnitario,
                            Cantidad = inc.Cantidad,
                            Subtotal = inc.Subtotal, // ⚠ entidad usa 'Subtotal'
                            IdUsuarioRegistra = model.IdUsuarioModifica ?? existente.IdUsuarioRegistra,
                            FechaRegistra = DateTime.Now
                        };

                        await _dbcontext.SubrecetasSubrecetas.AddAsync(nueva);
                        hayCambios = true;
                    }
                }

                // Bajas (por IdSubrecetaHija)
                var idsHijaEntrantes = new HashSet<int>(entrantesHijas.Select(x => x.IdSubrecetaHija));
                var bajasHijas = existente.SubrecetasSubrecetaIdSubrecetaPadreNavigations
                    .Where(x => !idsHijaEntrantes.Contains(x.IdSubrecetaHija))
                    .ToList();
                if (bajasHijas.Count > 0)
                {
                    _dbcontext.SubrecetasSubrecetas.RemoveRange(bajasHijas);
                    hayCambios = true;
                }

                // ===== Auditoría de modificación de la Subreceta (solo si hubo cambios)
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
         *  - Bloquea si la subreceta está en recetas o como hija de otra subreceta
         *  - Transacción
         * ============================================================ */
        public async Task<(bool eliminado, string mensaje)> Eliminar(int id)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // ¿Usada en recetas?
                var recetasUsadas = await (from rs in _dbcontext.RecetasSubrecetas
                                           join r in _dbcontext.Recetas on rs.IdReceta equals r.Id
                                           where rs.IdSubreceta == id
                                           select r.Descripcion).ToListAsync();

                // ¿Usada como hija?
                var subrecetasPadre = await (from ss in _dbcontext.SubrecetasSubrecetas
                                             join sr in _dbcontext.Subrecetas on ss.IdSubrecetaPadre equals sr.Id
                                             where ss.IdSubrecetaHija == id
                                             select sr.Descripcion).ToListAsync();

                if (recetasUsadas.Any() || subrecetasPadre.Any())
                {
                    string msg = "No se puede eliminar la Subreceta porque está siendo utilizada en:\n";
                    if (recetasUsadas.Any())
                        msg += "- Recetas: " + string.Join(", ", recetasUsadas.Distinct()) + "\n";
                    if (subrecetasPadre.Any())
                        msg += "- Subrecetas: " + string.Join(", ", subrecetasPadre.Distinct());
                    return (false, msg);
                }

                // Relaciones (hijas) y detalle (insumos)
                var hijos = await _dbcontext.SubrecetasSubrecetas
                    .Where(s => s.IdSubrecetaPadre == id)
                    .ToListAsync();

                var insumos = await _dbcontext.SubrecetasInsumos
                    .Where(i => i.IdSubreceta == id)
                    .ToListAsync();

                if (hijos.Count > 0) _dbcontext.SubrecetasSubrecetas.RemoveRange(hijos);
                if (insumos.Count > 0) _dbcontext.SubrecetasInsumos.RemoveRange(insumos);

                var cab = await _dbcontext.Subrecetas.FirstOrDefaultAsync(c => c.Id == id);
                if (cab == null) return (false, "Subreceta no encontrada.");

                _dbcontext.Subrecetas.Remove(cab);

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return (true, "Subreceta eliminada correctamente.");
            }
            catch
            {
                await tx.RollbackAsync();
                return (false, "Error inesperado al eliminar la Subreceta.");
            }
        }

        /* ============================================================
         * OBTENER
         * ============================================================ */
        public async Task<Subreceta> Obtener(int id)
        {
            try
            {
                var model = await _dbcontext.Subrecetas
                    .Include(p => p.SubrecetasInsumos)
                        .ThenInclude(p => p.IdInsumoNavigation)
                    .Include(p => p.SubrecetasSubrecetaIdSubrecetaPadreNavigations)
                        .ThenInclude(p => p.IdSubrecetaHijaNavigation)
                    .FirstOrDefaultAsync(p => p.Id == id);

                return model;
            }
            catch
            {
                return null;
            }
        }

        public async Task<IQueryable<Subreceta>> ObtenerTodos()
        {
            IQueryable<Subreceta> query = _dbcontext.Subrecetas;
            return await Task.FromResult(query);
        }

        public async Task<IQueryable<Subreceta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId)
        {
            try
            {
                // Base: excluir recetas sin unidad (null o 0)
                var baseQuery = _dbcontext.Subrecetas
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
                    return Enumerable.Empty<Subreceta>().AsQueryable();

                var filtrado = baseQuery.Where(r => idsPermitidos.Contains(r.IdUnidadNegocio));
                return await Task.FromResult(filtrado);
            }
            catch
            {
                return Enumerable.Empty<Subreceta>().AsQueryable();
            }
        }

        /* ============================================================
         * (Opcional) Métodos legacy — mantenidos por compatibilidad
         *  Si vas a usar Actualizar con DIFF, no los necesitás.
         * ============================================================ */

        public async Task<bool> InsertarInsumos(List<SubrecetasInsumo> insumos)
        {
            foreach (var p in insumos)
            {
                var existente = await _dbcontext.SubrecetasInsumos
                    .FirstOrDefaultAsync(x => x.IdSubreceta == p.IdSubreceta && x.IdInsumo == p.IdInsumo);

                if (existente != null)
                {
                    existente.CostoUnitario = p.CostoUnitario;
                    existente.SubTotal = p.SubTotal;
                    existente.Cantidad = p.Cantidad;
                }
                else
                {
                    _dbcontext.SubrecetasInsumos.Add(p);
                }
            }

            // Eliminar los que ya no están
            var idsSubreceta = insumos.Select(p => p.IdSubreceta).Distinct().ToList();
            var idsInsumo = insumos.Select(p => p.IdInsumo).ToHashSet();

            var eliminar = await _dbcontext.SubrecetasInsumos
                .Where(x => idsSubreceta.Contains(x.IdSubreceta) && !idsInsumo.Contains(x.IdInsumo))
                .ToListAsync();

            if (eliminar.Count > 0) _dbcontext.SubrecetasInsumos.RemoveRange(eliminar);

            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ActualizarInsumos(List<SubrecetasInsumo> insumos)
        {
            foreach (var p in insumos)
                _dbcontext.SubrecetasInsumos.Update(p);

            await _dbcontext.SaveChangesAsync();
            return true;
        }

        public async Task<List<SubrecetasInsumo>> ObtenerInsumos(int idSubreceta)
        {
            try
            {
                return await _dbcontext.SubrecetasInsumos
                    .Include(c => c.IdSubrecetaNavigation)
                    .Include(c => c.IdInsumoNavigation)
                    .Where(c => c.IdSubreceta == idSubreceta)
                    .ToListAsync();
            }
            catch
            {
                return null;
            }
        }
    }
}
