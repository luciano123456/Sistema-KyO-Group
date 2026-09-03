using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service
{
    public interface ILocalesService
    {
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<bool> Actualizar(Local model);
        Task<bool> Insertar(Local model);

        Task<Local> Obtener(int id);

        Task<IQueryable<Local>> ObtenerTodos();
        Task<IQueryable<Local>> ObtenerPorUnidad(int idUnidadNegocio);
    }

}
