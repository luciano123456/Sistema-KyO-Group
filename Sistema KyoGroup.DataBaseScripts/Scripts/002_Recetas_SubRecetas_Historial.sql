-- KyO Group | 002 - Historial de Recetas / SubRecetas
-- Ejecutar en la base configurada en appsettings (SistemaDB)

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
