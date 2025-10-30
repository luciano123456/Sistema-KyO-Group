using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class InsumosCategoriaService : IInsumosCategoriaService
    {

        private readonly IInsumosCategoriaRepository<InsumosCategoria> _contactRepo;

        public InsumosCategoriaService(IInsumosCategoriaRepository<InsumosCategoria> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(InsumosCategoria model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(InsumosCategoria model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<InsumosCategoria> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<InsumosCategoria>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
