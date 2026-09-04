using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class CuentasController : Controller
{
    private readonly ICuentasService _service;
    private readonly ICajasService _cajas;
    private readonly ICuentasTiposService _tipos;

    public CuentasController(ICuentasService service, ICajasService cajas, ICuentasTiposService tipos)
    {
        _service = service;
        _cajas = cajas;
        _tipos = tipos;
    }

    [AllowAnonymous]
    public IActionResult Index() => View();

    /// <summary>Combos de selección de cuenta: sólo las operables.</summary>
    [HttpGet]
    public async Task<IActionResult> Lista(bool soloActivas = true, int? idLocal = null)
    {
        var cuentas = await _service.Listar(soloActivas, idLocal);
        return Ok(cuentas.Select(c => new
        {
            c.Id,
            c.Nombre,
            c.IdTipo,
            Tipo = c.IdTipoNavigation?.Nombre,
            EsEfectivo = c.IdTipoNavigation?.EsEfectivo ?? false,
            c.Moneda,
            c.IdLocal,
            Local = c.IdLocalNavigation?.Nombre,
            c.Activa,
            c.RequiereArqueo,
            c.PermiteNegativo,
            c.Color,
            c.Icono
        }));
    }

    /// <summary>Listado de administración: incluye saldo calculado y turno abierto.</summary>
    [HttpGet]
    public async Task<IActionResult> ListaConSaldos(bool soloActivas = false, int? idLocal = null)
        => Ok(await _cajas.SaldosPorCuenta(soloActivas, idLocal));

    [HttpGet]
    public async Task<IActionResult> Obtener(int id)
    {
        var c = await _service.Obtener(id);
        if (c == null) return NotFound();

        return Ok(new
        {
            c.Id,
            c.Nombre,
            c.IdTipo,
            c.IdLocal,
            c.Moneda,
            c.SaldoInicial,
            c.Banco,
            c.Cbu,
            c.Alias,
            c.Titular,
            c.Activa,
            c.PermiteNegativo,
            c.RequiereArqueo,
            c.Color,
            c.Icono,
            c.Orden,
            Saldo = await _cajas.SaldoCuenta(id)
        });
    }

    [HttpPost]
    public async Task<IActionResult> Guardar([FromBody] Cuenta model)
    {
        var result = await _service.Guardar(model);
        return Ok(new
        {
            valor = result.Ok,
            mensaje = result.Mensaje,
            tipo = result.Tipo,
            idReferencia = result.IdReferencia,
            id = result.IdReferencia
        });
    }

    [HttpPost]
    public async Task<IActionResult> CambiarEstado(int id, bool activa)
    {
        var result = await _service.CambiarEstado(id, activa);
        return Ok(new { valor = result.Ok, mensaje = result.Mensaje, tipo = result.Tipo });
    }

    [HttpDelete]
    public async Task<IActionResult> Eliminar(int id, bool cascade = false)
    {
        var sr = await DeleteOperationHelper.ExecuteDeleteAsync(
            c => _service.Eliminar(id, c),
            "la cuenta",
            cascade,
            id);
        return Ok(sr.ToEliminarJson());
    }

    // ── Compatibilidad con el modal genérico de configuraciones (Id + Nombre) ──

    [HttpPost]
    public async Task<IActionResult> Insertar([FromBody] VMGenericModel model)
    {
        var idTipo = model.IdCombo;
        if (idTipo <= 0)
        {
            var tipos = await _tipos.Listar();
            idTipo = tipos.FirstOrDefault()?.Id ?? 0;
        }

        var result = await _service.Guardar(new Cuenta
        {
            Nombre = model.Nombre ?? "",
            IdTipo = idTipo,
            Moneda = "ARS",
            Activa = true
        });
        return Ok(new
        {
            valor = result.Ok,
            mensaje = result.Mensaje,
            tipo = result.Tipo,
            idReferencia = result.IdReferencia,
            id = result.IdReferencia
        });
    }

    [HttpPut]
    public async Task<IActionResult> Actualizar([FromBody] VMGenericModel model)
    {
        var entity = await _service.Obtener(model.Id);
        if (entity == null) return Ok(new { valor = false, mensaje = "No se encontró la cuenta." });

        entity.Nombre = model.Nombre ?? "";
        var result = await _service.Guardar(entity);
        return Ok(new
        {
            valor = result.Ok,
            mensaje = result.Mensaje,
            tipo = result.Tipo,
            idReferencia = result.IdReferencia
        });
    }

    [HttpGet]
    public async Task<IActionResult> EditarInfo(int id)
    {
        var entity = await _service.Obtener(id);
        if (entity == null) return NotFound();
        return Ok(new { entity.Id, entity.Nombre });
    }
}

public class VMGenericModel
{
    public int Id { get; set; }
    public int IdCombo { get; set; }
    public string? Nombre { get; set; }
}
