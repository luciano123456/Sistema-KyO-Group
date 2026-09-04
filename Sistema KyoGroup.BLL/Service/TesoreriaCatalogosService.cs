using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Service;

public interface IGastosCategoriasService : IConfiguracionNombreService<GastosCategoria>
{
    Task<List<GastosCategoria>> Listar(bool soloActivas);
    Task<DeleteResult> EliminarConDependencias(int id);
}

public class GastosCategoriasService : IGastosCategoriasService
{
    private readonly IGastosCategoriasRepository _repo;

    public GastosCategoriasService(IGastosCategoriasRepository repo)
    {
        _repo = repo;
    }

    public Task<List<GastosCategoria>> Listar() => _repo.Listar();
    public Task<List<GastosCategoria>> Listar(bool soloActivas) => _repo.Listar(soloActivas);

    public Task<bool> Insertar(GastosCategoria model)
    {
        // El modal genérico de configuraciones sólo manda el nombre: el resto va con defaults sanos.
        if (model.Orden == 0) model.Orden = 50;
        model.Activa = true;
        return _repo.Insertar(model);
    }

    public Task<bool> Actualizar(GastosCategoria model) => _repo.Actualizar(model);

    public async Task<bool> Eliminar(int id)
    {
        var result = await _repo.Eliminar(id);
        return result.Ok;
    }

    public Task<DeleteResult> EliminarConDependencias(int id) => _repo.Eliminar(id);

    public Task<GastosCategoria?> BuscarDuplicado(GastosCategoria model, int idExcluir)
        => _repo.BuscarPorNombre(model.Nombre, idExcluir);

    public int GetId(GastosCategoria model) => model.Id;
    public string GetNombre(GastosCategoria model) => model.Nombre;
}

public interface IMediosPagoService : IConfiguracionNombreService<MediosPago>
{
    Task<List<MediosPago>> Listar(bool soloActivos);
    Task<DeleteResult> EliminarConDependencias(int id);
}

public class MediosPagoService : IMediosPagoService
{
    private readonly IMediosPagoRepository _repo;

    public MediosPagoService(IMediosPagoRepository repo)
    {
        _repo = repo;
    }

    public Task<List<MediosPago>> Listar() => _repo.Listar();
    public Task<List<MediosPago>> Listar(bool soloActivos) => _repo.Listar(soloActivos);

    public Task<bool> Insertar(MediosPago model)
    {
        model.Activo = true;
        model.AfectaCaja = true;
        if (model.Orden == 0) model.Orden = 50;
        return _repo.Insertar(model);
    }

    public Task<bool> Actualizar(MediosPago model) => _repo.Actualizar(model);

    public async Task<bool> Eliminar(int id)
    {
        var result = await _repo.Eliminar(id);
        return result.Ok;
    }

    public Task<DeleteResult> EliminarConDependencias(int id) => _repo.Eliminar(id);

    public Task<MediosPago?> BuscarDuplicado(MediosPago model, int idExcluir)
        => _repo.BuscarPorNombre(model.Nombre, idExcluir);

    public int GetId(MediosPago model) => model.Id;
    public string GetNombre(MediosPago model) => model.Nombre;
}

public interface ICuentasTiposService : IConfiguracionNombreService<CuentasTipo>
{
    Task<DeleteResult> EliminarConDependencias(int id);
}

public class CuentasTiposService : ICuentasTiposService
{
    private readonly ICuentasTiposRepository _repo;

    public CuentasTiposService(ICuentasTiposRepository repo)
    {
        _repo = repo;
    }

    public Task<List<CuentasTipo>> Listar() => _repo.Listar();
    public Task<bool> Insertar(CuentasTipo model) => _repo.Insertar(model);
    public Task<bool> Actualizar(CuentasTipo model) => _repo.Actualizar(model);

    public async Task<bool> Eliminar(int id)
    {
        var result = await _repo.Eliminar(id);
        return result.Ok;
    }

    public Task<DeleteResult> EliminarConDependencias(int id) => _repo.Eliminar(id);

    public Task<CuentasTipo?> BuscarDuplicado(CuentasTipo model, int idExcluir)
        => _repo.BuscarPorNombre(model.Nombre, idExcluir);

    public int GetId(CuentasTipo model) => model.Id;
    public string GetNombre(CuentasTipo model) => model.Nombre;
}
