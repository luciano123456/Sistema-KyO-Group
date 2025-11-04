using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;
using SistemaKyoGroup.DAL.DataContext;

namespace SistemaKyoGroup.DAL.Repository
{
    public class InsumoRepository : IInsumoRepository<Insumo>
    {

        private readonly SistemaKyoGroupContext _dbcontext;

        public InsumoRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<bool> Insertar(Insumo model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // Normalización básica
                model.Id = 0;
                model.Descripcion = model.Descripcion?.Trim();
                model.Sku = model.Sku?.Trim();

                // En INSERT: NO tocar "modifica"
                model.IdUsuarioModifica = null;
                model.FechaModifica = null;

                // --- 1) Copiamos y normalizamos hijos EN MEMORIA (aún fuera del contexto) ---
                // Unidades de negocio (puede venir duplicado desde UI)
                var unidadesNegocio = (model.InsumosUnidadesNegocios ?? new List<InsumosUnidadesNegocio>())
                    .GroupBy(x => x.IdUnidadNegocio)
                    .Select(g => new InsumosUnidadesNegocio
                    {
                        Id = 0,
                        IdUnidadNegocio = g.Key
                        // si tenés más campos opcionales, mapéalos aquí
                    })
                    .ToList();

                // Proveedores (puede asociarse varias veces en distintos lados: deduplicamos por par clave)
                var Proveedores = (model.InsumosProveedores ?? new List<InsumosProveedor>())
                    .GroupBy(p => new { p.IdProveedor, p.IdListaProveedor })
                    .Select(g =>
                    {
                        var p = g.First();
                        return new InsumosProveedor
                        {
                            Id = 0,
                            IdProveedor = p.IdProveedor,
                            IdListaProveedor = p.IdListaProveedor,
                            // mapear otros campos NO clave si aplican (ej.: Precio, Moneda, etc.)
                            // Precio = p.Precio
                        };
                    })
                    .ToList();

                // MUY IMPORTANTE: quitar las colecciones antes de adjuntar el padre,
                // para que EF NO intente trackear el grafo y luego "severe" relaciones.
                model.InsumosUnidadesNegocios = null;
                model.InsumosProveedores = null;

                // --- 2) Insert del principal ---
                _dbcontext.Insumos.Add(model);

                // Aseguramos que "modifica" siga nulo
                var e = _dbcontext.Entry(model);
                e.Property(nameof(Insumo.IdUsuarioModifica)).CurrentValue = null;
                e.Property(nameof(Insumo.FechaModifica)).CurrentValue = null;

                await _dbcontext.SaveChangesAsync(); // ← ya tenemos model.Id

                // --- 3) Insert de hijos (ya con Id del padre) ---
                if (unidadesNegocio.Count > 0)
                {
                    foreach (var un in unidadesNegocio)
                    {
                        un.Id = 0;
                        un.IdInsumo = model.Id;
                    }
                    _dbcontext.InsumosUnidadesNegocios.AddRange(unidadesNegocio);
                }

                if (Proveedores.Count > 0)
                {
                    foreach (var pr in Proveedores)
                    {
                        pr.Id = 0;
                        pr.IdInsumo = model.Id;
                    }
                    _dbcontext.InsumosProveedores.AddRange(Proveedores);
                }

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return true;
            }
            catch
            {
                await tx.RollbackAsync();
                throw; // que el Controller traduzca con tu DbErrorHelper
            }
        }



