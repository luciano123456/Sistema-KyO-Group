using SistemaKyoGroup.Models;
using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models.Common;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IUsuariosRepository<TEntityModel> where TEntityModel : class
    {
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<bool> Actualizar(User model);
        Task<bool> Insertar(User model);
        Task<User> Obtener(int id);
        Task<User> ObtenerUsuario(string usuario);
        Task<IQueryable<User>> ObtenerTodos();
        Task<GridResult<User>> ListarPaginado(GridQuery query);

        Task<List<UsuariosUnidadesNegocio>> ObtenerUnidadesDeUsuario(int idUsuario);
        Task<List<UsuariosLocal>> ObtenerLocalesDeUsuario(int idUsuario);

        Task<bool> ReemplazarAsignacionesUsuario(
            int idUsuario,
            IEnumerable<int> unidades,
            IReadOnlyDictionary<int, IReadOnlyCollection<int>> localesPorUnidad);
    }
}
