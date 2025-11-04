using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using System;
using SistemaKyoGroup.Application.Extensions; // <-- importa la extensión

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class ProveedoresController : Controller
    {
        private readonly IProveedoresService _service;

        public ProveedoresController(IProveedoresService service)
        {
            _service = service;
        }

        [AllowAnonymous]
        public IActionResult Index() => View();

        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var query = await _service.ObtenerTodos();
            var lista = query.Select(p => new VMProveedor
            {
                Id = p.Id,
                Nombre = p.Nombre,
                Apodo = p.Apodo,
                Ubicacion = p.Ubicacion,
                Telefono = p.Telefono,
                Cbu = p.Cbu,
                Cuit = p.Cuit,
                IdUsuarioRegistra = (int)p.IdUsuarioRegistra,
                FechaRegistra = (DateTime)p.FechaRegistra,
                IdUsuarioModifica = p.IdUsuarioModifica,
                FechaModifica = p.FechaModifica,
                UsuarioRegistra = p.IdUsuarioRegistraNavigation != null ? p.IdUsuarioRegistraNavigation.Usuario : null,
                UsuarioModifica = p.IdUsuarioModificaNavigation != null ? p.IdUsuarioModificaNavigation.Usuario : null
            }).ToList();

            return Ok(lista);
        }

        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMProveedor model)
        {
            // Id del usuario desde el JWT
            var userId = User.GetUserId();

            var entity = new Proveedor
            {
                Nombre = model.Nombre,
                Apodo = model.Apodo,
                Ubicacion = model.Ubicacion,
                Telefono = model.Telefono,
                Cbu = model.Cbu,
                Cuit = model.Cuit,
                IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                FechaRegistra = DateTime.Now
            };

            bool ok = await _service.Insertar(entity);
            return Ok(new { valor = ok });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMProveedor model)
        {
            var entity = await _service.Obtener(model.Id);
            if (entity == null) return Ok(new { valor = false });

            var userId = User.GetUserId();

            entity.Nombre = model.Nombre;
            entity.Apodo = model.Apodo;
            entity.Ubicacion = model.Ubicacion;
            entity.Telefono = model.Telefono;
            entity.Cbu = model.Cbu;
            entity.Cuit = model.Cuit;

            entity.IdUsuarioModifica = userId ?? model.IdUsuarioModifica;
            entity.FechaModifica = DateTime.Now;

            bool ok = await _service.Actualizar(entity);
            return Ok(new { valor = ok });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool ok = await _service.Eliminar(id);
            return StatusCode(StatusCodes.Status200OK, new { valor = ok });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var p = await _service.Obtener(id);
            if (p == null) return StatusCode(StatusCodes.Status404NotFound);

            var vm = new VMProveedor
            {
                Id = p.Id,
                Nombre = p.Nombre,
                Apodo = p.Apodo,
                Ubicacion = p.Ubicacion,
                Telefono = p.Telefono,
                Cbu = p.Cbu,
                Cuit = p.Cuit,
                IdUsuarioRegistra = (int)p.IdUsuarioRegistra,
                FechaRegistra = (DateTime)p.FechaRegistra,
                IdUsuarioModifica = p.IdUsuarioModifica,
                FechaModifica = p.FechaModifica,
                UsuarioRegistra = p.IdUsuarioRegistraNavigation?.Usuario,
                UsuarioModifica = p.IdUsuarioModificaNavigation?.Usuario
            };

            return StatusCode(StatusCodes.Status200OK, vm);
        }


        public IActionResult Privacy() => View();

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
