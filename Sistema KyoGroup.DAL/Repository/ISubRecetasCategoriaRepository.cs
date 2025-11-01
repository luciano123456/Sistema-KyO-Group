using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface ISubrecetasCategoriaRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(SubrecetasCategoria model);
        Task<bool> Insertar(SubrecetasCategoria model);
        Task<SubrecetasCategoria> Obtener(int id);
        Task<IQueryable<SubrecetasCategoria>> ObtenerTodos();
    }
}
