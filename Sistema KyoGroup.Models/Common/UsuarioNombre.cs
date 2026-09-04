namespace SistemaKyoGroup.Models.Common
{
    public static class UsuarioNombre
    {
        /// <summary>Nombre visible del usuario: nombre y apellido, o el login si están vacíos.</summary>
        public static string? Mostrar(User? usuario)
        {
            if (usuario == null) return null;

            var nombre = string.Join(' ', new[] { usuario.Nombre, usuario.Apellido }
                .Where(s => !string.IsNullOrWhiteSpace(s))).Trim();

            return string.IsNullOrWhiteSpace(nombre) ? usuario.Usuario : nombre;
        }
    }
}
