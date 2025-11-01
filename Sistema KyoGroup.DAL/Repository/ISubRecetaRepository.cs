using SistemaKyoGroup.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace SistemaKyoGroup.DAL.Repository
{
    public interface ISubrecetaRepository<TEntityModel> where TEntityModel : class
    {
        Task<(bool eliminado, string mensaje)> Eliminar(int id);
        Task<bool> Actualizar(Subreceta model);
        Task<bool> Insertar(Subreceta model);
        Task<Subreceta> Obtener(int id);
        Task<IQueryable<Subreceta>> ObtenerTodos();
        Task<bool> InsertarInsumos(List<SubrecetasInsumo> insumos);
        Task<List<SubrecetasInsumo>> ObtenerInsumos(int idSubreceta);
        Task<bool> ActualizarInsumos(List<SubrecetasInsumo> insumos);
    }
}
