using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IInsumoService
    {
        Task<bool> Insertar(Insumo model);
        Task<bool> Actualizar(Insumo model);
        Task<bool> Eliminar(int id);
        Task<Insumo> Obtener(int id);
        Task<IQueryable<Insumo>> ObtenerTodos();
        Task<IQueryable<Insumo>> ObtenerPorProveedor(int idProveedor);
        Task<IQueryable<Insumo>> ObtenerPorUnidadNegocio(int IdUnidadNegocio);
    }
}
