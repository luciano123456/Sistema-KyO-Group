using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class RecetasCategoriaService : IRecetasCategoriaService
    {

        private readonly IRecetasCategoriaRepository<RecetasCategoria> _contactRepo;

        public RecetasCategoriaService(IRecetasCategoriaRepository<RecetasCategoria> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(RecetasCategoria model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(RecetasCategoria model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<RecetasCategoria> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<RecetasCategoria>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
