using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IInsumoService
    {
        Task<bool> Insertar(Insumo model);
        Task<bool> Actualizar(Insumo model);
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<Insumo> Obtener(int id);
        Task<IQueryable<Insumo>> ObtenerTodos();
        Task<IQueryable<Insumo>> ObtenerPorProveedor(int idProveedor);
        Task<IQueryable<Insumo>> ObtenerPorUnidadNegocio(int IdUnidadNegocio);
        Task<IQueryable<Insumo>> ObtenerPorUnidadYProveedor(int idUnidadNegocio, int idProveedor);
        Task<Insumo?> BuscarDuplicado(string sku, string descripcion, int idExcluir);
        Task<GridResult<Insumo>> ListarPaginado(int idUnidadNegocio, GridQuery query);
        Task<(int Total, int SinProveedor)> ObtenerKpis(int idUnidadNegocio);
    }
}
