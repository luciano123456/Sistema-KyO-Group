using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.Application.Extensions;
using SistemaKyoGroup.Application.Helpers;
using SistemaKyoGroup.Application.Models;
using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.BLL.Common;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using System;

namespace SistemaKyoGroup.Application.Controllers
{
    [Authorize]
    public class ProveedoresController : Controller
    {
        private readonly IProveedoresService _service;
        private readonly ICompraService _compraService;
        private readonly IProveedoresCuentaCorrienteService _ccService;
        private readonly SistemaKyoGroupContext _db;

        public ProveedoresController(
            IProveedoresService service,
            ICompraService compraService,
            IProveedoresCuentaCorrienteService ccService,
            SistemaKyoGroupContext db)
        {
            _service = service;
            _compraService = compraService;
            _ccService = ccService;
            _db = db;
        }

        [AllowAnonymous]
        public IActionResult Index() => View();

        [AllowAnonymous]
        public IActionResult Gestion(int id = 0)
        {
            ViewBag.Id = id;
            return View();
        }

        [AllowAnonymous]
        public IActionResult Analisis() => View();

        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            var query = await _service.ObtenerTodos();
            var lista = query.Select(p => new VMProveedor
            {
                Id = p.Id,
                Nombre = p.Nombre,
                Apodo = p.Apodo,
                Ubicacion = p.Ubicacion,
                Telefono = p.Telefono,
                Cbu = p.Cbu,
                Cuit = p.Cuit,
                IdUsuarioRegistra = (int)p.IdUsuarioRegistra,
                FechaRegistra = (DateTime)p.FechaRegistra,
                IdUsuarioModifica = p.IdUsuarioModifica,
                FechaModifica = p.FechaModifica,
                UsuarioRegistra = p.IdUsuarioRegistraNavigation != null ? p.IdUsuarioRegistraNavigation.Usuario : null,
                UsuarioModifica = p.IdUsuarioModificaNavigation != null ? p.IdUsuarioModificaNavigation.Usuario : null
            }).ToList();

            return Ok(lista);
        }

        [HttpGet]
        public async Task<IActionResult> ListaPaginada()
        {
            var draw = DataTablesRequestHelper.GetDraw(Request);
            var grid = DataTablesRequestHelper.Parse(Request);
            var result = await _service.ListarPaginado(grid);
            var data = result.Items.Select(p => new VMProveedor
            {
                Id = p.Id,
                Nombre = p.Nombre,
                Apodo = p.Apodo,
                Ubicacion = p.Ubicacion,
                Telefono = p.Telefono,
                Cbu = p.Cbu,
                Cuit = p.Cuit,
                IdUsuarioRegistra = (int)p.IdUsuarioRegistra,
                FechaRegistra = (DateTime)p.FechaRegistra,
                IdUsuarioModifica = p.IdUsuarioModifica,
                FechaModifica = p.FechaModifica,
                UsuarioRegistra = p.IdUsuarioRegistraNavigation != null ? p.IdUsuarioRegistraNavigation.Usuario : null,
                UsuarioModifica = p.IdUsuarioModificaNavigation != null ? p.IdUsuarioModificaNavigation.Usuario : null
            }).ToList();

            return Ok(new
            {
                draw,
                recordsTotal = result.Total,
                recordsFiltered = result.Filtered,
                data
            });
        }

        [HttpPost]
        public async Task<IActionResult> Insertar([FromBody] VMProveedor model)
        {
            var userId = User.GetUserId();
            var dup = await _service.BuscarDuplicado(model.Nombre, model.Cuit, 0);
            if (dup != null)
            {
                return Ok(new
                {
                    valor = false,
                    tipo = "duplicado",
                    idReferencia = dup.Id,
                    mensaje = $"Ya existe un proveedor con el mismo nombre o CUIT: {dup.Nombre}."
                });
            }

            var entity = new Proveedor
            {
                Nombre = model.Nombre,
                Apodo = model.Apodo,
                Ubicacion = model.Ubicacion,
                Telefono = model.Telefono,
                Cbu = model.Cbu,
                Cuit = model.Cuit,
                IdUsuarioRegistra = userId ?? model.IdUsuarioRegistra, // fallback si hicieras pruebas sin token
                FechaRegistra = DateTime.Now
            };

            bool ok = await _service.Insertar(entity);
            return Ok(new { valor = ok });
        }

        [HttpPut]
        public async Task<IActionResult> Actualizar([FromBody] VMProveedor model)
        {
            var entity = await _service.Obtener(model.Id);
            if (entity == null) return Ok(new { valor = false });

            var dup = await _service.BuscarDuplicado(model.Nombre, model.Cuit, model.Id);
            if (dup != null)
            {
                return Ok(new
                {
                    valor = false,
                    tipo = "duplicado",
                    idReferencia = dup.Id,
                    mensaje = $"Ya existe otro proveedor con el mismo nombre o CUIT: {dup.Nombre}."
                });
            }

            var userId = User.GetUserId();

            entity.Nombre = model.Nombre;
            entity.Apodo = model.Apodo;
            entity.Ubicacion = model.Ubicacion;
            entity.Telefono = model.Telefono;
            entity.Cbu = model.Cbu;
            entity.Cuit = model.Cuit;

            entity.IdUsuarioModifica = userId ?? model.IdUsuarioModifica;
            entity.FechaModifica = DateTime.Now;

            bool ok = await _service.Actualizar(entity);
            return Ok(new { valor = ok });
        }

