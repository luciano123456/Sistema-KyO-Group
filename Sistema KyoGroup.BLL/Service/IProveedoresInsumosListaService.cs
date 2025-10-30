using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IProveedoresInsumoservice
    {
        Task<bool> Insertar(ProveedoresInsumosLista model);
        Task<bool> Actualizar(ProveedoresInsumosLista model);
        Task<bool> Eliminar(int id);
        Task<ProveedoresInsumosLista> Obtener(int id);
        Task<IQueryable<ProveedoresInsumosLista>> ObtenerTodos();
        Task<IQueryable<ProveedoresInsumosLista>> ObtenerPorProveedor(int idProveedor);
        Task<bool> ImportarDesdeLista(int idProveedor, List<ProveedoresInsumosLista> lista);
    }
}
