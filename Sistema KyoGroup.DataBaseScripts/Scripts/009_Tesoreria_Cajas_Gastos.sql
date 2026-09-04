/* ============================================================================
   009 — Tesorería: cuentas de fondos, libro de caja, arqueo y gastos

   Espeja lo que TesoreriaSchemaHelper aplica al arrancar la aplicación. Sirve
   para instalaciones donde el despliegue de base es manual. Todo el script es
   idempotente: se puede correr varias veces sin efectos secundarios.

   Orden: catálogos → ampliación de tablas existentes → tablas nuevas →
          índices → historiales → seeds → backfill.
   ============================================================================ */

SET NOCOUNT ON;
GO

/* ─────────────────────────── 1. Catálogos base ─────────────────────────── */

IF OBJECT_ID('CuentasTipos') IS NULL
BEGIN
    CREATE TABLE CuentasTipos (
        Id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CuentasTipos PRIMARY KEY,
        Nombre     VARCHAR(70) NOT NULL,
        EsEfectivo BIT NOT NULL CONSTRAINT DF_CuentasTipos_EsEfectivo DEFAULT (0)
    );
    CREATE UNIQUE INDEX UQ_CuentasTipos_Nombre ON CuentasTipos (Nombre);
END
GO

IF OBJECT_ID('CuentasTipos') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM CuentasTipos)
BEGIN
    SET IDENTITY_INSERT CuentasTipos ON;
    INSERT INTO CuentasTipos (Id, Nombre, EsEfectivo) VALUES
        (1, 'Efectivo',          1),
        (2, 'Banco',             0),
        (3, 'Billetera virtual', 0),
        (4, 'Tarjeta',           0),
        (5, 'Otro',              0);
    SET IDENTITY_INSERT CuentasTipos OFF;
END
GO

/* ──────────────────── 2. Cuentas: pasa a ser entidad real ──────────────────
   Antes era apenas un nombre. Ahora tiene tipo, moneda, saldo de arranque y
   las banderas que gobiernan cómo se opera (arqueo y descubierto).
   ------------------------------------------------------------------------- */

