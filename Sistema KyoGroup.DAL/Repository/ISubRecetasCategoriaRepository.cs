using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface ISubRecetasCategoriaRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(SubRecetasCategoria model);
        Task<bool> Insertar(SubRecetasCategoria model);
        Task<SubRecetasCategoria> Obtener(int id);
        Task<IQueryable<SubRecetasCategoria>> ObtenerTodos();
    }
}
