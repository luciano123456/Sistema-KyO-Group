using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IRolesRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(Rol model);
        Task<bool> Insertar(Rol model);
        Task<Rol> Obtener(int id);
        Task<IQueryable<Rol>> ObtenerTodos();
    }
}
