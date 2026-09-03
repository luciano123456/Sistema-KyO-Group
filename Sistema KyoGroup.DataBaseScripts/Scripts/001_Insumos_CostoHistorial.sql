-- KyO Group | 001 - Historial de costos de insumos (propagación desde compras)
-- Ejecutar en la base configurada en appsettings (SistemaDB)

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Insumos_CostoHistorial')
BEGIN
    CREATE TABLE Insumos_CostoHistorial (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        IdInsumo INT NOT NULL,
        CostoAnterior DECIMAL(18,2) NOT NULL CONSTRAINT DF_InsumosCostoHistorial_Anterior DEFAULT 0,
        CostoNuevo DECIMAL(18,2) NOT NULL CONSTRAINT DF_InsumosCostoHistorial_Nuevo DEFAULT 0,
        Origen VARCHAR(50) NOT NULL,
        IdCompra INT NULL,
        Fecha DATETIME NOT NULL CONSTRAINT DF_InsumosCostoHistorial_Fecha DEFAULT GETDATE(),
        IdUsuario INT NULL,
        CONSTRAINT FK_InsumosCostoHistorial_Insumo FOREIGN KEY (IdInsumo) REFERENCES Insumos(Id)
    );

    CREATE INDEX IX_InsumosCostoHistorial_Insumo ON Insumos_CostoHistorial (IdInsumo);
    CREATE INDEX IX_InsumosCostoHistorial_Compra ON Insumos_CostoHistorial (IdCompra);
END
GO
