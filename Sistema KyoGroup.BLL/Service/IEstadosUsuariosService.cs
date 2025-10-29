using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IEstadosUsuariosService
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(EstadosUsuario model);
        Task<bool> Insertar(EstadosUsuario model);

        Task<EstadosUsuario> Obtener(int id);

        Task<IQueryable<EstadosUsuario>> ObtenerTodos();
    }

}
