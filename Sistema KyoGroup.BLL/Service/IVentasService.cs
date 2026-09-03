using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models.Ventas;

namespace SistemaKyoGroup.BLL.Service;

public interface IVentasService
{
    Task EnsureSchemaAsync();
    Task<VentaConfirmBatchResultDto> ConfirmarImportacionAsync(IEnumerable<VentaConfirmArchivoDto> archivos, int idUsuario, bool reemplazarSiExiste, bool crearRubrosFaltantes);
    Task<GridResult<VentaImportacionListItem>> ListarPaginado(GridQuery query, DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio);
    Task<VentaKpiIndexDto> ObtenerKpisIndex(DateTime? desde, DateTime? hasta);
    Task<VentaImportacionDetalleDto?> ObtenerDetalle(int id);
    Task<bool> Eliminar(int id, int idUsuario);
    Task<VentaPreviewArchivoDto> EnriquecerPreviewAsync(VentaPreviewArchivoDto preview);
    Task<VentaConfirmResultDto> ConfirmarArchivoAsync(VentaConfirmArchivoDto archivo, int idUsuario, bool reemplazarSiExiste);
    Task<VentaResumenDto> Resumen(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio);
    Task<List<VentaSeriePunto>> SerieDiaria(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio);
    Task<List<VentaSeriePunto>> ComparativaLocales(DateTime? desde, DateTime? hasta, int idUnidadNegocio);
    Task<List<VentaRubroPunto>> PorRubro(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio);
    Task<List<VentaTopProducto>> TopProductos(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio, int top = 25);
    Task<VentaMatrizMensualDto> MatrizMensual(int anio, int mes, int idLocal, int idUnidadNegocio);
}
