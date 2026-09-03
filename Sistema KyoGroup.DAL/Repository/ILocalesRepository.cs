using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface ILocalesRepository<TEntityModel> where TEntityModel : class
    {
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<bool> Actualizar(Local model);
        Task<bool> Insertar(Local model);
        Task<Local> Obtener(int id);
        Task<IQueryable<Local>> ObtenerPorUnidad(int idUnidadNegocio);
        Task<IQueryable<Local>> ObtenerTodos();
    }
}
