using SistemaKyoGroup.Models;
using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models.Common;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IProveedoresInsumosRepository<TEntityModel> where TEntityModel : class
    {
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<bool> Actualizar(ProveedoresInsumosLista model);
        Task<bool> Insertar(ProveedoresInsumosLista model);
        Task<ProveedoresInsumosLista> Obtener(int id);
        Task<IQueryable<ProveedoresInsumosLista>> ObtenerTodos();
        Task<IQueryable<ProveedoresInsumosLista>> ObtenerPorProveedor(int idProveedor);
        Task<bool> ImportarDesdeLista(int idProveedor, List<ProveedoresInsumosLista> lista);
        Task<bool> EliminarMasivo(List<int> ids);
        Task<GridResult<ProveedoresInsumosLista>> ListarPaginado(int idProveedor, GridQuery query);
    }
}
