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

        public string? AvatarColor { get; set; }
        public string? AvatarIcono { get; set; }
        public string? AvatarFoto { get; set; }

        /// <summary>Presencia: calculada sobre FechaUltimaActividad con tolerancia de 5 min.</summary>
        public bool EnLinea { get; set; }
        public DateTime? FechaUltimaActividad { get; set; }
        public string? UltimoModulo { get; set; }

        public List<VMUnidadAsignada> Unidades { get; set; } = new();
    }

    public class VMUnidadAsignada
    {
        public int IdUnidadNegocio { get; set; }
        public bool Enabled { get; set; }              // << NUEVO: acceso habilitado a la unidad
        public bool TodosLocales { get; set; }         // true => todos los locales de esa unidad
        public List<int> LocalesIds { get; set; } = new(); // subset explícito (solo si TodosLocales=false)
        public string? NombreUnidad { get; set; }
    }
}
