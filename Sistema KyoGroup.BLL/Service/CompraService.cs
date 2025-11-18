using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.BLL.Service
{
    public class CompraService : ICompraService
    {
        private readonly ICompraRepository<Compra> _repo;

        public CompraService(ICompraRepository<Compra> repo)
        {
            _repo = repo;
        }

        public Task<bool> Insertar(Compra m) => _repo.Insertar(m);
        public Task<bool> Actualizar(Compra m) => _repo.Actualizar(m);
        public Task<(bool eliminado, string mensaje)> Eliminar(int id) => _repo.Eliminar(id);
        public Task<Compra> Obtener(int id) => _repo.Obtener(id);
        public Task<IQueryable<Compra>> ObtenerTodos() => _repo.ObtenerTodos();

        public Task<List<Compra>> ObtenerTodosConFiltros(
            int? idUnidadNegocio,
            int? idLocal,
            int? idProveedor,
            DateTime? fechaDesde,
            DateTime? fechaHasta,
            int? idUsuario)
        {
            return _repo.ObtenerTodosConFiltros(
                idUnidadNegocio, idLocal, idProveedor,
                fechaDesde, fechaHasta, idUsuario);
        }
    }
}
