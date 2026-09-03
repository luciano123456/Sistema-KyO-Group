using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service;

public interface IRubrosService
{
    Task<bool> Actualizar(Rubro model);
    Task<bool> Eliminar(int id);
    Task<bool> Insertar(Rubro model);
    Task<Rubro> Obtener(int id);
    Task<IQueryable<Rubro>> ObtenerTodos();
    Task<List<Rubro>> Listar();
    Task<List<Rubro>> CrearSiNoExisten(IEnumerable<string> nombres);
}
