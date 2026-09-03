-- ============================================================
-- KyO Group | Historiales por entidad (UNA TABLA POR ABM)
-- Ejecutar en la base SistemaDB. Idempotente.
-- ============================================================

DECLARE @tables TABLE (Nombre SYSNAME);
INSERT INTO @tables (Nombre) VALUES
    (N'Insumos_Historial'),
    (N'Proveedores_Historial'),
    (N'Usuarios_Historial'),
    (N'Compras_Historial'),
    (N'OrdenesCompras_Historial'),
    (N'Locales_Historial'),
    (N'UnidadesNegocio_Historial'),
    (N'UnidadesMedida_Historial'),
    (N'InsumosCategorias_Historial'),
    (N'RecetasCategorias_Historial'),
    (N'SubRecetasCategorias_Historial'),
    (N'Roles_Historial'),
    (N'EstadosUsuarios_Historial'),
    (N'OrdenesComprasEstados_Historial'),
    (N'Cuentas_Historial');

DECLARE @name SYSNAME, @sql NVARCHAR(MAX);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Nombre FROM @tables;
OPEN c;
FETCH NEXT FROM c INTO @name;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = @name)
    BEGIN
        SET @sql = N'
CREATE TABLE [' + @name + N'] (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdEntidad INT NOT NULL,
    Accion VARCHAR(20) NOT NULL,
    Resumen NVARCHAR(500) NOT NULL,
    Detalle NVARCHAR(MAX) NULL,
    IdUsuario INT NOT NULL,
    UsuarioNombre NVARCHAR(150) NULL,
    Fecha DATETIME NOT NULL CONSTRAINT [DF_' + @name + N'_Fecha] DEFAULT GETDATE()
);
CREATE INDEX [IX_' + @name + N'_Entidad_Fecha]
    ON [' + @name + N'] (IdEntidad, Fecha DESC);';
        EXEC sp_executesql @sql;
        PRINT 'Creada: ' + @name;
    END
    ELSE
        PRINT 'Ya existe: ' + @name;

    FETCH NEXT FROM c INTO @name;
END
CLOSE c; DEALLOCATE c;
GO

-- Recetas / SubRecetas (compartida, ya existente en el sistema)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Recetas_SubRecetas_Historial')
BEGIN
    CREATE TABLE Recetas_SubRecetas_Historial (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TipoEntidad VARCHAR(20) NOT NULL,
        IdEntidad INT NOT NULL,
        Accion VARCHAR(20) NOT NULL,
        Resumen NVARCHAR(500) NOT NULL,
        Detalle NVARCHAR(MAX) NULL,
        IdUsuario INT NOT NULL,
        UsuarioNombre NVARCHAR(150) NULL,
        Fecha DATETIME NOT NULL CONSTRAINT DF_RecetasSubRecetasHistorial_Fecha DEFAULT GETDATE()
    );
    CREATE INDEX IX_RecetasSubRecetasHistorial_Entidad
        ON Recetas_SubRecetas_Historial (TipoEntidad, IdEntidad, Fecha DESC);
    CREATE INDEX IX_RecetasSubRecetasHistorial_Fecha
        ON Recetas_SubRecetas_Historial (Fecha DESC);
END
GO

-- Precios lista proveedor
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Proveedores_Insumos_Listas_Historial')
BEGIN
    CREATE TABLE Proveedores_Insumos_Listas_Historial (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        IdLista INT NOT NULL,
        IdProveedor INT NOT NULL,
        Accion VARCHAR(20) NOT NULL,
        Origen VARCHAR(20) NOT NULL CONSTRAINT DF_PILH_Origen DEFAULT 'Manual',
        Resumen NVARCHAR(500) NOT NULL,
        Detalle NVARCHAR(MAX) NULL,
        CostoAnterior DECIMAL(18,4) NULL,
        CostoNuevo DECIMAL(18,4) NULL,
        CostoUnitarioAnterior DECIMAL(18,4) NULL,
        CostoUnitarioNuevo DECIMAL(18,4) NULL,
        CantidadAnterior DECIMAL(18,4) NULL,
        CantidadNueva DECIMAL(18,4) NULL,
        PorcDescAnterior DECIMAL(18,4) NULL,
        PorcDescNuevo DECIMAL(18,4) NULL,
        IdUsuario INT NOT NULL,
        UsuarioNombre NVARCHAR(150) NULL,
        Fecha DATETIME NOT NULL CONSTRAINT DF_PILH_Fecha DEFAULT GETDATE()
    );
    CREATE INDEX IX_PILH_Lista_Fecha ON Proveedores_Insumos_Listas_Historial (IdLista, Fecha DESC);
    CREATE INDEX IX_PILH_Proveedor_Fecha ON Proveedores_Insumos_Listas_Historial (IdProveedor, Fecha DESC);
END
GO

PRINT 'Historiales KyO (por entidad) listos.';
GO
