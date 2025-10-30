using System;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMProveedor
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Apodo { get; set; }
        public string? Ubicacion { get; set; }
        public string? Telefono { get; set; }
        public string? Cbu { get; set; }
        public string? Cuit { get; set; }
        public int IdUsuarioRegistra { get; set; }
        public DateTime FechaRegistra { get; set; }
        public int? IdUsuarioModifica { get; set; }
        public DateTime? FechaModifica { get; set; }

        // NUEVOS (opcionales, para mostrar nombres en el modal)
        public string? UsuarioRegistra { get; set; }
        public string? UsuarioModifica { get; set; }
    }
}