        [HttpDelete]
        public async Task<IActionResult> Eliminar(int id, bool cascade = false)
        {
            var sr = await DeleteOperationHelper.ExecuteDeleteAsync(
                c => _service.Eliminar(id, c),
                "el proveedor",
                cascade,
                id);
            return Ok(sr.ToEliminarJson());
        }

        [HttpGet]
        public async Task<IActionResult> EditarInfo(int id)
        {
            var p = await _service.Obtener(id);
            if (p == null) return StatusCode(StatusCodes.Status404NotFound);

            var vm = new VMProveedor
            {
                Id = p.Id,
                Nombre = p.Nombre,
                Apodo = p.Apodo,
                Ubicacion = p.Ubicacion,
                Telefono = p.Telefono,
                Cbu = p.Cbu,
                Cuit = p.Cuit,
                IdUsuarioRegistra = (int)p.IdUsuarioRegistra,
                FechaRegistra = (DateTime)p.FechaRegistra,
                IdUsuarioModifica = p.IdUsuarioModifica,
                FechaModifica = p.FechaModifica,
                UsuarioRegistra = p.IdUsuarioRegistraNavigation?.Usuario,
                UsuarioModifica = p.IdUsuarioModificaNavigation?.Usuario
            };

            return StatusCode(StatusCodes.Status200OK, vm);
        }

        [HttpGet]
        public async Task<IActionResult> AnalisisDatos(
            DateTime? fechaDesde,
            DateTime? fechaHasta,
            int idUnidadNegocio = 0,
            int idLocal = 0,
            int idProveedor = 0)
        {
            var desde = (fechaDesde ?? new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1)).Date;
            var hasta = (fechaHasta ?? DateTime.Today).Date;
            if (hasta < desde) (desde, hasta) = (hasta, desde);
            var hastaFin = hasta.AddDays(1).AddTicks(-1);
            var dias = Math.Max(1, (hasta - desde).Days + 1);
            var prevHasta = desde.AddDays(-1);
            var prevDesde = prevHasta.AddDays(-(dias - 1));

            // —— Compras período actual ——
            var comprasQ = _db.Compras.AsNoTracking()
                .Include(c => c.IdProveedorNavigation)
                .Include(c => c.IdUnidadNegocioNavigation)
                .Include(c => c.IdLocalNavigation)
                .Where(c => c.Fecha >= desde && c.Fecha <= hastaFin);
            if (idUnidadNegocio > 0) comprasQ = comprasQ.Where(c => c.IdUnidadNegocio == idUnidadNegocio);
            if (idLocal > 0) comprasQ = comprasQ.Where(c => c.IdLocal == idLocal);
            if (idProveedor > 0) comprasQ = comprasQ.Where(c => c.IdProveedor == idProveedor);
            var compras = await comprasQ.ToListAsync();

            // —— Compras período anterior ——
            var comprasPrevQ = _db.Compras.AsNoTracking()
                .Where(c => c.Fecha >= prevDesde && c.Fecha <= prevHasta.AddDays(1).AddTicks(-1));
            if (idUnidadNegocio > 0) comprasPrevQ = comprasPrevQ.Where(c => c.IdUnidadNegocio == idUnidadNegocio);
            if (idLocal > 0) comprasPrevQ = comprasPrevQ.Where(c => c.IdLocal == idLocal);
            if (idProveedor > 0) comprasPrevQ = comprasPrevQ.Where(c => c.IdProveedor == idProveedor);
            var totalPrev = await comprasPrevQ.SumAsync(c => (decimal?)c.SubtotalFinal) ?? 0m;

            var totalActual = compras.Sum(c => c.SubtotalFinal);
            var cantCompras = compras.Count;
            var proveedoresActivos = compras.Select(c => c.IdProveedor).Distinct().Count();
            var ticketPromedio = cantCompras > 0 ? totalActual / cantCompras : 0m;
            var variacionPct = totalPrev == 0
                ? (totalActual > 0 ? 100m : 0m)
                : Math.Round(((totalActual - totalPrev) / totalPrev) * 100m, 1);

            // —— CC movimientos del período ——
            var movCcQ = _db.ProveedoresCuentaCorrientes.AsNoTracking()
                .Where(m => m.Fecha >= desde && m.Fecha <= hastaFin);
            if (idProveedor > 0) movCcQ = movCcQ.Where(m => m.IdProveedor == idProveedor);
            var movCc = await movCcQ.ToListAsync();
            var debePeriodo = movCc.Sum(m => m.Debe);
            var haberPeriodo = movCc.Sum(m => m.Haber);

            var proveedoresCc = await _ccService.ListarProveedoresConSaldo(null, false);
            if (idProveedor > 0)
                proveedoresCc = proveedoresCc.Where(x => x.proveedor.Id == idProveedor).ToList();
            var deudaTotal = proveedoresCc.Where(x => x.saldo > 0).Sum(x => x.saldo);
            var creditoTotal = proveedoresCc.Where(x => x.saldo < 0).Sum(x => Math.Abs(x.saldo));

