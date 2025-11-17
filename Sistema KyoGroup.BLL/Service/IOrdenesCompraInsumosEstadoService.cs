using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IOrdenesComprasInsumosEstadoservice
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(OrdenesComprasInsumosEstado model);
        Task<bool> Insertar(OrdenesComprasInsumosEstado model);

        Task<OrdenesComprasInsumosEstado> Obtener(int id);

        Task<IQueryable<OrdenesComprasInsumosEstado>> ObtenerTodos();
    }

}
