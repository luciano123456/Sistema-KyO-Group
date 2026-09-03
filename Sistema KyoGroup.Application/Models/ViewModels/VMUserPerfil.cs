namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMUserPerfil
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = "";
        public string Apellido { get; set; } = "";
        public string? Dni { get; set; }
        public string? Telefono { get; set; }
        public string? Direccion { get; set; }
        public string Contrasena { get; set; } = "";
        public string? ContrasenaNueva { get; set; }
    }
}
