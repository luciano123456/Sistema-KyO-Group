using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface ILocalesRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(Local model);
        Task<bool> Insertar(Local model);
        Task<Local> Obtener(int id);
        Task<IQueryable<Local>> ObtenerPorUnidad(int idUnidadNegocio);
        Task<IQueryable<Local>> ObtenerTodos();
    }
}
