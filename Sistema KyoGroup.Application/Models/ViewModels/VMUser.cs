using System.Collections.Generic;

namespace SistemaKyoGroup.Application.Models.ViewModels
{
    public class VMUser
    {
        public int Id { get; set; }
        public string Usuario { get; set; } = null!;
        public string Nombre { get; set; } = null!;
        public string Apellido { get; set; } = null!;
        public string? Dni { get; set; }
        public string? Telefono { get; set; }
        public string? Direccion { get; set; }
        public int IdRol { get; set; }
        public string Contrasena { get; set; } = null!;
        public string ContrasenaNueva { get; set; } = null!;
        public string Estado { get; set; } = null!;
        public string Rol { get; set; } = null!;
        public int CambioAdmin { get; set; } = 0;
        public int IdEstado { get; set; }

        public List<VMUnidadAsignada> Unidades { get; set; } = new();
    }

    public class VMUnidadAsignada
    {
        public int IdUnidadNegocio { get; set; }
        public bool TodosLocales { get; set; }
        public List<int> LocalesIds { get; set; } = new();

        public string? NombreUnidad { get; set; }
    }
}
