namespace SistemaKyoGroup.Models.Common
{
    /// <summary>
    /// Tipos de movimiento del libro de caja (columna Cajas.TipoMov).
    /// Cada asiento se identifica de forma única por (TipoMov, IdMov): eso es lo que
    /// permite que el motor sea idempotente y reversible.
    /// </summary>
    public static class CajaTipoMov
    {
        public const string Apertura = "APERTURA";
        public const string Ingreso = "INGRESO";
        public const string Egreso = "EGRESO";
        public const string Gasto = "GASTO";
        public const string PagoProveedor = "PAGO_PROVEEDOR";
        public const string Cobro = "COBRO";
        public const string TransferenciaSalida = "TRANSF_SALIDA";
        public const string TransferenciaEntrada = "TRANSF_ENTRADA";
        public const string Recaudacion = "RECAUDACION";
        public const string AjusteCierre = "AJUSTE_CIERRE";
        public const string Ajuste = "AJUSTE";

        /// <summary>Movimientos que el usuario carga a mano y por eso puede editar/eliminar libremente.</summary>
        public static readonly string[] Manuales = { Ingreso, Egreso, Ajuste };

        /// <summary>Movimientos generados por otro módulo: sólo se revierten desde su origen.</summary>
        public static readonly string[] Automaticos =
        {
            Gasto, PagoProveedor, Cobro, TransferenciaSalida,
            TransferenciaEntrada, Recaudacion, Apertura, AjusteCierre
        };

        public static bool EsManual(string? tipoMov)
            => tipoMov != null && Manuales.Contains(tipoMov, StringComparer.OrdinalIgnoreCase);

        public static string Etiqueta(string? tipoMov) => tipoMov switch
        {
            Apertura => "Apertura de caja",
            Ingreso => "Ingreso manual",
            Egreso => "Egreso manual",
            Gasto => "Gasto",
            PagoProveedor => "Pago a proveedor",
            Cobro => "Cobro",
            TransferenciaSalida => "Transferencia enviada",
            TransferenciaEntrada => "Transferencia recibida",
            Recaudacion => "Recaudación de ventas",
            AjusteCierre => "Ajuste por arqueo",
            Ajuste => "Ajuste manual",
            _ => tipoMov ?? ""
        };
    }

    /// <summary>Tipos de cuenta de fondos (tabla CuentasTipos).</summary>
    public static class CuentaTipo
    {
        public const int Efectivo = 1;
        public const int Banco = 2;
        public const int BilleteraVirtual = 3;
        public const int Tarjeta = 4;
        public const int Otro = 5;
    }

    /// <summary>Estados de una sesión de caja (columna CajasSesiones.IdEstado).</summary>
    public static class CajaSesionEstado
    {
        public const int Abierta = 1;
        public const int Cerrada = 2;

        public static string Etiqueta(int id) => id switch
        {
            Abierta => "Abierta",
            Cerrada => "Cerrada",
            _ => "Desconocido"
        };
    }

    /// <summary>
    /// Estados de un gasto (columna Gastos.IdEstado). Derivados de los pagos
    /// registrados: nunca se setean a mano.
    /// </summary>
    public static class GastoEstado
    {
        public const int Pendiente = 1;
        public const int Parcial = 2;
        public const int Pagado = 3;
        public const int Anulado = 4;

        public static string Etiqueta(int id) => id switch
        {
            Pendiente => "Pendiente",
            Parcial => "Pago parcial",
            Pagado => "Pagado",
            Anulado => "Anulado",
            _ => "Desconocido"
        };
    }

    /// <summary>Tipos de movimiento de la cuenta corriente de proveedores.</summary>
    public static class CuentaCorrienteTipoMov
    {
        public const string Compra = "COMPRA";
        public const string Pago = "PAGO";
        public const string Gasto = "GASTO";
        public const string PagoGasto = "PAGO_GASTO";
        public const string Ajuste = "AJUSTE";

        public static string Etiqueta(string? tipoMov) => tipoMov switch
        {
            Compra => "Compra",
            Pago => "Pago",
            Gasto => "Gasto",
            PagoGasto => "Pago de gasto",
            Ajuste => "Ajuste",
            _ => tipoMov ?? ""
        };
    }
}
