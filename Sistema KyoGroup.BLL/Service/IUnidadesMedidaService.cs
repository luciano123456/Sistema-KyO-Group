using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IUnidadesMedidaService
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(UnidadesMedida model);
        Task<bool> Insertar(UnidadesMedida model);

        Task<UnidadesMedida> Obtener(int id);

        Task<IQueryable<UnidadesMedida>> ObtenerTodos();
    }

}
