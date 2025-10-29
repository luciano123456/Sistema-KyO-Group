using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service
{
    public class UsuariosService : IUsuariosService
    {

        private readonly IUsuariosRepository<User> _contactRepo;

        public UsuariosService(IUsuariosRepository<User> contactRepo)
        {
            _contactRepo = contactRepo;
        }
        public async Task<bool> Actualizar(User model)
        {
            return await _contactRepo.Actualizar(model);
        }

        public async Task<bool> Eliminar(int id)
        {
            return await _contactRepo.Eliminar(id);
        }

        public async Task<bool> Insertar(User model)
        {
            return await _contactRepo.Insertar(model);
        }

        public async Task<User> Obtener(int id)
        {
            return await _contactRepo.Obtener(id);
        }

        public async Task<User> ObtenerUsuario(string usuario)
        {
            return await _contactRepo.ObtenerUsuario(usuario);
        }


        public async Task<IQueryable<User>> ObtenerTodos()
        {
            return await _contactRepo.ObtenerTodos();
        }



    }
}
