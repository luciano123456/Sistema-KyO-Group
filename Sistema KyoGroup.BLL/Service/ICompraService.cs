using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface ICompraService
    {
        Task<bool> Insertar(Compra model);
        Task<bool> Actualizar(Compra model);
        Task<(bool eliminado, string mensaje)> Eliminar(int id);

        Task<Compra> Obtener(int id);
        Task<IQueryable<Compra>> ObtenerTodos();
        Task<List<Compra>> ObtenerTodosConFiltros(
            int? idUnidadNegocio,
            int? idLocal,
            int? idProveedor,
            DateTime? fechaDesde,
            DateTime? fechaHasta,
            int? idUsuario);
    }

}
