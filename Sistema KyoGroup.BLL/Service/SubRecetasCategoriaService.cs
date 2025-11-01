using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class SubrecetasCategoriaService : ISubrecetasCategoriaService
    {

        private readonly ISubrecetasCategoriaRepository<SubrecetasCategoria> _contactRepo;

        public SubrecetasCategoriaService(ISubrecetasCategoriaRepository<SubrecetasCategoria> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(SubrecetasCategoria model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(SubrecetasCategoria model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<SubrecetasCategoria> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<SubrecetasCategoria>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
