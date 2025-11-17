using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IOrdenesComprasEstadoRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(OrdenesComprasEstado model);
        Task<bool> Insertar(OrdenesComprasEstado model);
        Task<OrdenesComprasEstado> Obtener(int id);
        Task<IQueryable<OrdenesComprasEstado>> ObtenerTodos();
    }
}
