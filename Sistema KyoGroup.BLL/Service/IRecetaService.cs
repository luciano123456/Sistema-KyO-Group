using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IRecetaService
    {
        Task<(bool ok, string mensaje)> Insertar(Receta model);
        Task<(bool ok, string mensaje)> Actualizar(Receta model);
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<Receta> Obtener(int id);
        Task<IQueryable<Receta>> ObtenerTodos();
        Task<IQueryable<Receta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId);

        Task<bool> InsertarInsumos(List<RecetasInsumo> insumos);
        Task<List<RecetasInsumo>> ObtenerInsumos(int idReceta);
        Task<bool> ActualizarInsumos(List<RecetasInsumo> insumos);
    }
}
