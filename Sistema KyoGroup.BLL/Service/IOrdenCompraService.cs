using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SistemaKyoGroup.BLL.Service
{
    public interface IOrdenCompraService
    {
        Task<bool> Insertar(OrdenesCompra model);
        Task<bool> Actualizar(OrdenesCompra model);
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<OrdenesCompra> Obtener(int id);
        Task<IQueryable<OrdenesCompra>> ObtenerTodos();
        Task<IQueryable<OrdenesCompra>> ObtenerPendientes();
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

        Task ActualizarEstadosDetalle(int idOrdenCompra, IDictionary<int, int> estadosPorDetalle);
    }
}
