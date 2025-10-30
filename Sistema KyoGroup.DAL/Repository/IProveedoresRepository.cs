using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IProveedoresRepository<T> where T : class
    {
        Task<bool> Insertar(T model);
        Task<bool> Actualizar(T model);
        Task<bool> Eliminar(int id);
        Task<T> Obtener(int id);
        Task<IQueryable<T>> ObtenerTodos();
    }
}
