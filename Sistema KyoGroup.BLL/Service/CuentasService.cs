using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service;

public interface ICuentasService
{
    Task<bool> Insertar(Cuenta model);
    Task<bool> Actualizar(Cuenta model);
    Task<DeleteResult> Eliminar(int id, bool cascade = false);
    Task<Cuenta?> Obtener(int id);
    Task<IQueryable<Cuenta>> ObtenerTodos();
}

public class CuentasService : ICuentasService
{
    private readonly ICuentasRepository _repo;

    public CuentasService(ICuentasRepository repo)
    {
        _repo = repo;
    }

    public Task<bool> Insertar(Cuenta model) => _repo.Insertar(model);
    public Task<bool> Actualizar(Cuenta model) => _repo.Actualizar(model);
    public Task<DeleteResult> Eliminar(int id, bool cascade = false) => _repo.Eliminar(id, cascade);
    public Task<Cuenta?> Obtener(int id) => _repo.Obtener(id);
    public Task<IQueryable<Cuenta>> ObtenerTodos() => _repo.ObtenerTodos();
}
