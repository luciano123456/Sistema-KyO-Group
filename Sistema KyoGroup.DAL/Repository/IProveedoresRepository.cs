using System.Linq;
using System.Threading.Tasks;
using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IProveedoresRepository<T> where T : class
    {
        Task<bool> Insertar(T model);
        Task<bool> Actualizar(T model);
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<T> Obtener(int id);
        Task<IQueryable<T>> ObtenerTodos();
        Task<T?> BuscarDuplicado(string nombre, string? cuit, int idExcluir);
        Task<GridResult<Proveedor>> ListarPaginado(GridQuery query);
    }
}
