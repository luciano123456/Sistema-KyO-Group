using SistemaKyoGroup.Models;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IProveedoresService
    {
        Task<bool> Insertar(Proveedor model);
        Task<bool> Actualizar(Proveedor model);
        Task<bool> Eliminar(int id);

        Task<Proveedor> Obtener(int id);
        Task<IQueryable<Proveedor>> ObtenerTodos();
    }
}
