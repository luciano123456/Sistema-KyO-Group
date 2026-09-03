-- Catálogo Rubros (ventas Maxi Rest RubroP)
IF OBJECT_ID('Rubros') IS NULL
BEGIN
    CREATE TABLE Rubros (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre VARCHAR(100) NOT NULL
    );
    CREATE UNIQUE INDEX UQ_Rubros_Nombre ON Rubros(Nombre);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Rubros_Historial')
BEGIN
    CREATE TABLE [Rubros_Historial] (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        IdEntidad INT NOT NULL,
        Accion VARCHAR(20) NOT NULL,
        Resumen NVARCHAR(500) NOT NULL,
        Detalle NVARCHAR(MAX) NULL,
        IdUsuario INT NOT NULL,
        UsuarioNombre NVARCHAR(150) NULL,
        Fecha DATETIME NOT NULL CONSTRAINT [DF_Rubros_Historial_Fecha] DEFAULT GETDATE()
    );
    CREATE INDEX [IX_Rubros_Historial_Entidad_Fecha]
        ON [Rubros_Historial] (IdEntidad, Fecha DESC);
END
