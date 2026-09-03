using SistemaKyoGroup.Models.Analisis;

namespace SistemaKyoGroup.DAL.Repository;

public interface IAnalisisDatosRepository
{
    Task<AnalisisReporteDto> ObtenerCompras(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0);
    Task<AnalisisReporteDto> ObtenerCostos(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0);
    Task<AnalisisReporteDto> ObtenerInsumos(DateTime? fechaDesde, DateTime? fechaHasta);
    Task<AnalisisReporteDto> ObtenerRecetas(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0);
    Task<AnalisisReporteDto> ObtenerCuentaCorriente(DateTime? fechaDesde, DateTime? fechaHasta);
}
