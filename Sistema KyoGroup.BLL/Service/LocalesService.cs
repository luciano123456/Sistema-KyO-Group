using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service
{
    public class LocalesService : ILocalesService
    {

        private readonly ILocalesRepository<Local> _contactRepo;

        public LocalesService(ILocalesRepository<Local> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(Local model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<DeleteResult> Eliminar(int id, bool cascade = false)
        {
            return await _contactRepo.Eliminar(id, cascade);
        }

        public async Task<bool> Insertar(Local model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<Local> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<Local>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }

        public async Task<IQueryable<Local>> ObtenerPorUnidad(int idUnidadNegocio)
        {
            return await _contactRepo.ObtenerPorUnidad(idUnidadNegocio);
        }




    }
}