            // —— OC ——
            var ocQ = _db.OrdenesCompras.AsNoTracking()
                .Include(o => o.IdEstadoNavigation)
                .Where(o => o.FechaEmision >= desde && o.FechaEmision <= hastaFin);
            if (idUnidadNegocio > 0) ocQ = ocQ.Where(o => o.IdUnidadNegocio == idUnidadNegocio);
            if (idLocal > 0) ocQ = ocQ.Where(o => o.IdLocal == idLocal);
            if (idProveedor > 0) ocQ = ocQ.Where(o => o.IdProveedor == idProveedor);
            var ocs = await ocQ.ToListAsync();
            var ocPendientes = ocs.Count(o => o.IdEstado == 1 || string.Equals(o.IdEstadoNavigation?.Nombre, "Pendiente", StringComparison.OrdinalIgnoreCase));
            var ocEntregadas = ocs.Count(o => o.IdEstado == 3 || string.Equals(o.IdEstadoNavigation?.Nombre, "Entregado", StringComparison.OrdinalIgnoreCase));
            var ocParciales = ocs.Count - ocPendientes - ocEntregadas;
            if (ocParciales < 0) ocParciales = 0;

            // —— Detalle insumos ——
            var compraIds = compras.Select(c => c.Id).ToList();
            var lineas = compraIds.Count == 0
                ? new List<ComprasInsumo>()
                : await _db.ComprasInsumos.AsNoTracking()
                    .Include(d => d.IdInsumoNavigation)
                    .Include(d => d.IdCompraNavigation).ThenInclude(c => c!.IdProveedorNavigation)
                    .Where(d => compraIds.Contains(d.IdCompra))
                    .ToListAsync();

            var insumosDistintos = lineas.Select(l => l.IdInsumo).Distinct().Count();

            // —— Serie diaria ——
            var serieCompras = compras
                .GroupBy(c => c.Fecha.Date)
                .OrderBy(g => g.Key)
                .Select(g => new
                {
                    Fecha = g.Key.ToString("yyyy-MM-dd"),
                    Label = g.Key.ToString("dd/MM"),
                    Total = g.Sum(x => x.SubtotalFinal),
                    Cantidad = g.Count()
                })
                .ToList();

            var flujoCc = movCc
                .GroupBy(m => m.Fecha.Date)
                .OrderBy(g => g.Key)
                .Select(g => new
                {
                    Fecha = g.Key.ToString("yyyy-MM-dd"),
                    Label = g.Key.ToString("dd/MM"),
                    Debe = g.Sum(x => x.Debe),
                    Haber = g.Sum(x => x.Haber),
                    Neto = g.Sum(x => x.Debe - x.Haber)
                })
                .ToList();

            // —— Top proveedores ——
            var topProveedores = compras
                .GroupBy(c => new { c.IdProveedor, Nombre = c.IdProveedorNavigation?.Nombre ?? "?" })
                .Select(g => new
                {
                    Id = g.Key.IdProveedor,
                    g.Key.Nombre,
                    Total = g.Sum(x => x.SubtotalFinal),
                    CantCompras = g.Count(),
                    TicketPromedio = g.Average(x => x.SubtotalFinal),
                    UltimaCompra = g.Max(x => x.Fecha)
                })
                .OrderByDescending(x => x.Total)
                .Take(12)
                .Select(x => new
                {
                    x.Id,
                    x.Nombre,
                    x.Total,
                    x.CantCompras,
                    x.TicketPromedio,
                    UltimaCompra = x.UltimaCompra.ToString("dd/MM/yyyy"),
                    Pct = totalActual > 0 ? Math.Round(x.Total / totalActual * 100m, 1) : 0m
                })
                .ToList();

            // —— Deuda ranking ——
            var deudaProveedores = proveedoresCc
                .Where(x => x.saldo != 0)
                .OrderByDescending(x => x.saldo)
                .Take(20)
                .Select(x => new
                {
                    Id = x.proveedor.Id,
                    x.proveedor.Nombre,
                    Saldo = x.saldo
                })
                .ToList();

            // —— Por UN / Local ——
            var porUnidad = compras
                .GroupBy(c => c.IdUnidadNegocioNavigation?.Nombre ?? "Sin UN")
                .Select(g => new { Nombre = g.Key, Total = g.Sum(x => x.SubtotalFinal), Cantidad = g.Count() })
                .OrderByDescending(x => x.Total)
                .ToList();

            var porLocal = compras
                .GroupBy(c => c.IdLocalNavigation?.Nombre ?? "Sin local")
                .Select(g => new { Nombre = g.Key, Total = g.Sum(x => x.SubtotalFinal), Cantidad = g.Count() })
                .OrderByDescending(x => x.Total)
                .Take(12)
                .ToList();

            // —— Top insumos ——
            var topInsumos = lineas
                .GroupBy(l => new
                {
                    l.IdInsumo,
                    Nombre = l.IdInsumoNavigation?.Descripcion ?? $"#{l.IdInsumo}"
                })
                .Select(g => new
                {
                    g.Key.IdInsumo,
                    g.Key.Nombre,
                    Cantidad = g.Sum(x => x.Cantidad),
                    Total = g.Sum(x => x.SubtotalFinal),
                    PrecioPromedio = g.Average(x => x.PrecioFinal),
                    Proveedores = g.Select(x => x.IdCompraNavigation?.IdProveedorNavigation?.Nombre)
                        .Where(n => !string.IsNullOrWhiteSpace(n))
                        .Distinct()
                        .Count()
                })
                .OrderByDescending(x => x.Total)
                .Take(15)
                .ToList();

