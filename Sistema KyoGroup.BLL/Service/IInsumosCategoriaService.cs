using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IInsumosCategoriaService
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(InsumosCategoria model);
        Task<bool> Insertar(InsumosCategoria model);

        Task<InsumosCategoria> Obtener(int id);

        Task<IQueryable<InsumosCategoria>> ObtenerTodos();
    }

}
