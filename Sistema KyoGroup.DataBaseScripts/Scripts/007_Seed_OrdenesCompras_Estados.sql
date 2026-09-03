-- Estados de cabecera y detalle de órdenes de compra (IDs fijos usados por la app)
SET NOCOUNT ON;

SET IDENTITY_INSERT dbo.OrdenesComprasEstados ON;
IF NOT EXISTS (SELECT 1 FROM dbo.OrdenesComprasEstados WHERE Id = 1)
    INSERT INTO dbo.OrdenesComprasEstados (Id, Nombre) VALUES (1, N'Pendiente');
IF NOT EXISTS (SELECT 1 FROM dbo.OrdenesComprasEstados WHERE Id = 2)
    INSERT INTO dbo.OrdenesComprasEstados (Id, Nombre) VALUES (2, N'Entregado');
IF NOT EXISTS (SELECT 1 FROM dbo.OrdenesComprasEstados WHERE Id = 3)
    INSERT INTO dbo.OrdenesComprasEstados (Id, Nombre) VALUES (3, N'Incompleto');
SET IDENTITY_INSERT dbo.OrdenesComprasEstados OFF;

SET IDENTITY_INSERT dbo.OrdenesComprasInsumosEstados ON;
IF NOT EXISTS (SELECT 1 FROM dbo.OrdenesComprasInsumosEstados WHERE Id = 1)
    INSERT INTO dbo.OrdenesComprasInsumosEstados (Id, Nombre) VALUES (1, N'Pendiente');
IF NOT EXISTS (SELECT 1 FROM dbo.OrdenesComprasInsumosEstados WHERE Id = 2)
    INSERT INTO dbo.OrdenesComprasInsumosEstados (Id, Nombre) VALUES (2, N'Entregado');
IF NOT EXISTS (SELECT 1 FROM dbo.OrdenesComprasInsumosEstados WHERE Id = 3)
    INSERT INTO dbo.OrdenesComprasInsumosEstados (Id, Nombre) VALUES (3, N'Incompleto');
SET IDENTITY_INSERT dbo.OrdenesComprasInsumosEstados OFF;
