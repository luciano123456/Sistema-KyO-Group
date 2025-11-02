using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IUnidadesNegocioService
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(UnidadesNegocio model);
        Task<bool> Insertar(UnidadesNegocio model);

        Task<UnidadesNegocio> Obtener(int id);

        Task<IQueryable<UnidadesNegocio>> ObtenerTodos();
        Task<IQueryable<UnidadesNegocio>> ObtenerTodosUsuario(int idUsuario);
    }

}
