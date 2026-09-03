namespace SistemaKyoGroup.Models.Common
{
    public class DeleteDependencia
    {
        public string Entidad { get; set; } = "";
        public int Cantidad { get; set; }
        public string Detalle { get; set; } = "";
        public bool Cascadeable { get; set; } = true;
    }

    public class DeleteResult
    {
        public bool Ok { get; set; }
        public string Mensaje { get; set; } = "";
        public string Tipo { get; set; } = "info";
        public bool CascadeDisponible { get; set; }
        public List<DeleteDependencia> Dependencias { get; set; } = new();

        public static DeleteResult Success(string mensaje = "Eliminado correctamente.")
            => new() { Ok = true, Mensaje = mensaje, Tipo = "success" };

        public static DeleteResult NotFound(string entidad = "el registro")
            => new() { Ok = false, Mensaje = $"No se encontró {entidad}.", Tipo = "validacion" };

        public static DeleteResult Error(string mensaje, string tipo = "error")
            => new() { Ok = false, Mensaje = mensaje, Tipo = tipo };

        public static DeleteResult Relacion(
            string mensaje,
            IEnumerable<DeleteDependencia> dependencias,
            bool cascadeDisponible = true)
            => new()
            {
                Ok = false,
                Mensaje = mensaje,
                Tipo = "relacion",
                CascadeDisponible = cascadeDisponible,
                Dependencias = dependencias?.ToList() ?? new List<DeleteDependencia>()
            };
    }
}
