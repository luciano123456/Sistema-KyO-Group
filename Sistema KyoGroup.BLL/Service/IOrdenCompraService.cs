using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IOrdenCompraService
    {
        Task<bool> Insertar(OrdenesCompra model);
        Task<bool> Actualizar(OrdenesCompra model);
        Task<(bool eliminado, string mensaje)> Eliminar(int id);
        Task<OrdenesCompra> Obtener(int id);
        Task<IQueryable<OrdenesCompra>> ObtenerTodos();
        Task<IQueryable<OrdenesCompra>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId, int? idEstado);
        Task<List<OrdenesCompra>> ObtenerTodosConFiltros(
    int? idUnidadNegocio = null,
    int? idLocal = null,
    int? idProveedor = null,
    int? idEstado = null,
    DateTime? fechaDesde = null,
    DateTime? fechaHasta = null,
    int? idUsuario = null
);

    }
}
