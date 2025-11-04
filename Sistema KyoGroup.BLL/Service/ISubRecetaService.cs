using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface ISubRecetaService
    {
        Task<bool> Insertar(SubReceta model);
        Task<bool> Actualizar(SubReceta model);
        Task<(bool eliminado, string mensaje)> Eliminar(int id);
        Task<SubReceta> Obtener(int id);
        Task<IQueryable<SubReceta>> ObtenerTodos();

        Task<bool> InsertarInsumos(List<SubRecetasInsumo> insumos);
        Task<List<SubRecetasInsumo>> ObtenerInsumos(int idSubReceta);
        Task<IQueryable<SubReceta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId);
        Task<bool> ActualizarInsumos(List<SubRecetasInsumo> insumos);
    }
}
