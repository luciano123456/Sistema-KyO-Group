using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IUsuariosService
    {
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<bool> Actualizar(User model);
        Task<bool> Insertar(User model);

        Task<User> Obtener(int id);
        Task<User> ObtenerUsuario(string usuario);

        Task<IQueryable<User>> ObtenerTodos();
        Task<GridResult<User>> ListarPaginado(GridQuery query);

        Task<IList<UsuariosUnidadesNegocio>> ObtenerUnidadesDeUsuario(int idUsuario);
        Task<IList<UsuariosLocal>> ObtenerLocalesDeUsuario(int idUsuario);

        Task<bool> GuardarAsignaciones(
            int idUsuario,
            IEnumerable<int> unidades,
            IReadOnlyDictionary<int, IReadOnlyCollection<int>> localesPorUnidad);
    }

}
