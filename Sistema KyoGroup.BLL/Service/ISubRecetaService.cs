using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service
{
    public interface ISubRecetaService
    {
        Task<(bool ok, string mensaje)> Insertar(SubReceta model);
        Task<(bool ok, string mensaje)> Actualizar(SubReceta model);
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<SubReceta> Obtener(int id);
        Task<IQueryable<SubReceta>> ObtenerTodos();

        Task<bool> InsertarInsumos(List<SubRecetasInsumo> insumos);
        Task<List<SubRecetasInsumo>> ObtenerInsumos(int idSubReceta);
        Task<IQueryable<SubReceta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId);
        Task<bool> ActualizarInsumos(List<SubRecetasInsumo> insumos);
    }
}
