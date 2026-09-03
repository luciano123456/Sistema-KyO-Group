using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.BLL.Service;

public class RubrosService : IRubrosService
{
    private readonly IRubrosRepository<Rubro> _repo;

    public RubrosService(IRubrosRepository<Rubro> repo)
    {
        _repo = repo;
    }

    public Task<bool> Actualizar(Rubro model) => _repo.Actualizar(model);
    public Task<bool> Eliminar(int id) => _repo.Eliminar(id);
    public Task<bool> Insertar(Rubro model) => _repo.Insertar(model);
    public Task<Rubro> Obtener(int id) => _repo.Obtener(id);
    public Task<IQueryable<Rubro>> ObtenerTodos() => _repo.ObtenerTodos();
    public Task<List<Rubro>> Listar() => _repo.ListarAsync();
    public Task<List<Rubro>> CrearSiNoExisten(IEnumerable<string> nombres) => _repo.CrearSiNoExistenAsync(nombres);
}
