using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class RecetaService : IRecetaService
    {

        private readonly IRecetaRepository<Receta> _contactRepo;

        public RecetaService(IRecetaRepository<Receta> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(Receta model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(Receta model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<Receta> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }
        public async Task<IQueryable<Receta>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }

        public async Task<IQueryable<Receta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio)
        {
            return await _contactRepo.ObtenerTodosUnidadNegocio(idUnidadNegocio);
        }

        public async Task<bool> InsertarInsumos(List<RecetasInsumo> insumos)
        {
            return await _contactRepo.InsertarInsumos(insumos);
        }

        public async Task<bool> ActualizarInsumos(List<RecetasInsumo> productos)
        {
            return await _contactRepo.ActualizarInsumos(productos);
        }

        public async Task<List<RecetasInsumo>> ObtenerInsumos(int idReceta)
        {
            return await _contactRepo.ObtenerInsumos(idReceta);
        }


    }
}
