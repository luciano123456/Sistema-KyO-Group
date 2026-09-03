using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Common
{
    public class ServiceResult
    {
        public bool Ok { get; set; }
        public string Mensaje { get; set; } = "";
        public string Tipo { get; set; } = "info";
        public int? IdReferencia { get; set; }
        public bool CascadeDisponible { get; set; }
        public List<DeleteDependencia> Dependencias { get; set; } = new();

        public static ServiceResult Success(string mensaje = "")
            => new() { Ok = true, Mensaje = mensaje, Tipo = "success" };

        public static ServiceResult Error(
            string mensaje,
            string tipo = "error",
            int? idReferencia = null)
            => new()
            {
                Ok = false,
                Mensaje = mensaje,
                Tipo = tipo,
                IdReferencia = idReferencia
            };

        public static ServiceResult FromDelete(DeleteResult r)
            => new()
            {
                Ok = r.Ok,
                Mensaje = r.Mensaje,
                Tipo = r.Tipo,
                CascadeDisponible = r.CascadeDisponible,
                Dependencias = r.Dependencias ?? new List<DeleteDependencia>()
            };

        public object ToEliminarJson()
            => new
            {
                valor = Ok,
                mensaje = Mensaje,
                tipo = Tipo,
                cascadeDisponible = CascadeDisponible,
                dependencias = Dependencias.Select(d => new
                {
                    entidad = d.Entidad,
                    cantidad = d.Cantidad,
                    detalle = d.Detalle,
                    cascadeable = d.Cascadeable
                })
            };
    }
}
