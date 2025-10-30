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
                            IdUsuarioRegistra = c.IdUsuarioRegistra,
                            FechaRegistra = c.FechaRegistra,
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

            // Id del usuario desde el JWT
            var userId = User.GetUserId();

            var insumo = new Insumo
            {
                Id = model.Id,
                IdUnidadMedida = model.IdUnidadMedida,
                Sku = model.Sku,
                FechaActualizacion = DateTime.Now,
                IdCategoria = model.IdCategoria,
                Descripcion = model.Descripcion,
                IdUsuarioRegistra = (int)userId, // fallback si hicieras pruebas sin token
                FechaRegistra = DateTime.Now,

                InsumosUnidadesNegocios = model.InsumosUnidadesNegocios?.Select(u => new InsumosUnidadesNegocio
                {
                    IdUnidadNegocio = u.IdUnidadNegocio
                }).ToList(),

                InsumosProveedores = model.InsumosProveedores?
                    .GroupBy(p => new { p.IdProveedor, p.IdListaProveedor }) // evita duplicados
                    .Select(g => new InsumosProveedor
                    {
                        IdProveedor = g.Key.IdProveedor,
                        IdListaProveedor = g.Key.IdListaProveedor
                    }).ToList()
            };

            var respuesta = await _InsumosService.Insertar(insumo);

            return Ok(new
            {
                valor = respuesta,
                mensaje = respuesta ? "Insumo registrado correctamente" : "Error al registrar"
            });
        }


        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMInsumo model)
        {
            var userId = User.GetUserId();

            var Insumos = new Insumo
            {
                Id = model.Id,
                IdUnidadMedida = model.IdUnidadMedida,
                Sku = model.Sku,
                FechaActualizacion = DateTime.Now,
                IdCategoria = model.IdCategoria,
                Descripcion = model.Descripcion,
                InsumosProveedores = model.InsumosProveedores,
                InsumosUnidadesNegocios = model.InsumosUnidadesNegocios,
                  IdUsuarioModifica = (int)userId, // fallback si hicieras pruebas sin token
                FechaModifica = DateTime.Now
            };

            bool respuesta = await _InsumosService.Actualizar(Insumos);

            return Ok(new { valor = respuesta });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _InsumosService.Eliminar(id);

            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
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
                IdUsuarioRegistra = insumo.IdUsuarioRegistra,
                FechaRegistra = insumo.FechaRegistra,
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
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}