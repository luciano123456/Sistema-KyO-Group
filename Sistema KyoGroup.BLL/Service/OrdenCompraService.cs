using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class OrdenCompraService : IOrdenCompraService
    {
        private readonly IOrdenCompraRepository<OrdenesCompra> _repo;
        public OrdenCompraService(IOrdenCompraRepository<OrdenesCompra> repo) { _repo = repo; }

        public Task<bool> Insertar(OrdenesCompra model) => _repo.Insertar(model);
        public Task<bool> Actualizar(OrdenesCompra model) => _repo.Actualizar(model);
        public Task<(bool eliminado, string mensaje)> Eliminar(int id) => _repo.Eliminar(id);
        public Task<OrdenesCompra> Obtener(int id) => _repo.Obtener(id);
        public Task<IQueryable<OrdenesCompra>> ObtenerTodos() => _repo.ObtenerTodos();
        public Task<IQueryable<OrdenesCompra>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId, int? idEstado)
            => _repo.ObtenerTodosUnidadNegocio(idUnidadNegocio, userId, idEstado);
        public async Task<List<OrdenesCompra>> ObtenerTodosConFiltros(
    int? idUnidadNegocio = null,
    int? idLocal = null,
    int? idProveedor = null,
    int? idEstado = null,
    DateTime? fechaDesde = null,
    DateTime? fechaHasta = null,
    int? idUsuario = null)
        {
            return await _repo.ObtenerTodosConFiltros(
                idUnidadNegocio, idLocal, idProveedor, idEstado, fechaDesde, fechaHasta, idUsuario);
        }

    }
}
