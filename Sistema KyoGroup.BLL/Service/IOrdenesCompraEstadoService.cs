using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IOrdenesComprasEstadoservice
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(OrdenesComprasEstado model);
        Task<bool> Insertar(OrdenesComprasEstado model);

        Task<OrdenesComprasEstado> Obtener(int id);

        Task<IQueryable<OrdenesComprasEstado>> ObtenerTodos();
    }

}
