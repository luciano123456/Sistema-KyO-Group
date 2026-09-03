using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository;

public interface IRubrosRepository<TEntityModel> where TEntityModel : class
{
    Task<bool> Eliminar(int id);
    Task<bool> Actualizar(Rubro model);
    Task<bool> Insertar(Rubro model);
    Task<Rubro> Obtener(int id);
    Task<IQueryable<Rubro>> ObtenerTodos();
    Task<List<Rubro>> ListarAsync();
    Task<List<string>> ObtenerNombresNormalizadosAsync();
    Task<List<Rubro>> CrearSiNoExistenAsync(IEnumerable<string> nombres);
}
