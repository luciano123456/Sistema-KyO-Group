using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class ProveedoresInsumoservice : IProveedoresInsumoservice
    {

        private readonly IProveedoresInsumosRepository<ProveedoresInsumosLista> _contactRepo;
        private readonly Provincia _provinciaRepo;

        public ProveedoresInsumoservice(IProveedoresInsumosRepository<ProveedoresInsumosLista> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(ProveedoresInsumosLista model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> ImportarDesdeLista(int idProveedor, List<ProveedoresInsumosLista> lista)
        {
            return await _contactRepo.ImportarDesdeLista(idProveedor, lista);
        }

        public async Task<bool> Insertar(ProveedoresInsumosLista model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<ProveedoresInsumosLista> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }

        public async Task<IQueryable<ProveedoresInsumosLista>> ObtenerPorProveedor(int idProveedor)
        {
            return await _contactRepo.ObtenerPorProveedor(idProveedor);
        }


        public async Task<bool> EliminarMasivo(List<int> ids)
        {
            return await _contactRepo.EliminarMasivo(ids);
        }

        //public async Task<ProveedoresInsumos> ObtenerPorNombre(string nombre)
        //{
        //    IQueryable<ProveedoresInsumos> queryProveedoresInsumosQL = await _contactRepo.ObtenerTodos();

        //    ProveedoresInsumos ProveedoresInsumos = queryProveedoresInsumosQL.Where(c => c.Nombre == nombre).FirstOrDefault();

        //    return ProveedoresInsumos;
        //}

        public async Task<IQueryable<ProveedoresInsumosLista>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
