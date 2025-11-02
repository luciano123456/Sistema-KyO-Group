using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IRecetasCategoriaRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(RecetasCategoria model);
        Task<bool> Insertar(RecetasCategoria model);
        Task<RecetasCategoria> Obtener(int id);
        Task<IQueryable<RecetasCategoria>> ObtenerTodos();
    }
}
