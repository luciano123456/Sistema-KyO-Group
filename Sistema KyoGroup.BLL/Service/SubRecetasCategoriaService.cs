using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class SubRecetasCategoriaService : ISubRecetasCategoriaService
    {

        private readonly ISubRecetasCategoriaRepository<SubRecetasCategoria> _contactRepo;

        public SubRecetasCategoriaService(ISubRecetasCategoriaRepository<SubRecetasCategoria> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(SubRecetasCategoria model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(SubRecetasCategoria model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<SubRecetasCategoria> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<SubRecetasCategoria>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
