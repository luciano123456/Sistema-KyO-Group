using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class OrdenesComprasEstadoService : IOrdenesComprasEstadoservice
    {

        private readonly IOrdenesComprasEstadoRepository<OrdenesComprasEstado> _contactRepo;

        public OrdenesComprasEstadoService(IOrdenesComprasEstadoRepository<OrdenesComprasEstado> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(OrdenesComprasEstado model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(OrdenesComprasEstado model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<OrdenesComprasEstado> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<OrdenesComprasEstado>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
