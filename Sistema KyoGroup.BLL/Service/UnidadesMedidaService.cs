using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class UnidadesMedidaService : IUnidadesMedidaService
    {

        private readonly IUnidadesMedidaRepository<UnidadesMedida> _contactRepo;

        public UnidadesMedidaService(IUnidadesMedidaRepository<UnidadesMedida> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(UnidadesMedida model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(UnidadesMedida model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<UnidadesMedida> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<UnidadesMedida>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
