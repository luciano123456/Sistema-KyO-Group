using SistemaKyoGroup.BLL.Common;
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
    Task<List<Cuenta>> Listar(bool soloActivas, int? idLocal);
    Task<ServiceResult> Guardar(Cuenta model);
    Task<ServiceResult> CambiarEstado(int id, bool activa);
}

public class CuentasService : ICuentasService
{
    private readonly ICuentasRepository _repo;
    private readonly ICajasRepository _cajas;

    public CuentasService(ICuentasRepository repo, ICajasRepository cajas)
    {
        _repo = repo;
        _cajas = cajas;
    }

    public Task<bool> Insertar(Cuenta model) => _repo.Insertar(model);
    public Task<bool> Actualizar(Cuenta model) => _repo.Actualizar(model);
    public Task<DeleteResult> Eliminar(int id, bool cascade = false) => _repo.Eliminar(id, cascade);
    public Task<Cuenta?> Obtener(int id) => _repo.Obtener(id);
    public Task<IQueryable<Cuenta>> ObtenerTodos() => _repo.ObtenerTodos();
    public Task<List<Cuenta>> Listar(bool soloActivas, int? idLocal) => _repo.Listar(soloActivas, idLocal);

    public async Task<ServiceResult> Guardar(Cuenta model)
    {
        if (string.IsNullOrWhiteSpace(model.Nombre))
            return ServiceResult.Error("Indique el nombre de la cuenta.", "validacion");
        if (model.IdTipo <= 0)
            return ServiceResult.Error("Seleccione el tipo de cuenta.", "validacion");

        var duplicado = await _repo.BuscarPorNombre(model.Nombre, model.Id);
        if (duplicado != null)
        {
            return ServiceResult.Error(
                $"Ya existe una cuenta con el nombre '{duplicado.Nombre}'.",
                "duplicado",
                duplicado.Id);
        }

        if (model.Id > 0)
        {
            var existente = await _repo.Obtener(model.Id);
            if (existente == null)
                return ServiceResult.Error("No se encontró la cuenta.", "validacion");

            // Cambiar el saldo inicial mueve el saldo actual: avisarlo explícitamente.
            var cambiaInicial = existente.SaldoInicial != model.SaldoInicial;
            var ok = await _repo.Actualizar(model);
            if (!ok) return ServiceResult.Error("No se pudo actualizar la cuenta.");

            var saldo = await _cajas.SaldoCuenta(model.Id);
            return new ServiceResult
            {
                Ok = true,
                Tipo = "success",
                IdReferencia = model.Id,
                Mensaje = cambiaInicial
                    ? $"Cuenta actualizada. El saldo pasó a {saldo:C2}."
                    : "Cuenta actualizada."
            };
        }

        var insertado = await _repo.Insertar(model);
        return insertado
            ? new ServiceResult { Ok = true, Mensaje = "Cuenta creada correctamente.", Tipo = "success", IdReferencia = model.Id }
            : ServiceResult.Error("No se pudo crear la cuenta.");
    }

    public async Task<ServiceResult> CambiarEstado(int id, bool activa)
    {
        var ok = await _repo.CambiarEstado(id, activa);
        return ok
            ? ServiceResult.Success(activa
                ? "Cuenta reactivada."
                : "Cuenta desactivada. Ya no aparece al registrar movimientos, pero el histórico se conserva.")
            : ServiceResult.Error("No se encontró la cuenta.", "validacion");
    }
}
