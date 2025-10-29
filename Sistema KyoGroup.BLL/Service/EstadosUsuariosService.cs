using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class EstadosUsuariosService : IEstadosUsuariosService
    {

        private readonly IEstadosUsuariosRepository<EstadosUsuario> _contactRepo;

        public EstadosUsuariosService(IEstadosUsuariosRepository<EstadosUsuario> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(EstadosUsuario model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(EstadosUsuario model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<EstadosUsuario> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<EstadosUsuario>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
