using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface ILocalesService
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(Local model);
        Task<bool> Insertar(Local model);

        Task<Local> Obtener(int id);

        Task<IQueryable<Local>> ObtenerTodos();
    }

}
