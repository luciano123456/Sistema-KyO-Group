using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IRecetaService
    {
        Task<bool> Insertar(Receta model);
        Task<bool> Actualizar(Receta model);
        Task<bool> Eliminar(int id);
        Task<Receta> Obtener(int id);
        Task<IQueryable<Receta>> ObtenerTodos();
        Task<IQueryable<Receta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId);

        Task<bool> InsertarInsumos(List<RecetasInsumo> insumos);
        Task<List<RecetasInsumo>> ObtenerInsumos(int idReceta);
        Task<bool> ActualizarInsumos(List<RecetasInsumo> insumos);

        //Task<bool> InsertarSubRecetas(List<RecetasSubReceta> insumos);
        //Task<List<RecetasSubReceta>> ObtenerSubRecetas(int idReceta);
        //Task<bool> ActualizarSubRecetas(List<RecetasSubReceta> insumos);
    }
}