        public async Task<bool> Actualizar(Insumo model)
        {
            await using var tx = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var insumoExistente = await _dbcontext.Insumos
                    .Include(i => i.InsumosUnidadesNegocios)
                    .Include(i => i.InsumosProveedores)
                    .FirstOrDefaultAsync(i => i.Id == model.Id);

                if (insumoExistente == null) return false;

                var entry = _dbcontext.Entry(insumoExistente);
                entry.CurrentValues.SetValues(model);

                var pUsr = entry.Property(nameof(Insumo.IdUsuarioRegistra));
                var pUsrFecha = entry.Property(nameof(Insumo.FechaRegistra));
                pUsr.CurrentValue = pUsr.OriginalValue; pUsr.IsModified = false;
                pUsrFecha.CurrentValue = pUsrFecha.OriginalValue; pUsrFecha.IsModified = false;

                // Unidades
                var nuevosUn = model.InsumosUnidadesNegocios ?? new List<InsumosUnidadesNegocio>();
                var setUn = nuevosUn.Select(x => x.IdUnidadNegocio).ToHashSet();
                var aEliminarUn = insumoExistente.InsumosUnidadesNegocios.Where(x => !setUn.Contains(x.IdUnidadNegocio)).ToList();
                _dbcontext.InsumosUnidadesNegocios.RemoveRange(aEliminarUn);
                foreach (var un in nuevosUn)
                    if (!insumoExistente.InsumosUnidadesNegocios.Any(x => x.IdUnidadNegocio == un.IdUnidadNegocio))
                    { un.Id = 0; un.IdInsumo = model.Id; _dbcontext.InsumosUnidadesNegocios.Add(un); }

                // Proveedores
                var nuevosProv = model.InsumosProveedores ?? new List<InsumosProveedor>();
                var setLp = nuevosProv.Select(x => x.IdListaProveedor).ToHashSet();
                var aEliminarProv = insumoExistente.InsumosProveedores.Where(x => !setLp.Contains(x.IdListaProveedor)).ToList();
                _dbcontext.InsumosProveedores.RemoveRange(aEliminarProv);
                foreach (var pr in nuevosProv)
                    if (!insumoExistente.InsumosProveedores.Any(x => x.IdListaProveedor == pr.IdListaProveedor))
                    { pr.Id = 0; pr.IdInsumo = model.Id; _dbcontext.InsumosProveedores.Add(pr); }

                await _dbcontext.SaveChangesAsync();
                await tx.CommitAsync();
                return true;
            }
            catch
            {
                await tx.RollbackAsync();
                throw; // <-- dejamos que lo maneje el controller
            }
        }

        public async Task<bool> Eliminar(int id)
        {
            try
            {
                var model = await _dbcontext.Insumos.FirstAsync(c => c.Id == id);
                _dbcontext.Insumos.Remove(model);
                await _dbcontext.SaveChangesAsync();
                return true;
            }
            catch
            {
                throw; // <-- que el controller mapee el mensaje
            }
        }


        public async Task<Insumo> Obtener(int id)
        {
            return await _dbcontext.Insumos
                .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation) // <-- FALTABA ESTO
                        .ThenInclude(lp => lp.IdProveedorNavigation) // <-- OPCIONAL si querés también el nombre del proveedor
                .Include(x => x.InsumosUnidadesNegocios)
                    .ThenInclude(x => x.IdUnidadNegocioNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                        .Include(p => p.IdUsuarioModificaNavigation)
                .FirstOrDefaultAsync(x => x.Id == id);
        }


        public async Task<IQueryable<Insumo>> ObtenerTodos()
        {

            IQueryable<Insumo> query = _dbcontext.Insumos
                 .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation) // <-- FALTABA ESTO
                        .ThenInclude(lp => lp.IdProveedorNavigation) // <-- OPCIONAL si querés también el nombre del proveedor
                .Include(x => x.InsumosUnidadesNegocios)
                    .ThenInclude(x => x.IdUnidadNegocioNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                        .Include(p => p.IdUsuarioModificaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation);

            return await Task.FromResult(query);
        }

        public async Task<IQueryable<Insumo>> ObtenerPorProveedor(int idProveedor)
        {
            var query = _dbcontext.Insumos
                .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation)
                        .ThenInclude(lp => lp.IdProveedorNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                        .Include(p => p.IdUsuarioModificaNavigation)
                .Where(c => c.InsumosProveedores.Any(p =>
                    p.IdListaProveedorNavigation != null &&
                    p.IdListaProveedorNavigation.IdProveedor == idProveedor));

            return await Task.FromResult(query);
        }

        public async Task<IQueryable<Insumo>> ObtenerPorUnidadNegocio(int idUnidadNegocio)
        {
            var query = _dbcontext.Insumos
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.InsumosProveedores)
                    .ThenInclude(p => p.IdListaProveedorNavigation)
                        .ThenInclude(lp => lp.IdProveedorNavigation)
                .Include(x => x.InsumosUnidadesNegocios)
                    .ThenInclude(un => un.IdUnidadNegocioNavigation)
                .Include(x => x.IdCategoriaNavigation)
                .Include(x => x.IdUnidadMedidaNavigation)
                .Include(p => p.IdUsuarioRegistraNavigation)
                        .Include(p => p.IdUsuarioModificaNavigation)
                .Where(c => c.InsumosUnidadesNegocios
                    .Any(un => un.IdUnidadNegocio == idUnidadNegocio || idUnidadNegocio == -1));

            return await Task.FromResult(query);
        }




    }
}
