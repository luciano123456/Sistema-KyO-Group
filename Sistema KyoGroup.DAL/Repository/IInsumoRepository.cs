using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IInsumoRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(Insumo model);
        Task<bool> Insertar(Insumo model);
        Task<Insumo> Obtener(int id);
        Task<IQueryable<Insumo>> ObtenerTodos();
        Task<IQueryable<Insumo>> ObtenerPorProveedor(int idProveedor);
        Task<IQueryable<Insumo>> ObtenerPorUnidadNegocio(int IdUnidadNegocio);
        Task<IQueryable<Insumo>> ObtenerPorUnidadYProveedor(int idUnidadNegocio, int idProveedor);

    }
}
