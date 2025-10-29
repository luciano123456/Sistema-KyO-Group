using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace SistemaKyoGroup.Application.Middleware
{
    public class SessionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly List<string> _allowedPaths = new() { "/Login", "/Clientes/AccessDenied" };

        public SessionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task Invoke(HttpContext context)
        {
            // Verifica si el usuario ya está logueado (por ejemplo, si existe el UserId en la sesión)
            var userId = context.Session.GetString("UserId");

            // Si el usuario no está logueado y está intentando acceder a algo diferente de /Login, redirige al login
            if (string.IsNullOrEmpty(userId) && !context.Request.Path.StartsWithSegments("/Login") && !context.Request.Path.StartsWithSegments("/Clientes/AccessDenied"))
            {
                context.Response.Redirect("/Login/Index");
                return;
            }
            // Si el usuario está logueado y está intentando acceder a la página de Login, redirige al Home
            else if (!string.IsNullOrEmpty(userId) && context.Request.Path.StartsWithSegments("/Login"))
            {
                context.Response.Redirect("/Clientes/Index");
                return;
            }

            // Si está logueado o no está intentando acceder a /Login, continúa con el siguiente middleware
            await _next(context);
        }

    }
}
