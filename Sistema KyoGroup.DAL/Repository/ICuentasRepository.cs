using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL.Repository;

public interface ICuentasRepository
{
    Task<bool> Insertar(Cuenta model);
    Task<bool> Actualizar(Cuenta model);
    Task<DeleteResult> Eliminar(int id, bool cascade = false);
    Task<Cuenta?> Obtener(int id);
    Task<IQueryable<Cuenta>> ObtenerTodos();
    Task<List<Cuenta>> Listar(bool soloActivas = false, int? idLocal = null);
    Task<Cuenta?> BuscarPorNombre(string nombre, int idExcluir);
    Task<bool> CambiarEstado(int id, bool activa);
}
