using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication;
using Newtonsoft.Json;
using SistemaKyoGroup.Application.Models.ViewModels;
using System.Security.Claims;

public class SessionHelper
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public SessionHelper(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    // Método asincróKyoGroup para obtener el usuario de la sesión
    public async Task<VMUser> ObtenerUsuarioSistemaAsync()
    {
        return await SessionHelper.GetUsuarioSesion(_httpContextAccessor.HttpContext);
    }

    /// <summary>
    /// Establecer un usuario en la sesión del sistema
    /// </summary>
    public static async Task SetUsuarioSesion(VMUser usuario, HttpContext context)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, usuario.Usuario),
            new Claim("UserData", JsonConvert.SerializeObject(usuario))
        };

        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var claimsPrincipal = new ClaimsPrincipal(claimsIdentity);

        // Establecer la cookie de autenticación
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, claimsPrincipal);
    }

    // Cerrar sesión
    public static async Task CerrarSession(HttpContext context)
    {
        await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }

    /// <summary>
    /// Obtener el usuario desde la sesión
    /// </summary>
    public static async Task<VMUser> GetUsuarioSesion(HttpContext context)
    {
        var userData = context.User.Claims.FirstOrDefault(c => c.Type == "UserData")?.Value;

        if (string.IsNullOrEmpty(userData))
        {
            return null; // No hay sesión activa
        }

        return JsonConvert.DeserializeObject<VMUser>(userData);
    }
}
