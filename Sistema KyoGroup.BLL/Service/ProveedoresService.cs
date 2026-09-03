using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.DAL.Grid;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;
using System.Linq;
using System.Threading.Tasks;

namespace SistemaKyoGroup.BLL.Service
{
    public class ProveedoresService : IProveedoresService
    {
        private readonly IProveedoresRepository<Proveedor> _repo;

        public ProveedoresService(IProveedoresRepository<Proveedor> repo)
        {
            _repo = repo;
        }

        public Task<bool> Insertar(Proveedor model) => _repo.Insertar(model);
        public Task<bool> Actualizar(Proveedor model) => _repo.Actualizar(model);
        public Task<DeleteResult> Eliminar(int id, bool cascade = false) => _repo.Eliminar(id, cascade);
        public Task<Proveedor> Obtener(int id) => _repo.Obtener(id);
        public Task<IQueryable<Proveedor>> ObtenerTodos() => _repo.ObtenerTodos();

        public async Task<Proveedor?> BuscarDuplicado(string nombre, string? cuit, int idExcluir)
        {
            return await _repo.BuscarDuplicado(nombre, cuit, idExcluir);
        }

        public async Task<GridResult<Proveedor>> ListarPaginado(GridQuery query)
        {
            return await _repo.ListarPaginado(query);
        }
    }
}
