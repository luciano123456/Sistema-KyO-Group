using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace SistemaKyoGroup.Application.Middleware
{
    public class SessionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly List<string> _allowedPaths = new() { "/Login", "/AccesoDenegado" };

        public SessionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task Invoke(HttpContext context)
        {
            var userId = context.Session.GetString("UserId");

            if (string.IsNullOrEmpty(userId) && !context.Request.Path.StartsWithSegments("/Login") && !context.Request.Path.StartsWithSegments("/AccesoDenegado"))
            {
                context.Response.Redirect("/Login/Index");
                return;
            }
            else if (!string.IsNullOrEmpty(userId) && context.Request.Path.StartsWithSegments("/Login"))
            {
                context.Response.Redirect("/Proveedores");
                return;
            }

            await _next(context);
        }
    }
}
