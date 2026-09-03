using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models.Analisis;

namespace SistemaKyoGroup.BLL.Service;

public interface IAnalisisDatosService
{
    Task<AnalisisReporteDto> ObtenerCompras(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0);
    Task<AnalisisReporteDto> ObtenerCostos(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0);
    Task<AnalisisReporteDto> ObtenerInsumos(DateTime? fechaDesde, DateTime? fechaHasta);
    Task<AnalisisReporteDto> ObtenerRecetas(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0);
    Task<AnalisisReporteDto> ObtenerCuentaCorriente(DateTime? fechaDesde, DateTime? fechaHasta);
}

public class AnalisisDatosService : IAnalisisDatosService
{
    private readonly IAnalisisDatosRepository _repo;

    public AnalisisDatosService(IAnalisisDatosRepository repo)
    {
        _repo = repo;
    }

    public Task<AnalisisReporteDto> ObtenerCompras(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
        => _repo.ObtenerCompras(fechaDesde, fechaHasta, idUnidadNegocio);

    public Task<AnalisisReporteDto> ObtenerCostos(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
        => _repo.ObtenerCostos(fechaDesde, fechaHasta, idUnidadNegocio);

    public Task<AnalisisReporteDto> ObtenerInsumos(DateTime? fechaDesde, DateTime? fechaHasta)
        => _repo.ObtenerInsumos(fechaDesde, fechaHasta);

    public Task<AnalisisReporteDto> ObtenerRecetas(DateTime? fechaDesde, DateTime? fechaHasta, int idUnidadNegocio = 0)
        => _repo.ObtenerRecetas(fechaDesde, fechaHasta, idUnidadNegocio);

    public Task<AnalisisReporteDto> ObtenerCuentaCorriente(DateTime? fechaDesde, DateTime? fechaHasta)
        => _repo.ObtenerCuentaCorriente(fechaDesde, fechaHasta);
}
