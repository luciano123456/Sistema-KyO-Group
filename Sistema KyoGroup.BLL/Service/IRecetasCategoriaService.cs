using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IRecetasCategoriaService
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(RecetasCategoria model);
        Task<bool> Insertar(RecetasCategoria model);

        Task<RecetasCategoria> Obtener(int id);

        Task<IQueryable<RecetasCategoria>> ObtenerTodos();
    }

}
