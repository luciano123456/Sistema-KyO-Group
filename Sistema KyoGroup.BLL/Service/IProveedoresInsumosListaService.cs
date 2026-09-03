using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IProveedoresInsumoservice
    {
        Task<bool> Insertar(ProveedoresInsumosLista model);
        Task<bool> Actualizar(ProveedoresInsumosLista model);
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<ProveedoresInsumosLista> Obtener(int id);
        Task<IQueryable<ProveedoresInsumosLista>> ObtenerTodos();
        Task<IQueryable<ProveedoresInsumosLista>> ObtenerPorProveedor(int idProveedor);
        Task<bool> ImportarDesdeLista(int idProveedor, List<ProveedoresInsumosLista> lista);
        Task<bool> EliminarMasivo(List<int> ids);
        Task<GridResult<ProveedoresInsumosLista>> ListarPaginado(int idProveedor, GridQuery query);
    }
}
