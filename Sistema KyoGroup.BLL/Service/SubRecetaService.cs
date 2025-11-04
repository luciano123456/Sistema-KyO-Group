using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class SubRecetaService : ISubRecetaService
    {

        private readonly ISubRecetaRepository<SubReceta> _contactRepo;

        public SubRecetaService(ISubRecetaRepository<SubReceta> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(SubReceta model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<(bool eliminado, string mensaje)> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(SubReceta model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<SubReceta> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }


        public async Task<IQueryable<SubReceta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId)
        {
            return await _contactRepo.ObtenerTodosUnidadNegocio(idUnidadNegocio, userId);
        }

        public async Task<IQueryable<SubReceta>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }

        public async Task<bool> InsertarInsumos(List<SubRecetasInsumo> insumos)
        {
            return await _contactRepo.InsertarInsumos(insumos);
        }

        public async Task<bool> ActualizarInsumos(List<SubRecetasInsumo> productos)
        {
            return await _contactRepo.ActualizarInsumos(productos);
        }

        public async Task<List<SubRecetasInsumo>> ObtenerInsumos(int idSubReceta)
        {
            return await _contactRepo.ObtenerInsumos(idSubReceta);
        }


    }
}
