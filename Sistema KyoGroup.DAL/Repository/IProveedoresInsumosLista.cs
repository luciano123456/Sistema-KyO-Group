using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IProveedoresInsumosRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(ProveedoresInsumosLista model);
        Task<bool> Insertar(ProveedoresInsumosLista model);
        Task<ProveedoresInsumosLista> Obtener(int id);
        Task<IQueryable<ProveedoresInsumosLista>> ObtenerTodos();
        Task<IQueryable<ProveedoresInsumosLista>> ObtenerPorProveedor(int idProveedor);
        Task<bool> ImportarDesdeLista(int idProveedor, List<ProveedoresInsumosLista> lista);
    }
}
