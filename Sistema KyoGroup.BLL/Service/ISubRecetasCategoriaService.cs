using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface ISubRecetasCategoriaService
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(SubRecetasCategoria model);
        Task<bool> Insertar(SubRecetasCategoria model);

        Task<SubRecetasCategoria> Obtener(int id);

        Task<IQueryable<SubRecetasCategoria>> ObtenerTodos();
    }

}
