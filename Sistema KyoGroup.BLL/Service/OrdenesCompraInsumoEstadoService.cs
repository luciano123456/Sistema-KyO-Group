using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class OrdenesComprasInsumosEstadoService : IOrdenesComprasInsumosEstadoservice
    {

        private readonly IOrdenesComprasInsumoEstadoRepository<OrdenesComprasInsumosEstado> _contactRepo;

        public OrdenesComprasInsumosEstadoService(IOrdenesComprasInsumoEstadoRepository<OrdenesComprasInsumosEstado> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(OrdenesComprasInsumosEstado model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(OrdenesComprasInsumosEstado model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<OrdenesComprasInsumosEstado> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<OrdenesComprasInsumosEstado>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
