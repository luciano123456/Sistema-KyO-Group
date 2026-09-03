namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMUsuarioConexion
    {
        public int Id { get; set; }
        public int IdUsuario { get; set; }
        public byte Tipo { get; set; }
        public string TipoNombre { get; set; } = "";
        public DateTime Fecha { get; set; }
        public string? Detalle { get; set; }
    }

    public class VMUsuarioConexionHistorial
    {
        public int IdUsuario { get; set; }
        public string Usuario { get; set; } = "";
        public string NombreCompleto { get; set; } = "";
        public bool EnLinea { get; set; }
        public DateTime? FechaUltimaActividad { get; set; }
        public int TotalConexiones { get; set; }
        public int TotalDesconexiones { get; set; }
        public List<VMUsuarioConexion> Eventos { get; set; } = new();
    }
}
