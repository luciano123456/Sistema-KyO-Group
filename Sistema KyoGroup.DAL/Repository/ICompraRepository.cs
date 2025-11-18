using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface ICompraRepository<T> where T : class
    {
        Task<bool> Insertar(T model);
        Task<bool> Actualizar(T model);
        Task<(bool eliminado, string mensaje)> Eliminar(int id);

        Task<T> Obtener(int id);
        Task<IQueryable<T>> ObtenerTodos();

        Task<List<Compra>> ObtenerTodosConFiltros(
            int? idUnidadNegocio,
            int? idLocal,
            int? idProveedor,
            DateTime? fechaDesde,
            DateTime? fechaHasta,
            int? idUsuario);
    }
}
