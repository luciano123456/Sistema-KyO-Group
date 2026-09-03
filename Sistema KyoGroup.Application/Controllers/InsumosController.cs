using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Helpers;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using System.Diagnostics;
using System.Linq;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class InsumosController : Controller
    {
        private readonly IInsumoService _InsumosService;

        public InsumosController(IInsumoService InsumosService)
        {
            _InsumosService = InsumosService;
        }

        [AllowAnonymous]
        public IActionResult Index()
        {
            return View();
        }


        [HttpGet]
        public async Task<IActionResult> Lista(int IdUnidadNegocio)
        {
            try
            {
                var insumos = await _InsumosService.ObtenerPorUnidadNegocio(IdUnidadNegocio);

                var lista = insumos
                    .ToList()
                    .Select(c =>
                    {
                        var proveedoresConPrecio = c.InsumosProveedores
                            .Where(p => p.IdListaProveedorNavigation != null
                                        && p.IdListaProveedorNavigation.IdProveedorNavigation != null
                                        && p.IdListaProveedorNavigation.CostoUnitario > 0)
                            .OrderBy(p => p.IdListaProveedorNavigation.CostoUnitario)
                            .ToList();

                        var proveedorMasBarato = proveedoresConPrecio.FirstOrDefault();

                        return new VMInsumo
                        {
                            Id = c.Id,
                            Descripcion = c.Descripcion,
                            Sku = c.Sku,
                            IdCategoria = c.IdCategoria,
                            IdUnidadMedida = c.IdUnidadMedida,
                            FechaActualizacion = c.FechaActualizacion,
                            Categoria = c.IdCategoriaNavigation?.Nombre ?? "",
                            UnidadMedida = c.IdUnidadMedidaNavigation?.Nombre ?? "",
                            UnidadesNegocio = c.InsumosUnidadesNegocios
                                .Select(u => u.IdUnidadNegocioNavigation?.Nombre ?? "")
                                .ToList(),
                            ProveedorDestacado = proveedorMasBarato?.IdListaProveedorNavigation?.IdProveedorNavigation?.Nombre ?? "",
                            CostoUnitario = proveedorMasBarato?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                            PrecioLista = proveedorMasBarato?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                            CantidadProveedores = proveedoresConPrecio.Count,
                            IdProveedorLista = proveedorMasBarato?.IdListaProveedorNavigation?.Id ?? 0,
                            IdUsuarioRegistra = (int)c.IdUsuarioRegistra,
                            FechaRegistra = (DateTime)c.FechaRegistra,
                            IdUsuarioModifica = c.IdUsuarioModifica,
                            FechaModifica = c.FechaModifica,
                            UsuarioRegistra = c.IdUsuarioRegistraNavigation != null ? c.IdUsuarioRegistraNavigation.Usuario : null,
                            UsuarioModifica = c.IdUsuarioModificaNavigation != null ? c.IdUsuarioModificaNavigation.Usuario : null
                        };
                    })
                    // Recetas/SubRecetas: solo insumos con proveedor y precio > 0
                    .Where(x => x.CostoUnitario > 0 && x.IdProveedorLista > 0)
                    .ToList();

                return Ok(lista);
            }
            catch (Exception ex)
            {
                return Ok(null);
            }
        }

        [HttpGet]
        public async Task<IActionResult> ListaPaginada(int IdUnidadNegocio = -1)
        {
            try
            {
                var draw = DataTablesRequestHelper.GetDraw(Request);
                var grid = DataTablesRequestHelper.Parse(Request);
                var result = await _InsumosService.ListarPaginado(IdUnidadNegocio, grid);
                var data = result.Items.Select(c => InsumoVmMapper.ToViewModel(c)).ToList();
                return Ok(new
                {
                    draw,
                    recordsTotal = result.Total,
                    recordsFiltered = result.Filtered,
                    data
                });
            }
            catch
            {
                return Ok(new { draw = 0, recordsTotal = 0, recordsFiltered = 0, data = Array.Empty<VMInsumo>() });
            }
        }

        [HttpGet]
        public async Task<IActionResult> Kpis(int IdUnidadNegocio = -1)
        {
            var (total, sinProveedor) = await _InsumosService.ObtenerKpis(IdUnidadNegocio);
            return Ok(new { total, sinProveedor });
        }

        [HttpGet]
        public async Task<IActionResult> ListaPorUnidadNegocio(int IdUnidadNegocio)
        {
            try
            {
                var insumos = await _InsumosService.ObtenerPorUnidadNegocio(IdUnidadNegocio);

                var lista = insumos
                    .ToList()
                    .Select(c =>
                    {
                        // proveedor más barato disponible para el insumo
                        var proveedorMasBarato = c.InsumosProveedores
                            .Where(p => p.IdListaProveedorNavigation != null &&
                                        p.IdListaProveedorNavigation.IdProveedorNavigation != null)
                            .OrderBy(p => p.IdListaProveedorNavigation.CostoUnitario)
                            .FirstOrDefault();

                        return new VMInsumo
                        {
                            Id = c.Id,
                            Descripcion = c.Descripcion,
                            Sku = c.Sku,
                            IdCategoria = c.IdCategoria,
                            IdUnidadMedida = c.IdUnidadMedida,
                            FechaActualizacion = c.FechaActualizacion,
                            Categoria = c.IdCategoriaNavigation?.Nombre ?? "",
                            UnidadMedida = c.IdUnidadMedidaNavigation?.Nombre ?? "",
                            UnidadesNegocio = c.InsumosUnidadesNegocios
                                .Select(un => un.IdUnidadNegocioNavigation?.Nombre ?? "")
                                .ToList(),
                            ProveedorDestacado = proveedorMasBarato?.IdListaProveedorNavigation?.IdProveedorNavigation?.Nombre ?? "",
                            CostoUnitario = proveedorMasBarato?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                            PrecioLista = proveedorMasBarato?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                            CantidadProveedores = c.InsumosProveedores?.Count ?? 0,
                            IdProveedorLista = proveedorMasBarato?.IdListaProveedorNavigation?.Id ?? 0
                        };
                    })
                    .ToList();

                return Ok(lista);
            }
            catch (Exception ex)
            {
                return Ok(null);
            }
        }

        [HttpGet]
        public async Task<IActionResult> ListaPorProveedor(int IdProveedor)
        {
            try
            {
                var insumos = await _InsumosService.ObtenerPorProveedor(IdProveedor);

                var lista = insumos
                                 .ToList() // <-- importante
                                 .Select(c =>
                                 {
                                     var proveedorActual = c.InsumosProveedores
                                         .Where(p =>
                                             p.IdProveedor == IdProveedor ||
                                             (p.IdListaProveedorNavigation != null &&
                                              p.IdListaProveedorNavigation.IdProveedor == IdProveedor))
                                         .OrderBy(p => p.IdListaProveedorNavigation?.CostoUnitario ?? 0)
                                         .FirstOrDefault();

                                     return new VMInsumo
                                     {
                                         Id = c.Id,
                                         Descripcion = c.Descripcion,
                                         Sku = c.Sku,
                                         IdCategoria = c.IdCategoria,
                                         IdUnidadMedida = c.IdUnidadMedida,
                                         FechaActualizacion = c.FechaActualizacion,
                                         Categoria = c.IdCategoriaNavigation?.Nombre ?? "",
                                         UnidadMedida = c.IdUnidadMedidaNavigation?.Nombre ?? "",
                                         ProveedorDestacado = proveedorActual?.IdListaProveedorNavigation?.IdProveedorNavigation?.Nombre ?? "",
                                         CostoUnitario = proveedorActual?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                                         PrecioLista = proveedorActual?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                                         CantidadProveedores = c.InsumosProveedores?.Count ?? 0,
                                         IdProveedorLista = proveedorActual?.IdListaProveedorNavigation?.Id ?? proveedorActual?.IdListaProveedor ?? 0
                                     };
                                 })
                                 .ToList();
                return Ok(lista);
            }
            catch (Exception ex)
            {
                return Ok(null);
            }
        }


        [HttpGet]
        public async Task<IActionResult> ListaPorUnidadYProveedor(int IdUnidadNegocio, int IdProveedor)
        {
            try
            {
                var insumos = await _InsumosService.ObtenerPorUnidadYProveedor(IdUnidadNegocio, IdProveedor);

                // OC / compras: todos los vinculados al proveedor, con o sin precio (> 0)
                var lista = insumos
                    .ToList()
                    .Select(c =>
                    {
                        var proveedorActual = c.InsumosProveedores
                            .Where(p =>
                                p.IdProveedor == IdProveedor ||
                                (p.IdListaProveedorNavigation != null &&
                                 p.IdListaProveedorNavigation.IdProveedor == IdProveedor)
                            )
                            .OrderByDescending(p => p.IdListaProveedorNavigation?.CostoUnitario ?? 0)
                            .FirstOrDefault();

                        return new VMInsumo
                        {
                            Id = c.Id,
                            Descripcion = c.Descripcion,
                            Sku = c.Sku,
                            Categoria = c.IdCategoriaNavigation?.Nombre ?? "",
                            UnidadMedida = c.IdUnidadMedidaNavigation?.Nombre ?? "",
                            CostoUnitario = proveedorActual?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                            PrecioLista = proveedorActual?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                            CantidadProveedores = 1,
                            IdProveedorLista = proveedorActual?.IdListaProveedorNavigation?.Id ?? proveedorActual?.IdListaProveedor ?? 0
                        };
                    })
                    .OrderBy(x => x.Descripcion)
                    .ToList();

                return Ok(lista);
            }
            catch
            {
                return Ok(null);
            }
        }



        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMInsumo model)
        {
            try
            {
                var userId = User.GetUserId();

                var dup = await _InsumosService.BuscarDuplicado(model.Sku ?? "", model.Descripcion ?? "", 0);
                if (dup != null)
                {
                    return Ok(new
                    {
                        valor = false,
                        tipo = "duplicado",
                        idReferencia = dup.Id,
                        mensaje = $"Ya existe un insumo con el mismo SKU o descripción: {dup.Descripcion}."
                    });
                }

                var entidad = new Insumo
                {
                    Descripcion = model.Descripcion?.Trim(),
                    Sku = model.Sku?.Trim(),
                    IdUnidadMedida = model.IdUnidadMedida,
                    IdCategoria = model.IdCategoria,
                    IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra,
                    FechaRegistra = DateTime.Now,
                    FechaActualizacion = DateTime.Now,
                    // colecciones:
                    InsumosUnidadesNegocios = model.InsumosUnidadesNegocios?.Select(x => new InsumosUnidadesNegocio { IdUnidadNegocio = x.IdUnidadNegocio }).ToList(),
                    InsumosProveedores = model.InsumosProveedores?.Select(x => new InsumosProveedor { IdProveedor = x.IdProveedor, IdListaProveedor = x.IdListaProveedor }).ToList()
                };

                var ok = await _InsumosService.Insertar(entidad);
                return Ok(new { valor = ok, mensaje = ok ? "Insumo registrado correctamente" : "No se pudo registrar el insumo" });
            }
            catch (Exception ex)
            {
                var msg = DbErrorHelper.FriendlyMessage(ex, "insumo");
                return Ok(new { valor = false, mensaje = msg });
            }
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMInsumo model)
        {
            try
            {
                var userId = User.GetUserId();

                var dup = await _InsumosService.BuscarDuplicado(model.Sku ?? "", model.Descripcion ?? "", model.Id);
                if (dup != null)
                {
                    return Ok(new
                    {
                        valor = false,
                        tipo = "duplicado",
                        idReferencia = dup.Id,
                        mensaje = $"Ya existe otro insumo con el mismo SKU o descripción: {dup.Descripcion}."
                    });
                }

                var entidad = new Insumo
                {
                    Id = model.Id,
                    Descripcion = model.Descripcion?.Trim(),
                    Sku = model.Sku?.Trim(),
                    IdUnidadMedida = model.IdUnidadMedida,
                    IdCategoria = model.IdCategoria,
                    IdUsuarioModifica = userId,
                    FechaModifica = DateTime.Now,
                    FechaActualizacion = DateTime.Now,
                    InsumosUnidadesNegocios = model.InsumosUnidadesNegocios?.Select(x => new InsumosUnidadesNegocio { IdUnidadNegocio = x.IdUnidadNegocio }).ToList(),
                    InsumosProveedores = model.InsumosProveedores?.Select(x => new InsumosProveedor { IdProveedor = x.IdProveedor, IdListaProveedor = x.IdListaProveedor }).ToList()
                };

                var ok = await _InsumosService.Actualizar(entidad);
                return Ok(new { valor = ok, mensaje = ok ? "Insumo modificado correctamente" : "No se pudo modificar el insumo" });
            }
            catch (Exception ex)
            {
                var msg = DbErrorHelper.FriendlyMessage(ex, "insumo");
                return Ok(new { valor = false, mensaje = msg });
            }
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id, bool cascade = false)
        {
            var sr = await DeleteOperationHelper.ExecuteDeleteAsync(
                c => _InsumosService.Eliminar(id, c),
                "el insumo",
                cascade,
                id);
            return Ok(sr.ToEliminarJson());
        }


        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            try
            {
                var insumo = await _InsumosService.Obtener(id);
                if (insumo == null) return NotFound();

                return Ok(new
                {
                    Id = insumo.Id,
                    Sku = insumo.Sku,
                    Descripcion = insumo.Descripcion,
                    IdCategoria = insumo.IdCategoria,
                    IdUnidadMedida = insumo.IdUnidadMedida,
                    FechaActualizacion = insumo.FechaActualizacion,
                    IdUsuarioRegistra = insumo.IdUsuarioRegistra,
                    FechaRegistra = insumo.FechaRegistra,
                    IdUsuarioModifica = insumo.IdUsuarioModifica,
                    FechaModifica = insumo.FechaModifica,
                    UsuarioRegistra = insumo.IdUsuarioRegistraNavigation?.Usuario,
                    UsuarioModifica = insumo.IdUsuarioModificaNavigation?.Usuario,
                    InsumosProveedores = (insumo.InsumosProveedores ?? Enumerable.Empty<InsumosProveedor>())
                        .Select(p => new
                        {
                            p.Id,
                            p.IdProveedor,
                            p.IdInsumo,
                            p.IdListaProveedor
                        }).ToList(),
                    InsumosUnidadesNegocios = (insumo.InsumosUnidadesNegocios ?? Enumerable.Empty<InsumosUnidadesNegocio>())
                        .Select(u => new { u.IdUnidadNegocio })
                        .ToList()
                });
            }
            catch (Exception ex)
            {
                return Ok(new { valor = false, mensaje = DbErrorHelper.FriendlyMessage(ex, "insumo") });
            }
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel
            {
                RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier
            });
        }

    }
}