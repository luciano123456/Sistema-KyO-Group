using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Diagnostics;

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
                var insumos = await _InsumosService.ObtenerTodos();

                var lista = insumos
                    .Where(c => IdUnidadNegocio == -1 || c.InsumosUnidadesNegocios.Any(u => u.IdUnidadNegocio == IdUnidadNegocio))
                    .ToList()
                    .Select(c =>
                    {
                        var proveedorMasBarato = c.InsumosProveedores
                            .Where(p => p.IdListaProveedorNavigation != null && p.IdListaProveedorNavigation.IdProveedorNavigation != null)
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
                                .Select(u => u.IdUnidadNegocioNavigation?.Nombre ?? "")
                                .ToList(),
                            ProveedorDestacado = proveedorMasBarato?.IdListaProveedorNavigation?.IdProveedorNavigation?.Nombre ?? "",
                            CostoUnitario = proveedorMasBarato?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                            PrecioLista = proveedorMasBarato?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
                            CantidadProveedores = c.InsumosProveedores?.Count ?? 0,
                            IdProveedorLista = proveedorMasBarato?.IdListaProveedorNavigation?.Id ?? 0,
                            IdUsuarioRegistra = (int)c.IdUsuarioRegistra,
                            FechaRegistra = (DateTime)c.FechaRegistra,
                            IdUsuarioModifica = c.IdUsuarioModifica,
                            FechaModifica = c.FechaModifica,
                            UsuarioRegistra = c.IdUsuarioRegistraNavigation != null ? c.IdUsuarioRegistraNavigation.Usuario : null,
                            UsuarioModifica = c.IdUsuarioModificaNavigation != null ? c.IdUsuarioModificaNavigation.Usuario : null
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
        public async Task<IActionResult> ListaPorUnidadNegocio(int IdUnidadNegocio)
        {
            try
            {
                // si querés que -1 signifique "todas", podés switchear al ObtenerTodos()
                var insumos = (IdUnidadNegocio == -1)
                    ? await _InsumosService.ObtenerTodos()
                    : await _InsumosService.ObtenerPorUnidadNegocio(IdUnidadNegocio);

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
                                         .FirstOrDefault(p =>
                                             p.IdListaProveedorNavigation != null &&
                                             p.IdListaProveedorNavigation.IdProveedor == IdProveedor);

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
                                         IdProveedorLista = proveedorActual?.IdListaProveedorNavigation?.Id ?? 0
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




        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMInsumo model)
        {
            try
            {
                var userId = User.GetUserId();

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
        public async Task<IActionResult> Eliminar(int id)
        {
            try
            {
                var ok = await _InsumosService.Eliminar(id);
                return Ok(new { valor = ok, mensaje = ok ? "Insumo eliminado correctamente" : "No se pudo eliminar el insumo" });
            }
            catch (Exception ex)
            {
                var msg = DbErrorHelper.FriendlyMessage(ex, "insumo");
                return Ok(new { valor = false, mensaje = msg });
            }
        }


        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var insumo = await _InsumosService.Obtener(id);
            if (insumo == null) return NotFound();

            var vm = new VMInsumo
            {
                Id = insumo.Id,
                Sku = insumo.Sku,
                Descripcion = insumo.Descripcion,
                IdCategoria = insumo.IdCategoria,
                IdUnidadMedida = insumo.IdUnidadMedida,
                FechaActualizacion = insumo.FechaActualizacion,
                IdUsuarioRegistra = (int)insumo.IdUsuarioRegistra,
                FechaRegistra = (DateTime)insumo.FechaRegistra,
                IdUsuarioModifica = insumo.IdUsuarioModifica,
                FechaModifica = insumo.FechaModifica,
                UsuarioRegistra = insumo.IdUsuarioRegistraNavigation != null ? insumo.IdUsuarioRegistraNavigation.Usuario : null,
                UsuarioModifica = insumo.IdUsuarioModificaNavigation != null ? insumo.IdUsuarioModificaNavigation.Usuario : null,
                InsumosProveedores = insumo.InsumosProveedores.Select(p => new InsumosProveedor
                {
                    Id = p.Id,
                    IdProveedor = p.IdProveedor,
                    IdInsumo = p.IdInsumo,
                    IdListaProveedor = p.IdListaProveedor
                }).ToList(),
                InsumosUnidadesNegocios = insumo.InsumosUnidadesNegocios.Select(u => new InsumosUnidadesNegocio
                {
                    IdUnidadNegocio = u.IdUnidadNegocio
                }).ToList()
            };

            return Ok(vm);
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