using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Helpers;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;
using System.Diagnostics;
using System.Linq;
using System.Text.RegularExpressions;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class UsuariosController : Controller
    {
        private static readonly HashSet<string> AvatarIconosPermitidos = new(StringComparer.OrdinalIgnoreCase)
        {
            "user", "smile-o", "star", "heart", "leaf", "car", "plane", "bicycle",
            "coffee", "music", "gamepad", "paw", "rocket", "home", "briefcase",
            "graduation-cap", "diamond", "fire"
        };

        private static readonly Regex HexColorRegex = new(@"^#([0-9A-Fa-f]{6})$", RegexOptions.Compiled);

        private readonly IUsuariosService _Usuarioservice;
        private readonly IUsuariosConexionesService _conexiones;
        private readonly IWebHostEnvironment _env;

        public UsuariosController(
            IUsuariosService Usuarioservice,
            IUsuariosConexionesService conexiones,
            IWebHostEnvironment env)
        {
            _Usuarioservice = Usuarioservice;
            _conexiones = conexiones;
            _env = env;
        }

        /// <summary>Endpoint liviano: presencia + módulo + avatar (para refrescar grilla sin reload).</summary>
        [HttpGet]
        public async Task<IActionResult> Presencia()
        {
            var rows = await _conexiones.ListarPresenciaAsync();
            return Ok(rows.Select(r => new
            {
                r.Id,
                r.EnLinea,
                r.UltimoModulo,
                r.Nombre,
                r.Apellido,
                r.AvatarColor,
                r.AvatarIcono,
                r.AvatarFoto
            }).ToList());
        }

        /// <summary>Quién está online en el mismo módulo (widget de esquina).</summary>
        [HttpGet]
        public async Task<IActionResult> PresenciaModulo(string? modulo)
        {
            if (!int.TryParse(User.FindFirst("Id")?.Value, out var userId))
                return Unauthorized();

            var key = UsuariosConexionesService.SanitizeModulo(modulo);
            if (key == null)
                return Ok(Array.Empty<object>());

            var rows = await _conexiones.ListarPresenciaAsync();
            var lista = rows
                .Where(r => r.EnLinea
                    && r.Id != userId
                    && string.Equals(r.UltimoModulo, key, StringComparison.OrdinalIgnoreCase))
                .OrderBy(r => r.Nombre)
                .ThenBy(r => r.Apellido)
                .Take(20)
                .Select(r => new
                {
                    r.Id,
                    r.Nombre,
                    r.Apellido,
                    r.AvatarColor,
                    r.AvatarIcono,
                    r.AvatarFoto,
                    UltimoModulo = key
                })
                .ToList();

            return Ok(lista);
        }

        [HttpGet]
        public async Task<IActionResult> HistorialConexiones(int id, int take = 100)
        {
            var user = await _Usuarioservice.Obtener(id);
            if (user == null) return NotFound();

            var eventos = await _conexiones.HistorialAsync(id, take);
            static string NombreTipo(byte t) => t switch
            {
                UsuariosConexion.TipoConecto => "Conectó",
                UsuariosConexion.TipoDesconecto => "Desconectó",
                UsuariosConexion.TipoExpiro => "Sesión expirada",
                _ => "Evento"
            };

            var vm = new VMUsuarioConexionHistorial
            {
                IdUsuario = user.Id,
                Usuario = user.Usuario ?? "",
                NombreCompleto = $"{user.Nombre} {user.Apellido}".Trim(),
                EnLinea = _conexiones.EstaEnLinea(user.FechaUltimaActividad),
                FechaUltimaActividad = ComoUtc(user.FechaUltimaActividad),
                TotalConexiones = eventos.Count(e => e.Tipo == UsuariosConexion.TipoConecto),
                TotalDesconexiones = eventos.Count(e => e.Tipo == UsuariosConexion.TipoDesconecto || e.Tipo == UsuariosConexion.TipoExpiro),
                Eventos = eventos.Select(e => new VMUsuarioConexion
                {
                    Id = e.Id,
                    IdUsuario = e.IdUsuario,
                    Tipo = e.Tipo,
                    TipoNombre = NombreTipo(e.Tipo),
                    Fecha = ComoUtc(e.Fecha),
                    // Ip queda solo en BD / logs; no se expone en la UI.
                    Detalle = e.Detalle
                }).ToList()
            };

            return Ok(vm);
        }

        private static DateTime ComoUtc(DateTime value)
            => DateTime.SpecifyKind(value, DateTimeKind.Utc);

        private static DateTime? ComoUtc(DateTime? value)
            => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;

        [AllowAnonymous]
        public IActionResult Index() => View();

        [AllowAnonymous]
        public IActionResult Configuracion() => View();

        [HttpGet]
        public async Task<IActionResult> MiPerfil()
        {
            if (!int.TryParse(User.FindFirst("Id")?.Value, out var userId))
                return Unauthorized();

            var user = await _Usuarioservice.Obtener(userId);
            if (user == null)
                return NotFound();

            return Ok(new
            {
                user.Id,
                user.Usuario,
                user.Nombre,
                user.Apellido,
                user.Dni,
                user.Telefono,
                user.Direccion,
                user.AvatarColor,
                user.AvatarIcono,
                user.AvatarFoto
            });
        }

        [HttpPut]
        public async Task<IActionResult> ActualizarAvatar([FromBody] VMUserAvatar model)
        {
            if (!int.TryParse(User.FindFirst("Id")?.Value, out var userId))
                return Unauthorized();

            var userbase = await _Usuarioservice.Obtener(userId);
            if (userbase == null)
                return NotFound();

            if (!string.IsNullOrWhiteSpace(model.AvatarColor))
            {
                var color = model.AvatarColor.Trim();
                if (!HexColorRegex.IsMatch(color))
                    return Ok(new { valor = "Validacion", mensaje = "Color invalido." });
                userbase.AvatarColor = color.ToLowerInvariant();
            }

            if (!string.IsNullOrWhiteSpace(model.AvatarIcono))
            {
                var icono = model.AvatarIcono.Trim().ToLowerInvariant();
                if (icono.StartsWith("fa-"))
                    icono = icono[3..];
                if (!AvatarIconosPermitidos.Contains(icono))
                    return Ok(new { valor = "Validacion", mensaje = "Icono no permitido." });
                userbase.AvatarIcono = icono;
            }

            var ok = await _Usuarioservice.Actualizar(userbase);
            if (!ok)
                return Ok(new { valor = "Error" });

            return Ok(new
            {
                valor = "OK",
                userbase.AvatarColor,
                userbase.AvatarIcono,
                userbase.AvatarFoto
            });
        }

        [HttpPost]
        [RequestSizeLimit(3_000_000)]
        public async Task<IActionResult> SubirAvatarFoto(IFormFile file)
        {
            if (!int.TryParse(User.FindFirst("Id")?.Value, out var userId))
                return Unauthorized();

            if (file == null || file.Length == 0)
                return Ok(new { valor = "Validacion", mensaje = "Selecciona una imagen." });

            if (file.Length > 2_500_000)
                return Ok(new { valor = "Validacion", mensaje = "La imagen no puede superar 2.5 MB." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
            if (!allowed.Contains(ext))
                return Ok(new { valor = "Validacion", mensaje = "Formatos permitidos: JPG, PNG, WEBP o GIF." });

            var contentType = (file.ContentType ?? "").ToLowerInvariant();
            if (!contentType.StartsWith("image/"))
                return Ok(new { valor = "Validacion", mensaje = "El archivo debe ser una imagen." });

            var userbase = await _Usuarioservice.Obtener(userId);
            if (userbase == null)
                return NotFound();

            try
            {
                var folder = Path.Combine(_env.WebRootPath, "Uploads", "Avatares");
                Directory.CreateDirectory(folder);

                EliminarArchivoAvatar(userbase.AvatarFoto);

                var fileName = $"u_{userId}_{Guid.NewGuid():N}{ext}";
                var physical = Path.Combine(folder, fileName);
                await using (var fs = new FileStream(physical, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await file.CopyToAsync(fs);
                }

                userbase.AvatarFoto = $"/Uploads/Avatares/{fileName}";
                var ok = await _Usuarioservice.Actualizar(userbase);
                if (!ok)
                {
                    try { System.IO.File.Delete(physical); } catch { /* ignore */ }
                    return Ok(new { valor = "Error", mensaje = "No se pudo guardar la foto." });
                }

                return Ok(new
                {
                    valor = "OK",
                    userbase.AvatarFoto,
                    userbase.AvatarColor,
                    userbase.AvatarIcono
                });
            }
            catch
            {
                return Ok(new { valor = "Error", mensaje = "No se pudo subir la foto." });
            }
        }

        [HttpDelete]
        public async Task<IActionResult> EliminarAvatarFoto()
        {
            if (!int.TryParse(User.FindFirst("Id")?.Value, out var userId))
                return Unauthorized();

            var userbase = await _Usuarioservice.Obtener(userId);
            if (userbase == null)
                return NotFound();

            EliminarArchivoAvatar(userbase.AvatarFoto);
            userbase.AvatarFoto = null;

            var ok = await _Usuarioservice.Actualizar(userbase);
            if (!ok)
                return Ok(new { valor = "Error", mensaje = "No se pudo quitar la foto." });

            return Ok(new
            {
                valor = "OK",
                AvatarFoto = (string?)null,
                userbase.AvatarColor,
                userbase.AvatarIcono
            });
        }

        private void EliminarArchivoAvatar(string? avatarFoto)
        {
            if (string.IsNullOrWhiteSpace(avatarFoto))
                return;

            try
            {
                var relative = avatarFoto.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                if (!relative.StartsWith($"Uploads{Path.DirectorySeparatorChar}Avatares{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase))
                    return;

                var physical = Path.Combine(_env.WebRootPath, relative);
                if (System.IO.File.Exists(physical))
                    System.IO.File.Delete(physical);
            }
            catch
            {
                // No bloquea el flujo si no se puede borrar el archivo viejo.
            }
        }

        [HttpPut]
        public async Task<IActionResult> ActualizarPerfil([FromBody] VMUserPerfil model)
        {
            if (!int.TryParse(User.FindFirst("Id")?.Value, out var userId))
                return Unauthorized();

            if (model.Id != userId)
                return Ok(new { valor = "Error", mensaje = "No puede modificar otro usuario." });

            if (string.IsNullOrWhiteSpace(model.Nombre) || string.IsNullOrWhiteSpace(model.Apellido))
                return Ok(new { valor = "Validacion", mensaje = "Nombre y apellido son obligatorios." });

            var userbase = await _Usuarioservice.Obtener(userId);
            if (userbase == null)
                return NotFound();

            var passwordHasher = new PasswordHasher<User>();
            var verify = passwordHasher.VerifyHashedPassword(null, userbase.Contrasena, model.Contrasena ?? "");
            if (verify != PasswordVerificationResult.Success)
                return Ok(new { valor = "Contrasena" });

            userbase.Nombre = model.Nombre.Trim();
            userbase.Apellido = model.Apellido.Trim();
            userbase.Dni = string.IsNullOrWhiteSpace(model.Dni) ? null : model.Dni.Trim();
            userbase.Telefono = string.IsNullOrWhiteSpace(model.Telefono) ? "" : model.Telefono.Trim();
            userbase.Direccion = string.IsNullOrWhiteSpace(model.Direccion) ? "" : model.Direccion.Trim();

            if (!string.IsNullOrWhiteSpace(model.ContrasenaNueva))
                userbase.Contrasena = passwordHasher.HashPassword(null, model.ContrasenaNueva);

            var ok = await _Usuarioservice.Actualizar(userbase);
            if (!ok)
                return Ok(new { valor = "Error" });

            return Ok(new
            {
                valor = "OK",
                userbase.Nombre,
                userbase.Apellido
            });
        }

        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            try
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
            catch (Exception)
            {
                return Ok(null);
            }
        }

        [HttpGet]
        public async Task<IActionResult> ListaPaginada()
        {
            try
            {
                var draw = DataTablesRequestHelper.GetDraw(Request);
                var grid = DataTablesRequestHelper.Parse(Request);
                var result = await _Usuarioservice.ListarPaginado(grid);
                var data = result.Items.Select(c => new VMUser
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
                    FechaUltimaActividad = c.FechaUltimaActividad,
                    EnLinea = _conexiones.EstaEnLinea(c.FechaUltimaActividad),
                    UltimoModulo = c.UltimoModulo,
                    AvatarColor = c.AvatarColor,
                    AvatarIcono = c.AvatarIcono,
                    AvatarFoto = c.AvatarFoto,
                }).ToList();

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
                return Ok(new { draw = 0, recordsTotal = 0, recordsFiltered = 0, data = Array.Empty<VMUser>() });
            }
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
                Contrasena = passwordHasher.HashPassword(null, model.Contrasena),
                IdUsuarioAccion = User.GetUserId()
            };

            bool respuesta = await _Usuarioservice.Insertar(Usuario);

            if (respuesta && model.Unidades?.Any() == true)
            {
                var creado = await _Usuarioservice.ObtenerUsuario(model.Usuario);
                if (creado != null)
                {
                    var unidades = model.Unidades
                        .Where(x => x.Enabled)
                        .Select(x => x.IdUnidadNegocio)
                        .Distinct()
                        .ToList();

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
            userbase.IdUsuarioAccion = User.GetUserId();

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
        public async Task<IActionResult> Eliminar(int id, bool cascade = false)
        {
            var sr = await DeleteOperationHelper.ExecuteDeleteAsync(
                c => _Usuarioservice.Eliminar(id, c),
                "el usuario",
                cascade,
                id);
            return Ok(sr.ToEliminarJson());
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

            var localesPorUnidad = locales
                .Where(l => l.IdLocalNavigation != null)
                .GroupBy(l => l.IdLocalNavigation.IdUnidadNegocio)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(x => x.IdLocal)
                          .Where(id => id > 0)
                          .ToList()
                );

            var vm = unidades.Select(u =>
            {
                int idU = u.IdUnidadNegocio;
                localesPorUnidad.TryGetValue(idU, out List<int>? lst);
                bool todos = (lst == null) || (lst.Count == 0);

                return new VMUnidadAsignada
                {
                    IdUnidadNegocio = idU,
                    Enabled = true,
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
