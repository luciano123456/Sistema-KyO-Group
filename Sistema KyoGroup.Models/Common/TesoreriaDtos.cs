using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models.Common
{
    /// <summary>
    /// Asiento a registrar en el libro de caja. Es el único contrato de entrada del
    /// motor: cualquier módulo que mueva dinero arma uno de estos.
    /// </summary>
    public class CajaAsiento
    {
        public int IdCuenta { get; set; }
        public DateTime Fecha { get; set; }
        public string TipoMov { get; set; } = CajaTipoMov.Ingreso;

        /// <summary>Id del registro de origen. Junto a TipoMov hace el asiento idempotente.</summary>
        public int? IdMov { get; set; }

        public string Concepto { get; set; } = "";
        public decimal Ingreso { get; set; }
        public decimal Egreso { get; set; }

        public int? IdLocal { get; set; }
        public int? IdUnidadNegocio { get; set; }
        public int? IdMedioPago { get; set; }
        public int? IdSesion { get; set; }
        public string? NotaInterna { get; set; }
        public int IdUsuario { get; set; }

        public decimal Neto => Ingreso - Egreso;
    }

    public class CajaFiltro
    {
        public int? IdCuenta { get; set; }
        public int? IdLocal { get; set; }
        public int? IdUnidadNegocio { get; set; }
        public int? IdSesion { get; set; }
        public DateTime? FechaDesde { get; set; }
        public DateTime? FechaHasta { get; set; }
        public string? TipoMov { get; set; }
        public string? Texto { get; set; }
        public bool IncluirAnulados { get; set; }
    }

    public class GastoFiltro
    {
        public DateTime? FechaDesde { get; set; }
        public DateTime? FechaHasta { get; set; }
        public int? IdCategoria { get; set; }
        public int? IdProveedor { get; set; }
        public int? IdLocal { get; set; }
        public int? IdUnidadNegocio { get; set; }
        public int? IdEstado { get; set; }
        public string? Texto { get; set; }

        /// <summary>Sólo gastos con saldo pendiente y vencimiento cumplido.</summary>
        public bool SoloVencidos { get; set; }
        public bool SoloPendientes { get; set; }
        public bool IncluirAnulados { get; set; }
    }

    /// <summary>
    /// Alta/edición de un gasto desde la UI. Incluye el pago de contado opcional para
    /// poder cargar "gasto y pagado" en un solo paso.
    /// </summary>
    public class GastoGuardar
    {
        public int Id { get; set; }
        public int? IdUnidadNegocio { get; set; }
        public int? IdLocal { get; set; }
        public int IdCategoria { get; set; }
        public int? IdProveedor { get; set; }
        public DateTime Fecha { get; set; }
        public DateTime? FechaVencimiento { get; set; }
        public string Concepto { get; set; } = "";
        public string? Detalle { get; set; }
        public string? ComprobanteTipo { get; set; }
        public string? ComprobanteNumero { get; set; }
        public decimal Importe { get; set; }
        public bool ImpactaCuentaCorriente { get; set; }
        public string? NotaInterna { get; set; }

        public bool PagarAhora { get; set; }
        public int? IdCuentaPago { get; set; }
        public int? IdMedioPago { get; set; }
        public decimal? ImportePago { get; set; }
        public DateTime? FechaPago { get; set; }
    }

    /// <summary>Cuenta de fondos con su saldo ya calculado desde el libro de caja.</summary>
    public class CuentaSaldo
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = "";
        public int IdTipo { get; set; }
        public string Tipo { get; set; } = "";
        public bool EsEfectivo { get; set; }
        public int? IdLocal { get; set; }
        public string? Local { get; set; }
        public string Moneda { get; set; } = "ARS";
        public decimal SaldoInicial { get; set; }
        public decimal Ingresos { get; set; }
        public decimal Egresos { get; set; }
        public decimal Saldo { get; set; }
        public int Movimientos { get; set; }
        public DateTime? UltimoMovimiento { get; set; }
        public bool Activa { get; set; }
        public bool RequiereArqueo { get; set; }
        public bool PermiteNegativo { get; set; }
        public string? Color { get; set; }
        public string? Icono { get; set; }
        public int Orden { get; set; }
        public int? IdSesionAbierta { get; set; }
    }

    public class FlujoDia
    {
        public DateTime Fecha { get; set; }
        public decimal Ingresos { get; set; }
        public decimal Egresos { get; set; }
        public decimal Neto => Ingresos - Egresos;
        public decimal Acumulado { get; set; }
    }

    public class MontoPorClave
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = "";
        public decimal Monto { get; set; }
        public int Cantidad { get; set; }
        public string? Color { get; set; }
        public string? Icono { get; set; }
    }

    /// <summary>Foto de tesorería para el dashboard.</summary>
    public class TesoreriaResumen
    {
        public decimal SaldoTotal { get; set; }
        public decimal SaldoEfectivo { get; set; }
        public decimal SaldoBancario { get; set; }
        public decimal IngresosPeriodo { get; set; }
        public decimal EgresosPeriodo { get; set; }
        public decimal NetoPeriodo => IngresosPeriodo - EgresosPeriodo;
        public decimal GastosPeriodo { get; set; }
        public decimal GastosPendientes { get; set; }
        public decimal GastosVencidos { get; set; }
        public int CantidadGastosVencidos { get; set; }
        public decimal DeudaProveedores { get; set; }
        public decimal PagosPeriodo { get; set; }
        public int SesionesAbiertas { get; set; }
        public List<CuentaSaldo> Cuentas { get; set; } = new();
        public List<FlujoDia> Flujo { get; set; } = new();
        public List<MontoPorClave> GastosPorCategoria { get; set; } = new();
        public List<MontoPorClave> EgresosPorTipo { get; set; } = new();
    }

    public class CajaMesAgregado
    {
        public int Anio { get; set; }
        public int Mes { get; set; }
        public bool EsEfectivo { get; set; }
        public decimal Ingresos { get; set; }
        public decimal Egresos { get; set; }
    }

    public class GastoMesAgregado
    {
        public int Anio { get; set; }
        public int Mes { get; set; }
        public decimal Total { get; set; }
        public int Cantidad { get; set; }
    }

    public class FinanzasControlFiltro
    {
        public List<int>? Anios { get; set; }
        public List<int>? Meses { get; set; }
        public bool IncluirEfectivo { get; set; } = true;
        public bool IncluirBancos { get; set; } = true;
        public bool IncluirGastos { get; set; } = true;
    }

    public class FinanzasControlFila
    {
        public int Anio { get; set; }
        public int Mes { get; set; }
        public string MesNombre { get; set; } = "";
        public decimal IngEfectivo { get; set; }
        public decimal EgrEfectivo { get; set; }
        public decimal IngBanco { get; set; }
        public decimal EgrBanco { get; set; }
        public decimal Gastos { get; set; }
        public int CantidadGastos { get; set; }
        public decimal Ingresos { get; set; }
        public decimal Egresos { get; set; }
        public decimal Neto { get; set; }
    }

    public class FinanzasControlMensual
    {
        public decimal TotalIngresos { get; set; }
        public decimal TotalEgresos { get; set; }
        public decimal TotalGastos { get; set; }
        public decimal NetoPeriodo { get; set; }
        public decimal MaxGastos { get; set; }
        public FinanzasControlFila? MesMasGasto { get; set; }
        public FinanzasControlFila? MesMenosGasto { get; set; }
        public FinanzasControlFila? MejorNeto { get; set; }
        public FinanzasControlFila? PeorNeto { get; set; }
        public List<FinanzasControlFila> Filas { get; set; } = new();
    }

    /// <summary>Totales de un conjunto filtrado de movimientos de caja.</summary>
    public class CajaResumen
    {
        public decimal SaldoAnterior { get; set; }
        public decimal Ingresos { get; set; }
        public decimal Egresos { get; set; }
        public int Cantidad { get; set; }
        public decimal SaldoFinal => SaldoAnterior + Ingresos - Egresos;
    }
}
