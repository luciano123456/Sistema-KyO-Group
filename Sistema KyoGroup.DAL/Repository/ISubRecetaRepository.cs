using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface ISubRecetaRepository<TEntityModel> where TEntityModel : class
    {
        Task<(bool eliminado, string mensaje)> Eliminar(int id);
        Task<bool> Actualizar(SubReceta model);
        Task<bool> Insertar(SubReceta model);
        Task<SubReceta> Obtener(int id);
        Task<IQueryable<SubReceta>> ObtenerTodos();
        Task<IQueryable<SubReceta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId);
        Task<bool> InsertarInsumos(List<SubRecetasInsumo> insumos);
        Task<List<SubRecetasInsumo>> ObtenerInsumos(int idSubReceta);
        Task<bool> ActualizarInsumos(List<SubRecetasInsumo> insumos);
    }
}
