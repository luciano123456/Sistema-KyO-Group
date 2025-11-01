using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class SubrecetaService : ISubrecetaService
    {

        private readonly ISubrecetaRepository<Subreceta> _contactRepo;

        public SubrecetaService(ISubrecetaRepository<Subreceta> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(Subreceta model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<(bool eliminado, string mensaje)> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(Subreceta model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<Subreceta> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }
        public async Task<IQueryable<Subreceta>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }

        public async Task<bool> InsertarInsumos(List<SubrecetasInsumo> insumos)
        {
            return await _contactRepo.InsertarInsumos(insumos);
        }

        public async Task<bool> ActualizarInsumos(List<SubrecetasInsumo> productos)
        {
            return await _contactRepo.ActualizarInsumos(productos);
        }

        public async Task<List<SubrecetasInsumo>> ObtenerInsumos(int idSubreceta)
        {
            return await _contactRepo.ObtenerInsumos(idSubreceta);
        }


    }
}
