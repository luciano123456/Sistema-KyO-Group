using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;

namespace SistemaKyoGroup.DAL;

/// <summary>
/// Crea y actualiza el esquema de Tesorería (cuentas de fondos, libro de caja,
/// sesiones/arqueo y gastos). Todo el DDL es idempotente porque el proyecto no usa
/// EF Migrations: se ejecuta en cada arranque igual que los demás schema helpers.
/// </summary>
public static class TesoreriaSchemaHelper
{
    public static async Task EnsureSchemaAsync(SistemaKyoGroupContext db)
    {
        await CrearTablasAsync(db);
        await AmpliarCuentasAsync(db);
        await AmpliarCajasAsync(db);
        await AmpliarProveedoresPagosAsync(db);
        await CrearIndicesAsync(db);
        await SeedAsync(db);
        await BackfillPagosProveedoresAsync(db);
    }

    // ─────────────────────────────── Tablas nuevas ───────────────────────────────

    private static async Task CrearTablasAsync(SistemaKyoGroupContext db)
    {
        await TryExec(db, @"
IF OBJECT_ID('CuentasTipos') IS NULL
BEGIN
    CREATE TABLE CuentasTipos (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CuentasTipos PRIMARY KEY,
        Nombre VARCHAR(70) NOT NULL,
        EsEfectivo BIT NOT NULL CONSTRAINT DF_CuentasTipos_EsEfectivo DEFAULT (0)
    );
    CREATE UNIQUE INDEX UQ_CuentasTipos_Nombre ON CuentasTipos (Nombre);
END");

        await TryExec(db, @"
IF OBJECT_ID('MediosPago') IS NULL
BEGIN
    CREATE TABLE MediosPago (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MediosPago PRIMARY KEY,
        Nombre VARCHAR(70) NOT NULL,
        IdCuentaDefecto INT NULL,
        AfectaCaja BIT NOT NULL CONSTRAINT DF_MediosPago_AfectaCaja DEFAULT (1),
        Activo BIT NOT NULL CONSTRAINT DF_MediosPago_Activo DEFAULT (1),
        Orden INT NOT NULL CONSTRAINT DF_MediosPago_Orden DEFAULT (0)
    );
    CREATE UNIQUE INDEX UQ_MediosPago_Nombre ON MediosPago (Nombre);
    ALTER TABLE MediosPago ADD CONSTRAINT FK_MediosPago_Cuentas
        FOREIGN KEY (IdCuentaDefecto) REFERENCES Cuentas (Id);
END");

        await TryExec(db, @"
IF OBJECT_ID('CajasSesiones') IS NULL
BEGIN
    CREATE TABLE CajasSesiones (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CajasSesiones PRIMARY KEY,
        IdCuenta INT NOT NULL,
        IdLocal INT NULL,
        IdUnidadNegocio INT NULL,
        IdEstado INT NOT NULL CONSTRAINT DF_CajasSesiones_IdEstado DEFAULT (1),
        FechaApertura DATETIME NOT NULL,
        FechaCierre DATETIME NULL,
        SaldoInicial DECIMAL(18, 2) NOT NULL CONSTRAINT DF_CajasSesiones_SaldoInicial DEFAULT (0),
        SaldoTeorico DECIMAL(18, 2) NULL,
        SaldoDeclarado DECIMAL(18, 2) NULL,
        Diferencia DECIMAL(18, 2) NULL,
        NotaApertura VARCHAR(300) NULL,
        NotaCierre VARCHAR(300) NULL,
        IdUsuarioAbre INT NOT NULL,
        IdUsuarioCierra INT NULL
    );
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_Cuentas
        FOREIGN KEY (IdCuenta) REFERENCES Cuentas (Id);
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_Locales
        FOREIGN KEY (IdLocal) REFERENCES Locales (Id);
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_UnidadesNegocio
        FOREIGN KEY (IdUnidadNegocio) REFERENCES Unidades_Negocio (Id);
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_UsuarioAbre
        FOREIGN KEY (IdUsuarioAbre) REFERENCES Usuarios (Id);
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_UsuarioCierra
        FOREIGN KEY (IdUsuarioCierra) REFERENCES Usuarios (Id);
    CREATE INDEX IX_CajasSesiones_Cuenta_Estado ON CajasSesiones (IdCuenta, IdEstado);
END");

        await TryExec(db, @"
IF OBJECT_ID('GastosCategorias') IS NULL
BEGIN
    CREATE TABLE GastosCategorias (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GastosCategorias PRIMARY KEY,
        Nombre VARCHAR(100) NOT NULL,
        IdPadre INT NULL,
        Color VARCHAR(20) NULL,
        Icono VARCHAR(40) NULL,
        Activa BIT NOT NULL CONSTRAINT DF_GastosCategorias_Activa DEFAULT (1),
        Orden INT NOT NULL CONSTRAINT DF_GastosCategorias_Orden DEFAULT (0)
    );
    CREATE UNIQUE INDEX UQ_GastosCategorias_Nombre ON GastosCategorias (Nombre);
    ALTER TABLE GastosCategorias ADD CONSTRAINT FK_GastosCategorias_Padre
        FOREIGN KEY (IdPadre) REFERENCES GastosCategorias (Id);
END");

        await TryExec(db, @"
IF OBJECT_ID('Gastos') IS NULL
BEGIN
    CREATE TABLE Gastos (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Gastos PRIMARY KEY,
        IdUnidadNegocio INT NULL,
        IdLocal INT NULL,
        IdCategoria INT NOT NULL,
        IdProveedor INT NULL,
        Fecha DATE NOT NULL,
        FechaVencimiento DATE NULL,
        Concepto VARCHAR(200) NOT NULL,
        Detalle VARCHAR(500) NULL,
        ComprobanteTipo VARCHAR(30) NULL,
        ComprobanteNumero VARCHAR(50) NULL,
        Importe DECIMAL(18, 2) NOT NULL,
        ImportePagado DECIMAL(18, 2) NOT NULL CONSTRAINT DF_Gastos_ImportePagado DEFAULT (0),
        IdEstado INT NOT NULL CONSTRAINT DF_Gastos_IdEstado DEFAULT (1),
        ImpactaCuentaCorriente BIT NOT NULL CONSTRAINT DF_Gastos_ImpactaCC DEFAULT (0),
        Anulado BIT NOT NULL CONSTRAINT DF_Gastos_Anulado DEFAULT (0),
        MotivoAnula VARCHAR(200) NULL,
        NotaInterna VARCHAR(300) NULL,
        IdUsuarioRegistra INT NOT NULL,
        FechaRegistra DATETIME NOT NULL CONSTRAINT DF_Gastos_FechaRegistra DEFAULT (GETDATE()),
        IdUsuarioModifica INT NULL,
        FechaModifica DATETIME NULL
    );
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_GastosCategorias
        FOREIGN KEY (IdCategoria) REFERENCES GastosCategorias (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_Proveedores
        FOREIGN KEY (IdProveedor) REFERENCES Proveedores (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_Locales
        FOREIGN KEY (IdLocal) REFERENCES Locales (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_UnidadesNegocio
        FOREIGN KEY (IdUnidadNegocio) REFERENCES Unidades_Negocio (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_UsuarioRegistra
        FOREIGN KEY (IdUsuarioRegistra) REFERENCES Usuarios (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_UsuarioModifica
        FOREIGN KEY (IdUsuarioModifica) REFERENCES Usuarios (Id);
    CREATE INDEX IX_Gastos_Fecha ON Gastos (Fecha DESC);
    CREATE INDEX IX_Gastos_Estado_Vencimiento ON Gastos (IdEstado, FechaVencimiento);
    CREATE INDEX IX_Gastos_Categoria ON Gastos (IdCategoria);
    CREATE INDEX IX_Gastos_Proveedor ON Gastos (IdProveedor);
END");

        await TryExec(db, @"
IF OBJECT_ID('GastosPagos') IS NULL
BEGIN
    CREATE TABLE GastosPagos (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GastosPagos PRIMARY KEY,
        IdGasto INT NOT NULL,
        IdCuenta INT NOT NULL,
        IdMedioPago INT NULL,
        IdCaja INT NULL,
        Fecha DATE NOT NULL,
        Importe DECIMAL(18, 2) NOT NULL,
        NotaInterna VARCHAR(300) NULL,
        Anulado BIT NOT NULL CONSTRAINT DF_GastosPagos_Anulado DEFAULT (0),
        IdUsuarioRegistra INT NOT NULL,
        FechaRegistra DATETIME NOT NULL CONSTRAINT DF_GastosPagos_FechaRegistra DEFAULT (GETDATE())
    );
    ALTER TABLE GastosPagos ADD CONSTRAINT FK_GastosPagos_Gastos
        FOREIGN KEY (IdGasto) REFERENCES Gastos (Id);
    ALTER TABLE GastosPagos ADD CONSTRAINT FK_GastosPagos_Cuentas
        FOREIGN KEY (IdCuenta) REFERENCES Cuentas (Id);
    ALTER TABLE GastosPagos ADD CONSTRAINT FK_GastosPagos_MediosPago
        FOREIGN KEY (IdMedioPago) REFERENCES MediosPago (Id);
    ALTER TABLE GastosPagos ADD CONSTRAINT FK_GastosPagos_UsuarioRegistra
        FOREIGN KEY (IdUsuarioRegistra) REFERENCES Usuarios (Id);
    CREATE INDEX IX_GastosPagos_Gasto ON GastosPagos (IdGasto);
END");
    }

    // ────────────────────────── Ampliación de tablas legacy ──────────────────────

    private static async Task AmpliarCuentasAsync(SistemaKyoGroupContext db)
    {
        await AddColumn(db, "Cuentas", "IdTipo", "INT NOT NULL CONSTRAINT DF_Cuentas_IdTipo DEFAULT (1)");
        await AddColumn(db, "Cuentas", "IdLocal", "INT NULL");
        await AddColumn(db, "Cuentas", "Moneda", "VARCHAR(10) NOT NULL CONSTRAINT DF_Cuentas_Moneda DEFAULT ('ARS')");
        await AddColumn(db, "Cuentas", "SaldoInicial", "DECIMAL(18, 2) NOT NULL CONSTRAINT DF_Cuentas_SaldoInicial DEFAULT (0)");
        await AddColumn(db, "Cuentas", "Banco", "VARCHAR(100) NULL");
        await AddColumn(db, "Cuentas", "Cbu", "VARCHAR(30) NULL");
        await AddColumn(db, "Cuentas", "Alias", "VARCHAR(60) NULL");
        await AddColumn(db, "Cuentas", "Titular", "VARCHAR(120) NULL");
        await AddColumn(db, "Cuentas", "Activa", "BIT NOT NULL CONSTRAINT DF_Cuentas_Activa DEFAULT (1)");
        await AddColumn(db, "Cuentas", "PermiteNegativo", "BIT NOT NULL CONSTRAINT DF_Cuentas_PermiteNegativo DEFAULT (1)");
        await AddColumn(db, "Cuentas", "RequiereArqueo", "BIT NOT NULL CONSTRAINT DF_Cuentas_RequiereArqueo DEFAULT (0)");
        await AddColumn(db, "Cuentas", "Color", "VARCHAR(20) NULL");
        await AddColumn(db, "Cuentas", "Icono", "VARCHAR(40) NULL");
        await AddColumn(db, "Cuentas", "Orden", "INT NOT NULL CONSTRAINT DF_Cuentas_Orden DEFAULT (0)");

        await TryExec(db, @"
IF OBJECT_ID('CuentasTipos') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cuentas_CuentasTipos')
AND NOT EXISTS (SELECT 1 FROM Cuentas c WHERE NOT EXISTS (SELECT 1 FROM CuentasTipos t WHERE t.Id = c.IdTipo))
    ALTER TABLE Cuentas ADD CONSTRAINT FK_Cuentas_CuentasTipos
        FOREIGN KEY (IdTipo) REFERENCES CuentasTipos (Id);");

        await TryExec(db, @"
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cuentas_Locales')
    ALTER TABLE Cuentas ADD CONSTRAINT FK_Cuentas_Locales
        FOREIGN KEY (IdLocal) REFERENCES Locales (Id);");
    }

    private static async Task AmpliarCajasAsync(SistemaKyoGroupContext db)
    {
        await AddColumn(db, "Cajas", "IdSesion", "INT NULL");
        await AddColumn(db, "Cajas", "IdLocal", "INT NULL");
        await AddColumn(db, "Cajas", "IdUnidadNegocio", "INT NULL");
        await AddColumn(db, "Cajas", "IdMedioPago", "INT NULL");
        await AddColumn(db, "Cajas", "NotaInterna", "VARCHAR(300) NULL");
        await AddColumn(db, "Cajas", "Anulado", "BIT NOT NULL CONSTRAINT DF_Cajas_Anulado DEFAULT (0)");
        await AddColumn(db, "Cajas", "MotivoAnula", "VARCHAR(200) NULL");
        await AddColumn(db, "Cajas", "IdUsuarioAnula", "INT NULL");
        await AddColumn(db, "Cajas", "FechaAnula", "DATETIME NULL");

        await TryExec(db, @"
IF OBJECT_ID('CajasSesiones') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cajas_CajasSesiones')
    ALTER TABLE Cajas ADD CONSTRAINT FK_Cajas_CajasSesiones
        FOREIGN KEY (IdSesion) REFERENCES CajasSesiones (Id);");

        await TryExec(db, @"
IF OBJECT_ID('MediosPago') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cajas_MediosPago')
    ALTER TABLE Cajas ADD CONSTRAINT FK_Cajas_MediosPago
        FOREIGN KEY (IdMedioPago) REFERENCES MediosPago (Id);");

        await TryExec(db, @"
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cajas_Locales')
    ALTER TABLE Cajas ADD CONSTRAINT FK_Cajas_Locales
        FOREIGN KEY (IdLocal) REFERENCES Locales (Id);");

        // Los conceptos de asientos automáticos son más largos que el VARCHAR(200) original.
        await TryExec(db, @"
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Cajas') AND name = 'Concepto' AND max_length > 0 AND max_length < 300
)
    ALTER TABLE Cajas ALTER COLUMN Concepto VARCHAR(300) NOT NULL;");
    }

    private static async Task AmpliarProveedoresPagosAsync(SistemaKyoGroupContext db)
    {
        await AddColumn(db, "ProveedoresPagos", "IdMedioPago", "INT NULL");
        await AddColumn(db, "ProveedoresPagos", "IdCaja", "INT NULL");
        await AddColumn(db, "ProveedoresPagos", "ComprobanteNumero", "VARCHAR(50) NULL");
        await AddColumn(db, "ProveedoresPagos", "Anulado", "BIT NOT NULL CONSTRAINT DF_ProveedoresPagos_Anulado DEFAULT (0)");

        await TryExec(db, @"
IF OBJECT_ID('MediosPago') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ProveedoresPagos_MediosPago')
    ALTER TABLE ProveedoresPagos ADD CONSTRAINT FK_ProveedoresPagos_MediosPago
        FOREIGN KEY (IdMedioPago) REFERENCES MediosPago (Id);");

        await TryExec(db, @"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProveedoresPagos_Proveedor_Fecha' AND object_id = OBJECT_ID('ProveedoresPagos'))
    CREATE INDEX IX_ProveedoresPagos_Proveedor_Fecha ON ProveedoresPagos (IdProveedor, Fecha DESC);");
    }

    private static async Task CrearIndicesAsync(SistemaKyoGroupContext db)
    {
        await TryExec(db, @"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cajas_Cuenta_Fecha' AND object_id = OBJECT_ID('Cajas'))
    CREATE INDEX IX_Cajas_Cuenta_Fecha ON Cajas (IdCuenta, Fecha) INCLUDE (Ingreso, Egreso, Anulado);");

        await TryExec(db, @"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cajas_Origen' AND object_id = OBJECT_ID('Cajas'))
    CREATE INDEX IX_Cajas_Origen ON Cajas (TipoMov, IdMov);");

        // Un mismo origen no puede tener dos asientos vigentes: es lo que hace idempotente al motor.
        await TryExec(db, @"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Cajas_Origen_Vigente' AND object_id = OBJECT_ID('Cajas'))
AND NOT EXISTS (
    SELECT 1 FROM Cajas WHERE IdMov IS NOT NULL AND Anulado = 0
    GROUP BY TipoMov, IdMov HAVING COUNT(*) > 1
)
    CREATE UNIQUE INDEX UX_Cajas_Origen_Vigente ON Cajas (TipoMov, IdMov)
        WHERE IdMov IS NOT NULL AND Anulado = 0;");

        await TryExec(db, @"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProveedoresCuentaCorriente_Origen' AND object_id = OBJECT_ID('Proveedores_CuentaCorriente'))
    CREATE INDEX IX_ProveedoresCuentaCorriente_Origen ON Proveedores_CuentaCorriente (TipoMov, IdMov);");
    }

    // ─────────────────────────────────── Seeds ───────────────────────────────────

    private static async Task SeedAsync(SistemaKyoGroupContext db)
    {
        await TryExec(db, @"
IF OBJECT_ID('CuentasTipos') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM CuentasTipos)
BEGIN
    SET IDENTITY_INSERT CuentasTipos ON;
    INSERT INTO CuentasTipos (Id, Nombre, EsEfectivo) VALUES
        (1, 'Efectivo', 1),
        (2, 'Banco', 0),
        (3, 'Billetera virtual', 0),
        (4, 'Tarjeta', 0),
        (5, 'Otro', 0);
    SET IDENTITY_INSERT CuentasTipos OFF;
END");

        await TryExec(db, @"
IF OBJECT_ID('MediosPago') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM MediosPago)
    INSERT INTO MediosPago (Nombre, AfectaCaja, Activo, Orden) VALUES
        ('Efectivo', 1, 1, 1),
        ('Transferencia bancaria', 1, 1, 2),
        ('Débito automático', 1, 1, 3),
        ('Tarjeta de débito', 1, 1, 4),
        ('Tarjeta de crédito', 1, 1, 5),
        ('Mercado Pago', 1, 1, 6),
        ('Cheque', 0, 1, 7),
        ('Otro', 1, 1, 8);");

        await TryExec(db, @"
IF OBJECT_ID('GastosCategorias') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM GastosCategorias)
BEGIN
    -- Los iconos se guardan sin el prefijo 'fa-': la UI lo agrega al renderizar.
    INSERT INTO GastosCategorias (Nombre, Color, Icono, Activa, Orden) VALUES
        ('Servicios',        '#c9a24a', 'bolt',            1, 1),
        ('Alquileres',       '#8bc34a', 'building',        1, 2),
        ('Sueldos y cargas', '#5f8f4a', 'users',           1, 3),
        ('Impuestos y tasas','#c2185b', 'university',      1, 4),
        ('Mantenimiento',    '#7a7088', 'wrench',          1, 5),
        ('Insumos y limpieza','#a8842e','shopping-basket', 1, 6),
        ('Marketing',        '#e8879f', 'bullhorn',        1, 7),
        ('Logística',        '#5b8def', 'truck',           1, 8),
        ('Honorarios',       '#8e6fc9', 'briefcase',       1, 9),
        ('Otros',            '#9a91a8', 'ellipsis-h',      1, 99);

    DECLARE @idServicios INT = (SELECT Id FROM GastosCategorias WHERE Nombre = 'Servicios');
    INSERT INTO GastosCategorias (Nombre, IdPadre, Color, Icono, Activa, Orden) VALUES
        ('Luz',       @idServicios, '#c9a24a', 'lightbulb-o', 1, 1),
        ('Gas',       @idServicios, '#c9a24a', 'fire',        1, 2),
        ('Agua',      @idServicios, '#c9a24a', 'tint',        1, 3),
        ('Internet',  @idServicios, '#c9a24a', 'wifi',        1, 4),
        ('Telefonía', @idServicios, '#c9a24a', 'phone',       1, 5);
END");

        // Instalación nueva: al menos una cuenta operativa para poder registrar movimientos.
        await TryExec(db, @"
IF OBJECT_ID('Cuentas') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Cuentas)
    INSERT INTO Cuentas (Nombre, IdTipo, Moneda, SaldoInicial, Activa, PermiteNegativo, RequiereArqueo, Color, Icono, Orden)
    VALUES ('Caja principal', 1, 'ARS', 0, 1, 0, 1, '#c9a24a', 'money', 1);");

        // Las cuentas de efectivo son las que tiene sentido arquear.
        await TryExec(db, @"
IF COL_LENGTH('Cuentas', 'RequiereArqueo') IS NOT NULL
    UPDATE Cuentas SET RequiereArqueo = 1
    WHERE IdTipo = 1 AND RequiereArqueo = 0
      AND NOT EXISTS (SELECT 1 FROM Cuentas c2 WHERE c2.RequiereArqueo = 1);");
    }

    // ─────────────────────────────────── Backfill ────────────────────────────────

    /// <summary>
    /// Los pagos a proveedores registrados antes de existir el libro de caja no
    /// tienen asiento. Se generan una sola vez para que los saldos cierren.
    /// </summary>
    private static async Task BackfillPagosProveedoresAsync(SistemaKyoGroupContext db)
    {
        await TryExec(db, @"
IF COL_LENGTH('Cajas', 'Anulado') IS NOT NULL
BEGIN
    INSERT INTO Cajas (IdCuenta, Fecha, TipoMov, IdMov, Concepto, Ingreso, Egreso,
                       NotaInterna, Anulado, IdUsuarioRegistra, FechaRegistra)
    SELECT p.IdCuenta,
           CAST(p.Fecha AS DATE),
           'PAGO_PROVEEDOR',
           p.Id,
           LEFT(CONCAT('Pago a ', ISNULL(pr.Nombre, 'proveedor'), ' — ', p.Concepto), 300),
           0,
           p.Importe,
           'Asiento generado automáticamente al migrar a Tesorería.',
           0,
           p.IdUsuarioRegistra,
           p.FechaRegistra
    FROM ProveedoresPagos p
    LEFT JOIN Proveedores pr ON pr.Id = p.IdProveedor
    WHERE ISNULL(p.Anulado, 0) = 0
      AND NOT EXISTS (
            SELECT 1 FROM Cajas c
            WHERE c.TipoMov = 'PAGO_PROVEEDOR' AND c.IdMov = p.Id
      );

    UPDATE p
    SET p.IdCaja = c.Id
    FROM ProveedoresPagos p
    INNER JOIN Cajas c ON c.TipoMov = 'PAGO_PROVEEDOR' AND c.IdMov = p.Id AND c.Anulado = 0
    WHERE p.IdCaja IS NULL;
END");
    }

    // ─────────────────────────────────── Utilidades ──────────────────────────────

    private static Task AddColumn(SistemaKyoGroupContext db, string table, string column, string definition)
        => TryExec(db, $@"
IF OBJECT_ID('{table}') IS NOT NULL AND COL_LENGTH('{table}', '{column}') IS NULL
    ALTER TABLE [{table}] ADD [{column}] {definition};");

    private static async Task TryExec(SistemaKyoGroupContext db, string sql)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(sql);
        }
        catch (Exception ex)
        {
            Console.WriteLine("TesoreriaSchemaHelper: " + ex.Message);
        }
    }
}
