using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Diagnostics;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class UsuariosController : Controller
    {
        private readonly IUsuariosService _Usuarioservice;
        private readonly SessionHelper _sessionHelper;  // si lo usás, inyectalo por ctor

        public UsuariosController(IUsuariosService Usuarioservice /*, SessionHelper sessionHelper*/)
        {
            _Usuarioservice = Usuarioservice;
            //_sessionHelper = sessionHelper;
        }

        [AllowAnonymous]
        public IActionResult Index() => View();

        public async Task<IActionResult> Configuracion()
        {
            var userSession = await SessionHelper.GetUsuarioSesion(HttpContext);
            if (userSession == null) return RedirectToAction("Login", "Index");

            var user = await _Usuarioservice.Obtener(userSession.Id);
            if (user == null) return RedirectToAction("Login", "Index");

            return View(user);
        }

        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var Usuarios = await _Usuarioservice.ObtenerTodos();

            var lista = Usuarios.Select(c => new VMUser
            {
                Id = c.Id,
                Usuario = c.Usuario,
                Nombre = c.Nombre,
                Apellido = c.Apellido,
                Dni = c.Dni,
                Telefono = c.Telefono,
                Direccion = c.Direccion,
                IdRol = c.IdRol,
                Rol = c.IdRolNavigation.Nombre,
                IdEstado = c.IdEstado,
                Estado = c.IdEstadoNavigation.Nombre,
            }).ToList();

            return Ok(lista);
        }

        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMUser model)
        {
            var passwordHasher = new PasswordHasher<User>();

            var Usuario = new User
            {
                Usuario = model.Usuario,
                Nombre = model.Nombre,
                Apellido = model.Apellido,
                Dni = model.Dni,
                Telefono = model.Telefono,
                Direccion = model.Direccion,
                IdRol = model.IdRol,
                IdEstado = model.IdEstado,
                Contrasena = passwordHasher.HashPassword(null, model.Contrasena)
            };

            bool respuesta = await _Usuarioservice.Insertar(Usuario);

            if (respuesta && model.Unidades?.Any() == true)
            {
                var creado = await _Usuarioservice.ObtenerUsuario(model.Usuario);
                if (creado != null)
                {
                    // Solo unidades habilitadas
                    var unidades = model.Unidades
                        .Where(x => x.Enabled)
                        .Select(x => x.IdUnidadNegocio)
                        .Distinct()
                        .ToList();

                    // Subset de locales (solo cuando NO es todos)
                    var localesPorUnidad = model.Unidades
                        .Where(x => x.Enabled && !x.TodosLocales && x.LocalesIds != null && x.LocalesIds.Count > 0)
                        .ToDictionary(
                            x => x.IdUnidadNegocio,
                            x => (IReadOnlyCollection<int>)x.LocalesIds.Distinct().ToList()
                        );

                    await _Usuarioservice.GuardarAsignaciones(creado.Id, unidades, localesPorUnidad);
                }
            }

            return Ok(new { valor = respuesta });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMUser model)
        {
            var passwordHasher = new PasswordHasher<User>();
            var userbase = await _Usuarioservice.Obtener(model.Id);
            var nombreUsuario = await _Usuarioservice.ObtenerUsuario(model.Usuario);

            if (nombreUsuario != null && nombreUsuario.Id != model.Id)
                return Ok(new { valor = "Usuario" });

            if (model.CambioAdmin != 1)
            {
                var result = passwordHasher.VerifyHashedPassword(null, userbase.Contrasena, model.Contrasena);
                if (result != PasswordVerificationResult.Success)
                    return Ok(new { valor = "Contrasena" });
            }

            var passnueva = !string.IsNullOrEmpty(model.ContrasenaNueva)
                ? passwordHasher.HashPassword(null, model.ContrasenaNueva)
                : userbase.Contrasena;

            userbase.Nombre = model.Nombre;
            userbase.Usuario = model.Usuario;
            userbase.Apellido = model.Apellido;
            userbase.Dni = model.Dni;
            userbase.Telefono = model.Telefono;
            userbase.Direccion = model.Direccion;
            userbase.IdRol = model.IdRol;
            userbase.IdEstado = model.IdEstado;
            userbase.Contrasena = passnueva;

            bool ok = await _Usuarioservice.Actualizar(userbase);

            if (ok)
            {
                var unidades = model.Unidades
                    .Where(x => x.Enabled)
                    .Select(x => x.IdUnidadNegocio)
                    .Distinct()
                    .ToList();

                var localesPorUnidad = model.Unidades
                    .Where(x => x.Enabled && !x.TodosLocales && x.LocalesIds != null)
                    .ToDictionary(
                        x => x.IdUnidadNegocio,
                        x => (IReadOnlyCollection<int>)x.LocalesIds.Distinct().ToList()
                    );

                await _Usuarioservice.GuardarAsignaciones(userbase.Id, unidades, localesPorUnidad);
            }

            return Ok(new { valor = ok ? "OK" : "Error" });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id)
        {
            bool respuesta = await _Usuarioservice.Eliminar(id);
            return StatusCode(StatusCodes.Status200OK, new { valor = respuesta });
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var Usuario = await _Usuarioservice.Obtener(id);
            if (Usuario != null) return StatusCode(StatusCodes.Status200OK, Usuario);
            return StatusCode(StatusCodes.Status404NotFound);
        }

        [HttpGet]
        public async Task<IActionResult> Asignaciones(int idUsuario)
        {
            var unidades = await _Usuarioservice.ObtenerUnidadesDeUsuario(idUsuario);
            var locales = await _Usuarioservice.ObtenerLocalesDeUsuario(idUsuario);

            // Agrupo locales por unidad (desde la navegación del Local)
            var localesPorUnidad = locales
                .Where(l => l.IdLocalNavigation != null)
                .GroupBy(l => l.IdLocalNavigation.IdUnidadNegocio)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(x => x.IdLocal)
                          .Where(id => id > 0)
                          .ToList()
                );

            // Devuelvo SOLO las unidades asignadas (Enabled = true).
            // El front tiene el catálogo completo y pinta todas; las no listadas acá quedan con Enabled=false por defecto.
            var vm = unidades.Select(u =>
            {
                int idU = u.IdUnidadNegocio;
                localesPorUnidad.TryGetValue(idU, out List<int>? lst);
                bool todos = (lst == null) || (lst.Count == 0);

                return new VMUnidadAsignada
                {
                    IdUnidadNegocio = idU,
                    Enabled = true,               // está asignada
                    TodosLocales = todos,
                    LocalesIds = lst ?? new List<int>(),
                    NombreUnidad = u.IdUnidadNegocioNavigation?.Nombre
                };
            }).ToList();

            return Ok(vm);
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
