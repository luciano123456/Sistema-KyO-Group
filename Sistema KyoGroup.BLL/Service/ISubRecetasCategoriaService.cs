using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface ISubrecetasCategoriaService
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(SubrecetasCategoria model);
        Task<bool> Insertar(SubrecetasCategoria model);

        Task<SubrecetasCategoria> Obtener(int id);

        Task<IQueryable<SubrecetasCategoria>> ObtenerTodos();
    }

}
