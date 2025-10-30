using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;
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
        public Task<bool> Eliminar(int id) => _repo.Eliminar(id);
        public Task<Proveedor> Obtener(int id) => _repo.Obtener(id);
        public Task<IQueryable<Proveedor>> ObtenerTodos() => _repo.ObtenerTodos();
    }
}
