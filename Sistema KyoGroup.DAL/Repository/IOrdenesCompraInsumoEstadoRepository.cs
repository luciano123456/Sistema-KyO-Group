using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IOrdenesComprasInsumoEstadoRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(OrdenesComprasInsumosEstado model);
        Task<bool> Insertar(OrdenesComprasInsumosEstado model);
        Task<OrdenesComprasInsumosEstado> Obtener(int id);
        Task<IQueryable<OrdenesComprasInsumosEstado>> ObtenerTodos();
    }
}
