using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IInsumosCategoriaRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(InsumosCategoria model);
        Task<bool> Insertar(InsumosCategoria model);
        Task<InsumosCategoria> Obtener(int id);
        Task<IQueryable<InsumosCategoria>> ObtenerTodos();
    }
}