            // —— Variación de precios (factura vs lista) ——
            var alertasPrecio = lineas
                .Where(l => Math.Abs(l.PrecioFactura - l.PrecioLista) > 0.01m)
                .GroupBy(l => new
                {
                    l.IdInsumo,
                    Nombre = l.IdInsumoNavigation?.Descripcion ?? $"#{l.IdInsumo}",
                    Proveedor = l.IdCompraNavigation?.IdProveedorNavigation?.Nombre ?? "?"
                })
                .Select(g =>
                {
                    var last = g.OrderByDescending(x => x.Id).First();
                    return new
                    {
                        g.Key.Nombre,
                        g.Key.Proveedor,
                        PrecioLista = last.PrecioLista,
                        PrecioFactura = last.PrecioFactura,
                        Diff = last.PrecioFactura - last.PrecioLista,
                        DiffPct = last.PrecioLista == 0
                            ? 0m
                            : Math.Round((last.PrecioFactura - last.PrecioLista) / last.PrecioLista * 100m, 1),
                        Veces = g.Count()
                    };
                })
                .OrderByDescending(x => Math.Abs(x.Diff))
                .Take(12)
                .ToList();

            // —— Tabla consolidada por proveedor ——
            var saldosDict = proveedoresCc.ToDictionary(x => x.proveedor.Id, x => x.saldo);
            var pagosPorProv = movCc
                .Where(m => m.Haber > 0)
                .GroupBy(m => m.IdProveedor)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Haber));

            var tablaProveedores = compras
                .GroupBy(c => new { c.IdProveedor, Nombre = c.IdProveedorNavigation?.Nombre ?? "?" })
                .Select(g =>
                {
                    var id = g.Key.IdProveedor;
                    var total = g.Sum(x => x.SubtotalFinal);
                    pagosPorProv.TryGetValue(id, out var pagado);
                    saldosDict.TryGetValue(id, out var saldo);
                    return new
                    {
                        Id = id,
                        g.Key.Nombre,
                        CantCompras = g.Count(),
                        Total = total,
                        Ticket = g.Average(x => x.SubtotalFinal),
                        Pagado = pagado,
                        Deuda = saldo,
                        UltimaCompra = g.Max(x => x.Fecha).ToString("dd/MM/yyyy"),
                        Pct = totalActual > 0 ? Math.Round(total / totalActual * 100m, 1) : 0m
                    };
                })
                .OrderByDescending(x => x.Total)
                .ToList();

            // —— Estados OC breakdown ——
            var ocPorEstado = ocs
                .GroupBy(o => o.IdEstadoNavigation?.Nombre ?? $"Estado {o.IdEstado}")
                .Select(g => new { Nombre = g.Key, Cantidad = g.Count(), Total = g.Sum(x => x.CostoTotal) })
                .OrderByDescending(x => x.Cantidad)
                .ToList();

            var topNombre = topProveedores.FirstOrDefault()?.Nombre ?? "—";

            return Ok(new
            {
                Periodo = new
                {
                    Desde = desde.ToString("yyyy-MM-dd"),
                    Hasta = hasta.ToString("yyyy-MM-dd"),
                    Dias = dias,
                    PrevDesde = prevDesde.ToString("yyyy-MM-dd"),
                    PrevHasta = prevHasta.ToString("yyyy-MM-dd")
                },
                Kpis = new
                {
                    TotalComprado = totalActual,
                    TotalAnterior = totalPrev,
                    VariacionPct = variacionPct,
                    CantCompras = cantCompras,
                    ProveedoresActivos = proveedoresActivos,
                    TicketPromedio = ticketPromedio,
                    DeudaTotal = deudaTotal,
                    CreditoTotal = creditoTotal,
                    DebePeriodo = debePeriodo,
                    HaberPeriodo = haberPeriodo,
                    OcTotal = ocs.Count,
                    OcPendientes = ocPendientes,
                    OcEntregadas = ocEntregadas,
                    OcParciales = ocParciales,
                    InsumosDistintos = insumosDistintos,
                    TopProveedor = topNombre
                },
                SerieCompras = serieCompras,
                FlujoCc = flujoCc,
                TopProveedores = topProveedores,
                DeudaProveedores = deudaProveedores,
                PorUnidadNegocio = porUnidad,
                PorLocal = porLocal,
                TopInsumos = topInsumos,
                AlertasPrecio = alertasPrecio,
                TablaProveedores = tablaProveedores,
                OcPorEstado = ocPorEstado
            });
        }

        /// <summary>
        /// Análisis completo de un proveedor (score, precios, competitividad, recomendación).
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> AnalisisProveedor(
            int id,
            DateTime? fechaDesde = null,
            DateTime? fechaHasta = null)
        {
            if (id <= 0) return BadRequest(new { mensaje = "Proveedor inválido." });

            var proveedor = await _db.Proveedores.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
            if (proveedor == null) return NotFound(new { mensaje = "Proveedor no encontrado." });

            var desde = (fechaDesde ?? new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1)).Date;
            var hasta = (fechaHasta ?? DateTime.Today).Date;
            if (hasta < desde) (desde, hasta) = (hasta, desde);
            var hastaFin = hasta.AddDays(1).AddTicks(-1);

            // Lista de precios del proveedor
            var listas = await _db.ProveedoresInsumosListas.AsNoTracking()
                .Where(l => l.IdProveedor == id)
                .ToListAsync();

            var listaIds = listas.Select(l => l.Id).ToList();

            // Vínculos insumo ↔ lista de este proveedor
            var vinculos = listaIds.Count == 0
                ? new List<InsumosProveedor>()
                : await _db.InsumosProveedores.AsNoTracking()
                    .Include(v => v.IdInsumoNavigation)
                    .Where(v => listaIds.Contains(v.IdListaProveedor))
                    .ToListAsync();

            var insumoIds = vinculos.Select(v => v.IdInsumo).Distinct().ToList();

            // Precios de mercado (otros proveedores) para mismos insumos
            List<(int IdInsumo, int IdProveedor, decimal Costo, string ProvNombre)> mercado;
            if (insumoIds.Count == 0)
            {
                mercado = new List<(int, int, decimal, string)>();
            }
            else
            {
                var mercadoRaw = await (
                    from v in _db.InsumosProveedores.AsNoTracking()
                    join l in _db.ProveedoresInsumosListas.AsNoTracking() on v.IdListaProveedor equals l.Id
                    join p in _db.Proveedores.AsNoTracking() on l.IdProveedor equals p.Id
                    where insumoIds.Contains(v.IdInsumo) && l.CostoUnitario > 0
                    select new { v.IdInsumo, l.IdProveedor, l.CostoUnitario, ProvNombre = p.Nombre }
                ).ToListAsync();
                mercado = mercadoRaw
                    .Select(x => (x.IdInsumo, x.IdProveedor, x.CostoUnitario, x.ProvNombre))
                    .ToList();
            }

            // Historial de precios de listas de este proveedor
            List<ProveedoresInsumosListaHistorial> historial;
            try
            {
                await ProveedoresInsumosHistorialHelper.EnsureTableAsync(_db);
                historial = listaIds.Count == 0
                    ? new List<ProveedoresInsumosListaHistorial>()
                    : await _db.ProveedoresInsumosListaHistoriales.AsNoTracking()
                        .Where(h => h.IdProveedor == id
                            && h.Fecha >= desde && h.Fecha <= hastaFin
                            && h.CostoUnitarioAnterior != null && h.CostoUnitarioNuevo != null)
                        .OrderByDescending(h => h.Fecha)
                        .Take(500)
                        .ToListAsync();
            }
            catch
            {
                historial = new List<ProveedoresInsumosListaHistorial>();
            }

            // Compras del período
            var compras = await _db.Compras.AsNoTracking()
                .Where(c => c.IdProveedor == id && c.Fecha >= desde && c.Fecha <= hastaFin)
                .OrderBy(c => c.Fecha)
                .ToListAsync();

            var compraIds = compras.Select(c => c.Id).ToList();
            var lineas = compraIds.Count == 0
                ? new List<ComprasInsumo>()
                : await _db.ComprasInsumos.AsNoTracking()
                    .Include(d => d.IdInsumoNavigation)
                    .Where(d => compraIds.Contains(d.IdCompra))
                    .ToListAsync();

            // CC
            var saldo = await _db.ProveedoresCuentaCorrientes.AsNoTracking()
                .Where(m => m.IdProveedor == id)
                .SumAsync(m => (decimal?)(m.Debe - m.Haber)) ?? 0m;

            var movPeriodo = await _db.ProveedoresCuentaCorrientes.AsNoTracking()
                .Where(m => m.IdProveedor == id && m.Fecha >= desde && m.Fecha <= hastaFin)
                .ToListAsync();

            var debePeriodo = movPeriodo.Sum(m => m.Debe);
            var haberPeriodo = movPeriodo.Sum(m => m.Haber);

            // OC
            var ocs = await _db.OrdenesCompras.AsNoTracking()
                .Include(o => o.IdEstadoNavigation)
                .Where(o => o.IdProveedor == id && o.FechaEmision >= desde && o.FechaEmision <= hastaFin)
                .ToListAsync();
            var ocPend = ocs.Count(o => o.IdEstado == 1);
            var ocEnt = ocs.Count(o => o.IdEstado == 3);
            var ocTotal = ocs.Count;
            var cumplimientoPct = ocTotal == 0 ? 50m : Math.Round((decimal)ocEnt / ocTotal * 100m, 1);

            // —— Competitividad ——
            var listaById = listas.ToDictionary(l => l.Id);
            var recomendadosTmp = new List<(string Nombre, decimal MiPrecio, decimal MejorOtro, decimal DiffPct, decimal Ahorro)>();
            var carosTmp = new List<(string Nombre, decimal MiPrecio, decimal PromedioMercado, decimal MejorOtro, decimal DiffPct)>();
            int masBaratoCount = 0, masCaroCount = 0, empateCount = 0;

            foreach (var v in vinculos)
            {
                if (!listaById.TryGetValue(v.IdListaProveedor, out var miLista)) continue;
                var miPrecio = miLista.CostoUnitario;
                if (miPrecio <= 0) continue;

                var otros = mercado.Where(m => m.IdInsumo == v.IdInsumo && m.IdProveedor != id).ToList();
                if (otros.Count == 0) continue;

                var minOtro = otros.Min(m => m.Costo);
                var avgOtro = otros.Average(m => m.Costo);
                var nombre = v.IdInsumoNavigation?.Descripcion ?? miLista.Descripcion;
                var diffPct = avgOtro == 0 ? 0m : Math.Round((miPrecio - avgOtro) / avgOtro * 100m, 1);

                if (miPrecio <= minOtro)
                {
                    masBaratoCount++;
                    recomendadosTmp.Add((nombre, miPrecio, minOtro, diffPct, Math.Max(0, minOtro - miPrecio)));
                }
                else if (miPrecio > avgOtro * 1.02m)
                {
                    masCaroCount++;
                    carosTmp.Add((nombre, miPrecio, Math.Round(avgOtro, 2), minOtro, diffPct));
                }
                else empateCount++;
            }

            var recomendados = recomendadosTmp
                .OrderBy(x => x.DiffPct)
                .Take(10)
                .Select(x => new { x.Nombre, x.MiPrecio, x.MejorOtro, x.DiffPct, x.Ahorro })
                .ToList();
            var caros = carosTmp
                .OrderByDescending(x => x.DiffPct)
                .Take(10)
                .Select(x => new { x.Nombre, x.MiPrecio, x.PromedioMercado, x.MejorOtro, x.DiffPct })
                .ToList();

            var competitividadTotal = masBaratoCount + masCaroCount + empateCount;
            var competitividadPct = competitividadTotal == 0
                ? 50m
                : Math.Round((decimal)masBaratoCount / competitividadTotal * 100m, 1);

            // —— Movimientos de precio ——
            var cambiosPrecio = historial
                .Where(h => h.CostoUnitarioAnterior.HasValue && h.CostoUnitarioNuevo.HasValue
                    && Math.Abs(h.CostoUnitarioNuevo.Value - h.CostoUnitarioAnterior.Value) > 0.0001m)
                .Select(h =>
                {
                    var ant = h.CostoUnitarioAnterior!.Value;
                    var neu = h.CostoUnitarioNuevo!.Value;
                    var lista = listas.FirstOrDefault(l => l.Id == h.IdLista);
                    var pct = ant == 0 ? 0m : Math.Round((neu - ant) / ant * 100m, 1);
                    return new
                    {
                        Nombre = lista?.Descripcion ?? h.Resumen,
                        Anterior = ant,
                        Nuevo = neu,
                        Diff = neu - ant,
                        DiffPct = pct,
                        Fecha = h.Fecha.ToString("dd/MM/yyyy"),
                        Origen = h.Origen
                    };
                })
                .ToList();

            var subas = cambiosPrecio.Where(x => x.Diff > 0).OrderByDescending(x => x.DiffPct).Take(8).ToList();
            var bajas = cambiosPrecio.Where(x => x.Diff < 0).OrderBy(x => x.DiffPct).Take(8).ToList();
            var cantSubas = cambiosPrecio.Count(x => x.Diff > 0);
            var cantBajas = cambiosPrecio.Count(x => x.Diff < 0);
            var variacionPromedio = cambiosPrecio.Count == 0
                ? 0m
                : Math.Round(cambiosPrecio.Average(x => x.DiffPct), 1);

            // —— Desvíos factura vs lista en compras ——
            var desvios = lineas
                .Where(l => Math.Abs(l.PrecioFactura - l.PrecioLista) > 0.01m)
                .GroupBy(l => l.IdInsumoNavigation?.Descripcion ?? $"#{l.IdInsumo}")
                .Select(g =>
                {
                    var last = g.OrderByDescending(x => x.Id).First();
                    var pct = last.PrecioLista == 0 ? 0m : Math.Round((last.PrecioFactura - last.PrecioLista) / last.PrecioLista * 100m, 1);
                    return new
                    {
                        Nombre = g.Key,
                        PrecioLista = last.PrecioLista,
                        PrecioFactura = last.PrecioFactura,
                        DiffPct = pct,
                        Veces = g.Count()
                    };
                })
                .OrderByDescending(x => Math.Abs(x.DiffPct))
                .Take(10)
                .ToList();

            var sobreprecioPct = desvios.Count == 0
                ? 0m
                : Math.Round(desvios.Average(x => x.DiffPct), 1);

            // —— Serie compras ——
            var serie = compras
                .GroupBy(c => c.Fecha.Date)
                .OrderBy(g => g.Key)
                .Select(g => new
                {
                    Label = g.Key.ToString("dd/MM"),
                    Total = g.Sum(x => x.SubtotalFinal),
                    Cantidad = g.Count()
                })
                .ToList();

            var totalComprado = compras.Sum(c => c.SubtotalFinal);
            var cantCompras = compras.Count;
            var ticket = cantCompras > 0 ? totalComprado / cantCompras : 0m;

            // —— SCORE (0-100) ——
            // Competitividad 0-35, Estabilidad precios 0-25, Cumplimiento OC 0-15, Deuda 0-15, Actividad 0-10
            decimal scoreComp = competitividadTotal == 0
                ? 18m
                : Math.Clamp(competitividadPct / 100m * 35m, 0, 35);
            // Menos subas y variación baja = mejor
            decimal scoreEstab;
            if (cambiosPrecio.Count == 0) scoreEstab = 18m;
            else
            {
                var penalSubas = Math.Min(15m, cantSubas * 1.5m);
                var penalVar = Math.Min(10m, Math.Abs(variacionPromedio) * 0.4m);
                scoreEstab = Math.Clamp(25m - penalSubas - penalVar, 0, 25);
            }
            decimal scoreCumpl = Math.Clamp(cumplimientoPct / 100m * 15m, 0, 15);
            decimal scoreDeuda;
            if (saldo <= 0) scoreDeuda = 15m;
            else if (totalComprado <= 0) scoreDeuda = 8m;
            else
            {
                var ratio = saldo / Math.Max(totalComprado, 1m);
                scoreDeuda = Math.Clamp(15m - ratio * 20m, 0, 15);
            }
            decimal scoreAct = cantCompras == 0 ? 3m : Math.Clamp(3m + cantCompras * 1.2m, 0, 10);
            // Penalizar sobreprecio factura
            if (sobreprecioPct > 5) scoreEstab = Math.Max(0, scoreEstab - Math.Min(8m, sobreprecioPct * 0.3m));

            var score = (int)Math.Round(scoreComp + scoreEstab + scoreCumpl + scoreDeuda + scoreAct);
            score = Math.Clamp(score, 0, 100);

            string nivel, titulo, color, recomendacion;
            if (score >= 75)
            {
                nivel = "Excelente opción";
                titulo = "Sí: conviene seguir comprándole";
                color = "excelente";
                recomendacion = "Podés priorizarlo como proveedor habitual. Conviene mantener la relación y negociar volumen donde ya es competitivo.";
            }
            else if (score >= 55)
            {
                nivel = "Buena opción";
                titulo = "Sirve, pero mirá un par de puntos";
                color = "buena";
                recomendacion = "Seguí comprándole en lo que rinde, y revisá los ítems caros o con entregas flojas antes de ampliar el surtido.";
            }
            else if (score >= 40)
            {
                nivel = "Regular";
                titulo = "No es ideal: conviene comparar";
                color = "regular";
                recomendacion = "Usalo con cuidado. Compará precios con otros proveedores y pedí mejoras en lo que más te duele (precio, plazos o factura).";
            }
            else
            {
                nivel = "Riesgosa";
                titulo = "Hoy no es la mejor apuesta";
                color = "mala";
                recomendacion = "Antes de seguir comprando fuerte, mirá alternativas. Si lo necesitás igual, limitá el riesgo y negociá condiciones.";
            }

            var aFavor = new List<string>();
            var ojoCon = new List<string>();

            if (masBaratoCount > 0)
                aFavor.Add($"Tiene {masBaratoCount} producto{(masBaratoCount == 1 ? "" : "s")} más barato{(masBaratoCount == 1 ? "" : "s")} que el resto del mercado: ahí conviene comprarle.");
            if (cantBajas > 0)
                aFavor.Add($"Bajó precio en {cantBajas} ítem{(cantBajas == 1 ? "" : "s")} en el período: hay señales de que está mejorando o ajustando.");
            if (saldo < 0)
                aFavor.Add($"En cuenta corriente estás a favor por ${Math.Abs(saldo):N2}: no hay presión de deuda con este proveedor.");
            else if (saldo == 0 && (debePeriodo > 0 || haberPeriodo > 0 || cantCompras > 0))
                aFavor.Add("La cuenta corriente está equilibrada: no arrastrás saldo pendiente con él.");
            if (cumplimientoPct >= 80 && ocTotal > 0)
                aFavor.Add($"Cumple bien las órdenes: entregó {ocEnt} de {ocTotal} ({cumplimientoPct}%).");
            if (cantCompras > 0)
                aFavor.Add($"En el período le compraste {cantCompras} vez{(cantCompras == 1 ? "" : "es")} por ${totalComprado:N0} (ticket promedio ${ticket:N0}).");
            if (listas.Count >= 10)
                aFavor.Add($"Trae una lista amplia ({listas.Count} ítems): da para consolidar compras en un solo lugar.");

            if (masCaroCount > 0)
                ojoCon.Add($"Hay {masCaroCount} producto{(masCaroCount == 1 ? "" : "s")} más caro{(masCaroCount == 1 ? "" : "s")} que el promedio de otros proveedores: ahí te conviene cotizar afuera.");
            if (cantSubas > 0)
                ojoCon.Add($"Subió {cantSubas} precio{(cantSubas == 1 ? "" : "s")} en el período (variación promedio {variacionPromedio:+0.#;-0.#}%). Si se repite, el margen se come.");
            if (saldo > 0)
                ojoCon.Add($"Tenés deuda en cuenta corriente por ${saldo:N2}. Sumá eso al costo real de comprarle.");
            if (ocTotal > 0 && cumplimientoPct < 70)
                ojoCon.Add($"El cumplimiento de órdenes está flojo: solo {ocEnt} de {ocTotal} entregadas ({cumplimientoPct}%). Puede atrasarte el stock.");
            else if (ocTotal > 0 && cumplimientoPct < 100 && cumplimientoPct >= 70)
                ojoCon.Add($"Todavía hay órdenes pendientes: {ocPend} de {ocTotal}. Conviene seguir de cerca las entregas.");
            if (desvios.Count > 0)
                ojoCon.Add($"En {desvios.Count} compra{(desvios.Count == 1 ? "" : "s")} la factura no coincidió con la lista (desvío promedio {sobreprecioPct:+0.#;-0.#}%). Revisá esos casos.");
            if (competitividadTotal == 0)
                ojoCon.Add("Todavía no hay muchos vínculos con insumos del sistema para comparar precios contra otros proveedores.");
            if (cantCompras == 0)
                ojoCon.Add("No hay compras registradas en este período: el puntaje se arma más con lista, precios y cuenta corriente.");

            if (aFavor.Count == 0 && ojoCon.Count == 0)
                aFavor.Add("Todavía hay poca información. Cargá lista de precios y alguna compra para que el análisis sea más fino.");

            // Texto más humano (criollo, pero claro) para el usuario final.
            // Ojo: el score/kpis siguen estando abajo; acá buscamos una recomendación "en una mirada".
            var resumenPartes = new List<string>();

            if (score >= 75)
                resumenPartes.Add($"En este período, {proveedor.Nombre} es una apuesta firme: en general rinde bien y conviene seguir comprándole.");
            else if (score >= 55)
                resumenPartes.Add($"En este período, {proveedor.Nombre} cumple bastante bien: te conviene seguir, pero con atención en los puntos donde no es tan competitivo.");
            else if (score >= 40)
                resumenPartes.Add($"En este período, con {proveedor.Nombre} conviene ir comparando: no es una mala opción, pero tampoco es para ampliar sin chequear.");
            else
                resumenPartes.Add($"En este período, {proveedor.Nombre} no es la mejor alternativa: antes de comprar fuerte, mirá opciones comparables.");

            if (competitividadTotal > 0)
            {
                if (masBaratoCount > masCaroCount)
                    resumenPartes.Add($"Comparado con otros proveedores, en {masBaratoCount} de {competitividadTotal} productos estuvo mejor parado que el mercado.");
                else if (masCaroCount > masBaratoCount)
                    resumenPartes.Add($"Comparado con otros proveedores, en {masCaroCount} de {competitividadTotal} productos aparece más caro que el mercado.");
                else
                    resumenPartes.Add($"Comparado con otros proveedores, está bastante parejo frente al mercado (mix de baratos y caros).");
            }

            if (cantCompras > 0)
                resumenPartes.Add($"Ya le compraste ${totalComprado:N0} en el período (ticket promedio ${ticket:N0}).");
            else
                resumenPartes.Add("En el período elegido todavía no hay compras cargadas, así que el análisis depende más de lista y vínculos.");

            if (saldo < 0)
                resumenPartes.Add($"Además, en cuenta corriente estás a favor por ${Math.Abs(saldo):N2}, así que el riesgo financiero es menor.");
            else if (saldo > 0)
                resumenPartes.Add($"Ojo con cuenta corriente: quedás debiendo ${saldo:N2}, que conviene considerar al momento de decidir.");

            if (ocTotal > 0)
            {
                if (cumplimientoPct >= 80)
                    resumenPartes.Add($"Y en entregas, las órdenes vienen bastante bien: {ocEnt}/{ocTotal} entregadas ({cumplimientoPct}%).");
                else
                    resumenPartes.Add($"Y en entregas, está para revisar: {ocEnt}/{ocTotal} entregadas ({cumplimientoPct}%).");
            }

            var resumen = string.Join(" ", resumenPartes);

            return Ok(new
            {
                Proveedor = new { proveedor.Id, proveedor.Nombre },
                Periodo = new { Desde = desde.ToString("yyyy-MM-dd"), Hasta = hasta.ToString("yyyy-MM-dd") },
                Veredicto = new
                {
                    Score = score,
                    Nivel = nivel,
                    Titulo = titulo,
                    Color = color,
                    Resumen = resumen,
                    Recomendacion = recomendacion,
                    AFavor = aFavor,
                    OjoCon = ojoCon,
                    Bullets = aFavor.Concat(ojoCon).Take(8).ToList(),
                    Componentes = new
                    {
                        Competitividad = Math.Round(scoreComp, 1),
                        Estabilidad = Math.Round(scoreEstab, 1),
                        Cumplimiento = Math.Round(scoreCumpl, 1),
                        Deuda = Math.Round(scoreDeuda, 1),
                        Actividad = Math.Round(scoreAct, 1)
                    }
                },
                Kpis = new
                {
                    TotalComprado = totalComprado,
                    CantCompras = cantCompras,
                    TicketPromedio = ticket,
                    SaldoCc = saldo,
                    DebePeriodo = debePeriodo,
                    HaberPeriodo = haberPeriodo,
                    ItemsLista = listas.Count,
                    MasBarato = masBaratoCount,
                    MasCaro = masCaroCount,
                    CompetitividadPct = competitividadPct,
                    Subas = cantSubas,
                    Bajas = cantBajas,
                    VariacionPromedioPct = variacionPromedio,
                    OcTotal = ocTotal,
                    OcPendientes = ocPend,
                    OcEntregadas = ocEnt,
                    CumplimientoPct = cumplimientoPct
                },
                SerieCompras = serie,
                Subas = subas,
                Bajas = bajas,
                Recomendados = recomendados,
                Caros = caros,
                Desvios = desvios
            });
        }

        public IActionResult Privacy() => View();

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel
            {
                RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier
            });
        }

    }
}
