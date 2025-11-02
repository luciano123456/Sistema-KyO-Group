using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface IRecetaRepository<TEntityModel> where TEntityModel : class
    {
        Task<bool> Eliminar(int id);
        Task<bool> Actualizar(Receta model);
        Task<bool> Insertar(Receta model);
        Task<Receta> Obtener(int id);
        Task<IQueryable<Receta>> ObtenerTodos();
        Task<IQueryable<Receta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId);
        Task<bool> InsertarInsumos(List<RecetasInsumo> insumos);
        Task<List<RecetasInsumo>> ObtenerInsumos(int idReceta);
        Task<bool> ActualizarInsumos(List<RecetasInsumo> insumos);
    }
}