IF COL_LENGTH('Cuentas', 'IdTipo')          IS NULL ALTER TABLE Cuentas ADD IdTipo          INT NOT NULL CONSTRAINT DF_Cuentas_IdTipo DEFAULT (1);
IF COL_LENGTH('Cuentas', 'IdLocal')         IS NULL ALTER TABLE Cuentas ADD IdLocal         INT NULL;
IF COL_LENGTH('Cuentas', 'Moneda')          IS NULL ALTER TABLE Cuentas ADD Moneda          VARCHAR(10) NOT NULL CONSTRAINT DF_Cuentas_Moneda DEFAULT ('ARS');
IF COL_LENGTH('Cuentas', 'SaldoInicial')    IS NULL ALTER TABLE Cuentas ADD SaldoInicial    DECIMAL(18,2) NOT NULL CONSTRAINT DF_Cuentas_SaldoInicial DEFAULT (0);
IF COL_LENGTH('Cuentas', 'Banco')           IS NULL ALTER TABLE Cuentas ADD Banco           VARCHAR(100) NULL;
IF COL_LENGTH('Cuentas', 'Cbu')             IS NULL ALTER TABLE Cuentas ADD Cbu             VARCHAR(30) NULL;
IF COL_LENGTH('Cuentas', 'Alias')           IS NULL ALTER TABLE Cuentas ADD Alias           VARCHAR(60) NULL;
IF COL_LENGTH('Cuentas', 'Titular')         IS NULL ALTER TABLE Cuentas ADD Titular         VARCHAR(120) NULL;
IF COL_LENGTH('Cuentas', 'Activa')          IS NULL ALTER TABLE Cuentas ADD Activa          BIT NOT NULL CONSTRAINT DF_Cuentas_Activa DEFAULT (1);
IF COL_LENGTH('Cuentas', 'PermiteNegativo') IS NULL ALTER TABLE Cuentas ADD PermiteNegativo BIT NOT NULL CONSTRAINT DF_Cuentas_PermiteNegativo DEFAULT (1);
IF COL_LENGTH('Cuentas', 'RequiereArqueo')  IS NULL ALTER TABLE Cuentas ADD RequiereArqueo  BIT NOT NULL CONSTRAINT DF_Cuentas_RequiereArqueo DEFAULT (0);
IF COL_LENGTH('Cuentas', 'Color')           IS NULL ALTER TABLE Cuentas ADD Color           VARCHAR(20) NULL;
IF COL_LENGTH('Cuentas', 'Icono')           IS NULL ALTER TABLE Cuentas ADD Icono           VARCHAR(40) NULL;
IF COL_LENGTH('Cuentas', 'Orden')           IS NULL ALTER TABLE Cuentas ADD Orden           INT NOT NULL CONSTRAINT DF_Cuentas_Orden DEFAULT (0);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cuentas_CuentasTipos')
AND NOT EXISTS (SELECT 1 FROM Cuentas c WHERE NOT EXISTS (SELECT 1 FROM CuentasTipos t WHERE t.Id = c.IdTipo))
    ALTER TABLE Cuentas ADD CONSTRAINT FK_Cuentas_CuentasTipos FOREIGN KEY (IdTipo) REFERENCES CuentasTipos (Id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cuentas_Locales')
    ALTER TABLE Cuentas ADD CONSTRAINT FK_Cuentas_Locales FOREIGN KEY (IdLocal) REFERENCES Locales (Id);
GO

/* ────────────────────────── 3. Medios de pago ────────────────────────── */

IF OBJECT_ID('MediosPago') IS NULL
BEGIN
    CREATE TABLE MediosPago (
        Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MediosPago PRIMARY KEY,
        Nombre          VARCHAR(70) NOT NULL,
        IdCuentaDefecto INT NULL,
        AfectaCaja      BIT NOT NULL CONSTRAINT DF_MediosPago_AfectaCaja DEFAULT (1),
        Activo          BIT NOT NULL CONSTRAINT DF_MediosPago_Activo DEFAULT (1),
        Orden           INT NOT NULL CONSTRAINT DF_MediosPago_Orden DEFAULT (0)
    );
    CREATE UNIQUE INDEX UQ_MediosPago_Nombre ON MediosPago (Nombre);
    ALTER TABLE MediosPago ADD CONSTRAINT FK_MediosPago_Cuentas
        FOREIGN KEY (IdCuentaDefecto) REFERENCES Cuentas (Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM MediosPago)
    INSERT INTO MediosPago (Nombre, AfectaCaja, Activo, Orden) VALUES
        ('Efectivo',               1, 1, 1),
        ('Transferencia bancaria', 1, 1, 2),
        ('Débito automático',      1, 1, 3),
        ('Tarjeta de débito',      1, 1, 4),
        ('Tarjeta de crédito',     1, 1, 5),
        ('Mercado Pago',           1, 1, 6),
        ('Cheque',                 0, 1, 7),
        ('Otro',                   1, 1, 8);
GO

/* ─────────────────── 4. Sesiones de caja (turnos y arqueo) ─────────────────── */

IF OBJECT_ID('CajasSesiones') IS NULL
BEGIN
    CREATE TABLE CajasSesiones (
        Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CajasSesiones PRIMARY KEY,
        IdCuenta        INT NOT NULL,
        IdLocal         INT NULL,
        IdUnidadNegocio INT NULL,
        IdEstado        INT NOT NULL CONSTRAINT DF_CajasSesiones_IdEstado DEFAULT (1),   -- 1 Abierta, 2 Cerrada
        FechaApertura   DATETIME NOT NULL,
        FechaCierre     DATETIME NULL,
        SaldoInicial    DECIMAL(18,2) NOT NULL CONSTRAINT DF_CajasSesiones_SaldoInicial DEFAULT (0),
        SaldoTeorico    DECIMAL(18,2) NULL,
        SaldoDeclarado  DECIMAL(18,2) NULL,
        Diferencia      DECIMAL(18,2) NULL,
        NotaApertura    VARCHAR(300) NULL,
        NotaCierre      VARCHAR(300) NULL,
        IdUsuarioAbre   INT NOT NULL,
        IdUsuarioCierra INT NULL
    );
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_Cuentas         FOREIGN KEY (IdCuenta)        REFERENCES Cuentas (Id);
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_Locales         FOREIGN KEY (IdLocal)         REFERENCES Locales (Id);
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_UnidadesNegocio FOREIGN KEY (IdUnidadNegocio) REFERENCES Unidades_Negocio (Id);
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_UsuarioAbre     FOREIGN KEY (IdUsuarioAbre)   REFERENCES Usuarios (Id);
    ALTER TABLE CajasSesiones ADD CONSTRAINT FK_CajasSesiones_UsuarioCierra   FOREIGN KEY (IdUsuarioCierra) REFERENCES Usuarios (Id);
    CREATE INDEX IX_CajasSesiones_Cuenta_Estado ON CajasSesiones (IdCuenta, IdEstado);
END
GO

/* ──────────────── 5. Cajas: el libro de asientos del sistema ────────────────
   TipoMov + IdMov identifican el origen del asiento. Ese par es lo que hace al
   motor idempotente y reversible: reprocesar un pago actualiza su asiento en
   lugar de duplicarlo.
   -------------------------------------------------------------------------- */

IF COL_LENGTH('Cajas', 'IdSesion')        IS NULL ALTER TABLE Cajas ADD IdSesion        INT NULL;
IF COL_LENGTH('Cajas', 'IdLocal')         IS NULL ALTER TABLE Cajas ADD IdLocal         INT NULL;
IF COL_LENGTH('Cajas', 'IdUnidadNegocio') IS NULL ALTER TABLE Cajas ADD IdUnidadNegocio INT NULL;
IF COL_LENGTH('Cajas', 'IdMedioPago')     IS NULL ALTER TABLE Cajas ADD IdMedioPago     INT NULL;
IF COL_LENGTH('Cajas', 'NotaInterna')     IS NULL ALTER TABLE Cajas ADD NotaInterna     VARCHAR(300) NULL;
IF COL_LENGTH('Cajas', 'Anulado')         IS NULL ALTER TABLE Cajas ADD Anulado         BIT NOT NULL CONSTRAINT DF_Cajas_Anulado DEFAULT (0);
IF COL_LENGTH('Cajas', 'MotivoAnula')     IS NULL ALTER TABLE Cajas ADD MotivoAnula     VARCHAR(200) NULL;
IF COL_LENGTH('Cajas', 'IdUsuarioAnula')  IS NULL ALTER TABLE Cajas ADD IdUsuarioAnula  INT NULL;
IF COL_LENGTH('Cajas', 'FechaAnula')      IS NULL ALTER TABLE Cajas ADD FechaAnula      DATETIME NULL;
GO

-- Los conceptos de los asientos automáticos no entran en el VARCHAR(200) original.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Cajas') AND name = 'Concepto' AND max_length > 0 AND max_length < 300
)
    ALTER TABLE Cajas ALTER COLUMN Concepto VARCHAR(300) NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cajas_CajasSesiones')
    ALTER TABLE Cajas ADD CONSTRAINT FK_Cajas_CajasSesiones FOREIGN KEY (IdSesion) REFERENCES CajasSesiones (Id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cajas_MediosPago')
    ALTER TABLE Cajas ADD CONSTRAINT FK_Cajas_MediosPago FOREIGN KEY (IdMedioPago) REFERENCES MediosPago (Id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cajas_Locales')
    ALTER TABLE Cajas ADD CONSTRAINT FK_Cajas_Locales FOREIGN KEY (IdLocal) REFERENCES Locales (Id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cajas_Cuenta_Fecha' AND object_id = OBJECT_ID('Cajas'))
    CREATE INDEX IX_Cajas_Cuenta_Fecha ON Cajas (IdCuenta, Fecha) INCLUDE (Ingreso, Egreso, Anulado);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cajas_Origen' AND object_id = OBJECT_ID('Cajas'))
    CREATE INDEX IX_Cajas_Origen ON Cajas (TipoMov, IdMov);
GO

-- Un origen no puede tener dos asientos vigentes. Se filtra por Anulado = 0 para
-- que reponer un asiento después de anularlo siga siendo posible.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Cajas_Origen_Vigente' AND object_id = OBJECT_ID('Cajas'))
AND NOT EXISTS (
    SELECT 1 FROM Cajas WHERE IdMov IS NOT NULL AND Anulado = 0
    GROUP BY TipoMov, IdMov HAVING COUNT(*) > 1
)
    CREATE UNIQUE INDEX UX_Cajas_Origen_Vigente ON Cajas (TipoMov, IdMov)
        WHERE IdMov IS NOT NULL AND Anulado = 0;
GO

/* ────────────── 6. Pagos a proveedores: enlace con el libro ────────────── */

IF COL_LENGTH('ProveedoresPagos', 'IdMedioPago')       IS NULL ALTER TABLE ProveedoresPagos ADD IdMedioPago       INT NULL;
IF COL_LENGTH('ProveedoresPagos', 'IdCaja')            IS NULL ALTER TABLE ProveedoresPagos ADD IdCaja            INT NULL;
IF COL_LENGTH('ProveedoresPagos', 'ComprobanteNumero') IS NULL ALTER TABLE ProveedoresPagos ADD ComprobanteNumero VARCHAR(50) NULL;
IF COL_LENGTH('ProveedoresPagos', 'Anulado')           IS NULL ALTER TABLE ProveedoresPagos ADD Anulado           BIT NOT NULL CONSTRAINT DF_ProveedoresPagos_Anulado DEFAULT (0);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ProveedoresPagos_MediosPago')
    ALTER TABLE ProveedoresPagos ADD CONSTRAINT FK_ProveedoresPagos_MediosPago
        FOREIGN KEY (IdMedioPago) REFERENCES MediosPago (Id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProveedoresPagos_Proveedor_Fecha' AND object_id = OBJECT_ID('ProveedoresPagos'))
    CREATE INDEX IX_ProveedoresPagos_Proveedor_Fecha ON ProveedoresPagos (IdProveedor, Fecha DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProveedoresCuentaCorriente_Origen' AND object_id = OBJECT_ID('Proveedores_CuentaCorriente'))
    CREATE INDEX IX_ProveedoresCuentaCorriente_Origen ON Proveedores_CuentaCorriente (TipoMov, IdMov);
GO

/* ─────────────────────── 7. Categorías de gasto ─────────────────────── */

IF OBJECT_ID('GastosCategorias') IS NULL
BEGIN
    CREATE TABLE GastosCategorias (
        Id      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GastosCategorias PRIMARY KEY,
        Nombre  VARCHAR(100) NOT NULL,
        IdPadre INT NULL,
        Color   VARCHAR(20) NULL,
        Icono   VARCHAR(40) NULL,
        Activa  BIT NOT NULL CONSTRAINT DF_GastosCategorias_Activa DEFAULT (1),
        Orden   INT NOT NULL CONSTRAINT DF_GastosCategorias_Orden DEFAULT (0)
    );
    CREATE UNIQUE INDEX UQ_GastosCategorias_Nombre ON GastosCategorias (Nombre);
    ALTER TABLE GastosCategorias ADD CONSTRAINT FK_GastosCategorias_Padre
        FOREIGN KEY (IdPadre) REFERENCES GastosCategorias (Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM GastosCategorias)
BEGIN
    -- Los iconos se guardan sin el prefijo 'fa-': la UI lo agrega al renderizar.
    INSERT INTO GastosCategorias (Nombre, Color, Icono, Activa, Orden) VALUES
        ('Servicios',          '#c9a24a', 'bolt',            1,  1),
        ('Alquileres',         '#8bc34a', 'building',        1,  2),
        ('Sueldos y cargas',   '#5f8f4a', 'users',           1,  3),
        ('Impuestos y tasas',  '#c2185b', 'university',      1,  4),
        ('Mantenimiento',      '#7a7088', 'wrench',          1,  5),
        ('Insumos y limpieza', '#a8842e', 'shopping-basket', 1,  6),
        ('Marketing',          '#e8879f', 'bullhorn',        1,  7),
        ('Logística',          '#5b8def', 'truck',           1,  8),
        ('Honorarios',         '#8e6fc9', 'briefcase',       1,  9),
        ('Otros',              '#9a91a8', 'ellipsis-h',      1, 99);

    DECLARE @idServicios INT = (SELECT Id FROM GastosCategorias WHERE Nombre = 'Servicios');
    INSERT INTO GastosCategorias (Nombre, IdPadre, Color, Icono, Activa, Orden) VALUES
        ('Luz',       @idServicios, '#c9a24a', 'lightbulb-o', 1, 1),
        ('Gas',       @idServicios, '#c9a24a', 'fire',        1, 2),
        ('Agua',      @idServicios, '#c9a24a', 'tint',        1, 3),
        ('Internet',  @idServicios, '#c9a24a', 'wifi',        1, 4),
        ('Telefonía', @idServicios, '#c9a24a', 'phone',       1, 5);
END
GO

/* ──────────────────────────── 8. Gastos ────────────────────────────
   ImportePagado e IdEstado son derivados de GastosPagos: se persisten para que
   las grillas no tengan que recalcularlos, pero la fuente de verdad son los pagos.
   ---------------------------------------------------------------------------- */

IF OBJECT_ID('Gastos') IS NULL
BEGIN
    CREATE TABLE Gastos (
        Id                     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Gastos PRIMARY KEY,
        IdUnidadNegocio        INT NULL,
        IdLocal                INT NULL,
        IdCategoria            INT NOT NULL,
        IdProveedor            INT NULL,
        Fecha                  DATE NOT NULL,
        FechaVencimiento       DATE NULL,
        Concepto               VARCHAR(200) NOT NULL,
        Detalle                VARCHAR(500) NULL,
        ComprobanteTipo        VARCHAR(30) NULL,
        ComprobanteNumero      VARCHAR(50) NULL,
        Importe                DECIMAL(18,2) NOT NULL,
        ImportePagado          DECIMAL(18,2) NOT NULL CONSTRAINT DF_Gastos_ImportePagado DEFAULT (0),
        IdEstado               INT NOT NULL CONSTRAINT DF_Gastos_IdEstado DEFAULT (1),  -- 1 Pend, 2 Parcial, 3 Pagado, 4 Anulado
        ImpactaCuentaCorriente BIT NOT NULL CONSTRAINT DF_Gastos_ImpactaCC DEFAULT (0),
        Anulado                BIT NOT NULL CONSTRAINT DF_Gastos_Anulado DEFAULT (0),
        MotivoAnula            VARCHAR(200) NULL,
        NotaInterna            VARCHAR(300) NULL,
        IdUsuarioRegistra      INT NOT NULL,
        FechaRegistra          DATETIME NOT NULL CONSTRAINT DF_Gastos_FechaRegistra DEFAULT (GETDATE()),
        IdUsuarioModifica      INT NULL,
        FechaModifica          DATETIME NULL
    );
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_GastosCategorias FOREIGN KEY (IdCategoria)       REFERENCES GastosCategorias (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_Proveedores      FOREIGN KEY (IdProveedor)       REFERENCES Proveedores (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_Locales          FOREIGN KEY (IdLocal)           REFERENCES Locales (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_UnidadesNegocio  FOREIGN KEY (IdUnidadNegocio)   REFERENCES Unidades_Negocio (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_UsuarioRegistra  FOREIGN KEY (IdUsuarioRegistra) REFERENCES Usuarios (Id);
    ALTER TABLE Gastos ADD CONSTRAINT FK_Gastos_UsuarioModifica  FOREIGN KEY (IdUsuarioModifica) REFERENCES Usuarios (Id);

    CREATE INDEX IX_Gastos_Fecha                ON Gastos (Fecha DESC);
    CREATE INDEX IX_Gastos_Estado_Vencimiento   ON Gastos (IdEstado, FechaVencimiento);
    CREATE INDEX IX_Gastos_Categoria            ON Gastos (IdCategoria);
    CREATE INDEX IX_Gastos_Proveedor            ON Gastos (IdProveedor);
END
GO

IF OBJECT_ID('GastosPagos') IS NULL
BEGIN
    CREATE TABLE GastosPagos (
        Id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GastosPagos PRIMARY KEY,
        IdGasto           INT NOT NULL,
        IdCuenta          INT NOT NULL,
        IdMedioPago       INT NULL,
        IdCaja            INT NULL,
        Fecha             DATE NOT NULL,
        Importe           DECIMAL(18,2) NOT NULL,
        NotaInterna       VARCHAR(300) NULL,
        Anulado           BIT NOT NULL CONSTRAINT DF_GastosPagos_Anulado DEFAULT (0),
        IdUsuarioRegistra INT NOT NULL,
        FechaRegistra     DATETIME NOT NULL CONSTRAINT DF_GastosPagos_FechaRegistra DEFAULT (GETDATE())
    );
    ALTER TABLE GastosPagos ADD CONSTRAINT FK_GastosPagos_Gastos           FOREIGN KEY (IdGasto)           REFERENCES Gastos (Id);
    ALTER TABLE GastosPagos ADD CONSTRAINT FK_GastosPagos_Cuentas          FOREIGN KEY (IdCuenta)          REFERENCES Cuentas (Id);
    ALTER TABLE GastosPagos ADD CONSTRAINT FK_GastosPagos_MediosPago       FOREIGN KEY (IdMedioPago)       REFERENCES MediosPago (Id);
    ALTER TABLE GastosPagos ADD CONSTRAINT FK_GastosPagos_UsuarioRegistra  FOREIGN KEY (IdUsuarioRegistra) REFERENCES Usuarios (Id);
    CREATE INDEX IX_GastosPagos_Gasto ON GastosPagos (IdGasto);
END
GO

/* ─────────────────────── 9. Tablas de historial ───────────────────────
   Mismo formato que el resto del sistema (ver 003_Sistema_Historiales_Completo).
   -------------------------------------------------------------------------- */

DECLARE @tablas TABLE (Nombre SYSNAME);
INSERT INTO @tablas (Nombre) VALUES
    ('Gastos_Historial'),
    ('GastosCategorias_Historial'),
    ('MediosPago_Historial'),
    ('CuentasTipos_Historial');

DECLARE @t SYSNAME, @sql NVARCHAR(MAX);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT Nombre FROM @tablas;
OPEN cur;
FETCH NEXT FROM cur INTO @t;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = @t)
    BEGIN
        SET @sql = N'
            CREATE TABLE [' + @t + N'] (
                Id            INT IDENTITY(1,1) PRIMARY KEY,
                IdEntidad     INT NOT NULL,
                Accion        VARCHAR(20) NOT NULL,
                Resumen       NVARCHAR(500) NOT NULL,
                Detalle       NVARCHAR(MAX) NULL,
                IdUsuario     INT NOT NULL,
                UsuarioNombre NVARCHAR(150) NULL,
                Fecha         DATETIME NOT NULL CONSTRAINT [DF_' + @t + N'_Fecha] DEFAULT GETDATE()
            );
            CREATE INDEX [IX_' + @t + N'_Entidad_Fecha] ON [' + @t + N'] (IdEntidad, Fecha DESC);';
        EXEC sp_executesql @sql;
    END

    FETCH NEXT FROM cur INTO @t;
END

CLOSE cur;
DEALLOCATE cur;
GO

/* ─────────────────────── 10. Cuenta inicial operable ─────────────────────── */

IF NOT EXISTS (SELECT 1 FROM Cuentas)
    INSERT INTO Cuentas (Nombre, IdTipo, Moneda, SaldoInicial, Activa, PermiteNegativo, RequiereArqueo, Color, Icono, Orden)
    VALUES ('Caja principal', 1, 'ARS', 0, 1, 0, 1, '#c9a24a', 'money', 1);
GO

-- Las cuentas de efectivo son las que tiene sentido arquear por turno.
IF NOT EXISTS (SELECT 1 FROM Cuentas WHERE RequiereArqueo = 1)
    UPDATE Cuentas SET RequiereArqueo = 1 WHERE IdTipo = 1;
GO

/* ────────── 11. Backfill: asientos de los pagos ya existentes ──────────
   Los pagos a proveedores anteriores a Tesorería no tienen asiento en el libro.
   Se generan una única vez para que los saldos por cuenta cierren.
   -------------------------------------------------------------------------- */

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
  AND NOT EXISTS (SELECT 1 FROM Cajas c WHERE c.TipoMov = 'PAGO_PROVEEDOR' AND c.IdMov = p.Id);
GO

UPDATE p
SET p.IdCaja = c.Id
FROM ProveedoresPagos p
INNER JOIN Cajas c ON c.TipoMov = 'PAGO_PROVEEDOR' AND c.IdMov = p.Id AND c.Anulado = 0
WHERE p.IdCaja IS NULL;
GO

PRINT '009_Tesoreria_Cajas_Gastos aplicado correctamente.';
GO
