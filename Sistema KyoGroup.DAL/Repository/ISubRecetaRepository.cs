using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;
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
        Task<DeleteResult> Eliminar(int id, bool cascade = false);
        Task<(bool ok, string mensaje)> Actualizar(SubReceta model);
        Task<(bool ok, string mensaje)> Insertar(SubReceta model);
        Task<SubReceta> Obtener(int id);
        Task<IQueryable<SubReceta>> ObtenerTodos();
        Task<IQueryable<SubReceta>> ObtenerTodosUnidadNegocio(int idUnidadNegocio, int userId);
        Task<bool> InsertarInsumos(List<SubRecetasInsumo> insumos);
        Task<List<SubRecetasInsumo>> ObtenerInsumos(int idSubReceta);
        Task<bool> ActualizarInsumos(List<SubRecetasInsumo> insumos);
    }
}
