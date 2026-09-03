using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Ventas;

namespace SistemaKyoGroup.DAL.Repository;

public interface IVentasRepository
{
    Task EnsureSchemaAsync();
    Task EnsureTipoMaxiRestAsync();
    Task<int> ObtenerIdTipoMaxiRestAsync();
    Task<Importacion?> ObtenerPorLocalFechaAsync(int idLocal, DateTime fecha);
    Task<Importacion?> ObtenerConLineasAsync(int id);
    Task<GridResult<VentaImportacionListItem>> ListarPaginado(GridQuery query, DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio);
    Task<VentaKpiIndexDto> ObtenerKpisIndexAsync(DateTime? desde, DateTime? hasta);
    Task<VentaImportacionDetalleDto?> ObtenerDetalleAsync(int id);
    Task<(bool Ok, int Id, string? Error, bool Reemplazo)> GuardarImportacionAsync(
        Importacion cabecera,
        List<ImportacionesReceta> lineas,
        bool reemplazarSiExiste,
        int idUsuario);
    Task<bool> EliminarAsync(int id, int idUsuario);
    Task<List<Local>> ListarLocalesAsync();
    Task<Dictionary<string, Receta>> MapRecetasPorSkuAsync(int? idUnidadNegocio = null);
    Task<Dictionary<string, InsumoMatchInfo>> MapInsumosPorSkuAsync(int? idUnidadNegocio = null);
    Task<VentaResumenDto> ObtenerResumenAsync(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio);
    Task<List<VentaSeriePunto>> ObtenerSerieDiariaAsync(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio);
    Task<List<VentaSeriePunto>> ObtenerComparativaLocalesAsync(DateTime? desde, DateTime? hasta, int idUnidadNegocio);
    Task<List<VentaRubroPunto>> ObtenerPorRubroAsync(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio);
    Task<List<VentaTopProducto>> ObtenerTopProductosAsync(DateTime? desde, DateTime? hasta, int idLocal, int idUnidadNegocio, int top = 25);
    Task<VentaMatrizMensualDto> ObtenerMatrizMensualAsync(int anio, int mes, int idLocal, int idUnidadNegocio);
}
