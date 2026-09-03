using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IProveedoresService
    {
        Task<bool> Insertar(Proveedor model);
        Task<bool> Actualizar(Proveedor model);
        Task<DeleteResult> Eliminar(int id, bool cascade = false);

        Task<Proveedor> Obtener(int id);
        Task<IQueryable<Proveedor>> ObtenerTodos();
        Task<Proveedor?> BuscarDuplicado(string nombre, string? cuit, int idExcluir);
        Task<GridResult<Proveedor>> ListarPaginado(GridQuery query);
    }
}
