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

        public async Task<bool> Insertar(Models.Insumo model)
        {
            using var transaction = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                // Extraer relaciones antes de agregar el Insumo
                var unidadesNegocio = model.InsumosUnidadesNegocios ?? new List<InsumosUnidadesNegocio>();
                var proveedores = model.InsumosProveedores?
                    .GroupBy(p => new { p.IdProveedor, p.IdListaProveedor })
                    .Select(g => g.First()) // eliminar duplicados
                    .ToList() ?? new List<InsumosProveedor>();

                // Evitar que EF intente insertar automáticamente las relaciones
                model.InsumosUnidadesNegocios = null;
                model.InsumosProveedores = null;

                // Insertar Insumo base
                _dbcontext.Insumos.Add(model);
                await _dbcontext.SaveChangesAsync();

                // Insertar Unidades de Negocio
                foreach (var unidad in unidadesNegocio)
                {
                    unidad.Id = 0;
                    unidad.IdInsumo = model.Id;
                    _dbcontext.InsumosUnidadesNegocios.Add(unidad);
                }

                // Insertar Proveedores asignados
                foreach (var proveedor in proveedores)
                {
                    proveedor.Id = 0;
                    proveedor.IdInsumo = model.Id;
                    _dbcontext.InsumosProveedores.Add(proveedor);
                }

                await _dbcontext.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }


        public async Task<bool> Actualizar(Insumo model)
        {
            await using var transaction = await _dbcontext.Database.BeginTransactionAsync();
            try
            {
                var insumoExistente = await _dbcontext.Insumos
                    .Include(i => i.InsumosUnidadesNegocios)
                    .Include(i => i.InsumosProveedores)
                    .FirstOrDefaultAsync(i => i.Id == model.Id);

                if (insumoExistente == null) return false;

                // Copia escalares del modelo
                var entry = _dbcontext.Entry(insumoExistente);
                entry.CurrentValues.SetValues(model);

                // ⛔ No tocar IdUsuarioRegistra
                // (Ajustá el nombre si tu propiedad se llama distinto)
                var pUsr = entry.Property(nameof(Insumo.IdUsuarioRegistra));
                var pUsrFecha = entry.Property(nameof(Insumo.FechaRegistra));

                pUsr.CurrentValue = pUsr.OriginalValue;       // no tocar
                pUsr.IsModified = false;

                pUsrFecha.CurrentValue = pUsrFecha.OriginalValue;  // no tocar
                pUsrFecha.IsModified = false;


                // === UNIDADES DE NEGOCIO ===
                var nuevosUnidades = model.InsumosUnidadesNegocios ?? new List<InsumosUnidadesNegocio>();
                var idsUnidadesNuevos = nuevosUnidades.Select(x => x.IdUnidadNegocio).ToHashSet();

                var unidadesAEliminar = insumoExistente.InsumosUnidadesNegocios
                    .Where(x => !idsUnidadesNuevos.Contains(x.IdUnidadNegocio))
                    .ToList();
                _dbcontext.InsumosUnidadesNegocios.RemoveRange(unidadesAEliminar);

                foreach (var unidad in nuevosUnidades)
                {
                    if (!insumoExistente.InsumosUnidadesNegocios.Any(x => x.IdUnidadNegocio == unidad.IdUnidadNegocio))
                    {
                        unidad.Id = 0;
                        unidad.IdInsumo = model.Id;
                        _dbcontext.InsumosUnidadesNegocios.Add(unidad);
                    }
                }

                // === PROVEEDORES ASIGNADOS ===
                var nuevosProveedores = model.InsumosProveedores ?? new List<InsumosProveedor>();
                var idsListaNuevos = nuevosProveedores.Select(x => x.IdListaProveedor).ToHashSet();

                var proveedoresAEliminar = insumoExistente.InsumosProveedores
                    .Where(x => !idsListaNuevos.Contains(x.IdListaProveedor))
                    .ToList();
                _dbcontext.InsumosProveedores.RemoveRange(proveedoresAEliminar);

                foreach (var proveedor in nuevosProveedores)
                {
                    if (!insumoExistente.InsumosProveedores.Any(x => x.IdListaProveedor == proveedor.IdListaProveedor))
                    {
                        proveedor.Id = 0;
                        proveedor.IdInsumo = model.Id;
                        // (estas dos eran redundantes)
                        // proveedor.IdListaProveedor = proveedor.IdListaProveedor;
                        // proveedor.IdProveedor      = proveedor.IdProveedor;
                        _dbcontext.InsumosProveedores.Add(proveedor);
                    }
                }

                await _dbcontext.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return false;
            }
        }



        public async Task<bool> Eliminar(int id)
        {
            Models.Insumo model = _dbcontext.Insumos.First(c => c.Id == id);
            _dbcontext.Insumos.Remove(model);
            await _dbcontext.SaveChangesAsync();
            return true;
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
