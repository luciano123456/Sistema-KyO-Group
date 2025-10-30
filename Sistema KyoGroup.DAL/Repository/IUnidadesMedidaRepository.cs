using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IUnidadesMedidaRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(UnidadesMedida model);
        Task<bool> Insertar(UnidadesMedida model);
        Task<UnidadesMedida> Obtener(int id);
        Task<IQueryable<UnidadesMedida>> ObtenerTodos();
    }
}
