using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
public class TesoreriaController : Controller
{
    private readonly ITesoreriaService _service;
    private readonly ICuentasService _cuentas;
    private readonly IGastosCategoriasService _categorias;
    private readonly IMediosPagoService _mediosPago;
    private readonly ICuentasTiposService _cuentasTipos;
    private readonly ILocalesService _locales;
    private readonly IUnidadesNegocioService _unidades;
    private readonly IProveedoresService _proveedores;

    public TesoreriaController(
        ITesoreriaService service,
        ICuentasService cuentas,
        IGastosCategoriasService categorias,
        IMediosPagoService mediosPago,
        ICuentasTiposService cuentasTipos,
        ILocalesService locales,
        IUnidadesNegocioService unidades,
        IProveedoresService proveedores)
    {
        _service = service;
        _cuentas = cuentas;
        _categorias = categorias;
        _mediosPago = mediosPago;
        _cuentasTipos = cuentasTipos;
        _locales = locales;
        _unidades = unidades;
        _proveedores = proveedores;
    }

    [AllowAnonymous]
    public IActionResult Index() => RedirectToAction("Index", "Finanzas");

    [HttpGet]
    public async Task<IActionResult> Resumen(DateTime? fechaDesde, DateTime? fechaHasta, int? idCuenta, int? idLocal)
    {
        // Por defecto el mes en curso: es la lectura que se pide todos los días.
        var hoy = DateTime.Today;
        var desde = fechaDesde?.Date ?? new DateTime(hoy.Year, hoy.Month, 1);
        var hasta = fechaHasta?.Date ?? hoy;
        if (hasta < desde) (desde, hasta) = (hasta, desde);

        return Ok(await _service.Resumen(desde, hasta, idCuenta, idLocal));
    }

    [HttpGet]
    public async Task<IActionResult> Vencimientos(int dias = 30, int top = 15)
    {
        var gastos = await _service.ProximosVencimientos(dias, top);
        var hoy = DateTime.Today;

        return Ok(gastos.Select(g => new
        {
            g.Id,
            g.Concepto,
            g.FechaVencimiento,
            Categoria = g.IdCategoriaNavigation?.Nombre,
            CategoriaColor = g.IdCategoriaNavigation?.Color,
            Proveedor = g.IdProveedorNavigation?.Nombre,
            Pendiente = g.Importe - g.ImportePagado,
            DiasParaVencer = (int)(g.FechaVencimiento!.Value.Date - hoy).TotalDays,
            Vencido = g.FechaVencimiento!.Value.Date < hoy
        }));
    }

    /// <summary>
    /// Todos los combos de tesorería en una sola llamada: las pantallas de cajas,
    /// gastos y cuentas comparten exactamente estos catálogos.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Catalogos()
    {
        var cuentas = await _cuentas.Listar(soloActivas: true, idLocal: null);
        var categorias = await _categorias.Listar(soloActivas: true);
        var mediosPago = await _mediosPago.Listar(soloActivos: true);
        var tiposCuenta = await _cuentasTipos.Listar();
        var locales = await (await _locales.ObtenerTodos()).AsNoTracking()
            .Select(l => new { l.Id, l.Nombre, l.IdUnidadNegocio }).ToListAsync();
        var unidades = await (await _unidades.ObtenerTodos()).AsNoTracking()
            .Select(u => new { u.Id, u.Nombre }).ToListAsync();
        var proveedores = await (await _proveedores.ObtenerTodos()).AsNoTracking()
            .OrderBy(p => p.Nombre)
            .Select(p => new { p.Id, p.Nombre }).ToListAsync();

        return Ok(new
        {
            Cuentas = cuentas.Select(c => new
            {
                c.Id,
                c.Nombre,
                c.IdTipo,
                Tipo = c.IdTipoNavigation?.Nombre,
                EsEfectivo = c.IdTipoNavigation?.EsEfectivo ?? false,
                c.IdLocal,
                c.Moneda,
                c.RequiereArqueo,
                c.PermiteNegativo,
                c.Color,
                c.Icono
            }),
            Categorias = categorias.Select(c => new
            {
                c.Id,
                c.Nombre,
                NombreCompleto = c.IdPadreNavigation != null ? $"{c.IdPadreNavigation.Nombre} › {c.Nombre}" : c.Nombre,
                c.IdPadre,
                c.Color,
                c.Icono
            }),
            MediosPago = mediosPago.Select(m => new { m.Id, m.Nombre, m.IdCuentaDefecto, m.AfectaCaja }),
            TiposCuenta = tiposCuenta.Select(t => new { t.Id, t.Nombre, t.EsEfectivo }),
            Locales = locales,
            UnidadesNegocio = unidades,
            Proveedores = proveedores,
            TiposMovimiento = new[]
            {
                CajaTipoMov.Ingreso, CajaTipoMov.Egreso, CajaTipoMov.Gasto,
                CajaTipoMov.PagoProveedor, CajaTipoMov.Cobro, CajaTipoMov.Recaudacion,
                CajaTipoMov.TransferenciaEntrada, CajaTipoMov.TransferenciaSalida,
                CajaTipoMov.Apertura, CajaTipoMov.Ajuste, CajaTipoMov.AjusteCierre
            }.Select(t => new { Id = t, Nombre = CajaTipoMov.Etiqueta(t), EsManual = CajaTipoMov.EsManual(t) }),
            EstadosGasto = new[] { GastoEstado.Pendiente, GastoEstado.Parcial, GastoEstado.Pagado, GastoEstado.Anulado }
                .Select(e => new { Id = e, Nombre = GastoEstado.Etiqueta(e) })
        });
    }
}
