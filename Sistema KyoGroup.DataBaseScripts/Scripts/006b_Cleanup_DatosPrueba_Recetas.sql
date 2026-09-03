-- =============================================================================
-- Limpieza de datos de prueba TEST-* (inverso al seed 006)
-- Ejecutar en Sistema_KyoGroup si querés borrar y volver a correr el seed.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

-- Detalle recetas
DELETE rsi
FROM Recetas_Insumos rsi
INNER JOIN Recetas r ON r.Id = rsi.IdReceta
WHERE r.Sku LIKE N'TEST-REC-%';

DELETE rsr
FROM Recetas_SubRecetas rsr
INNER JOIN Recetas r ON r.Id = rsr.IdReceta
WHERE r.Sku LIKE N'TEST-REC-%';

DELETE run
FROM Recetas_UnidadesNegocio run
INNER JOIN Recetas r ON r.Id = run.IdReceta
WHERE r.Sku LIKE N'TEST-REC-%';

DELETE FROM Recetas WHERE Sku LIKE N'TEST-REC-%';

-- Detalle subrecetas
DELETE sri
FROM SubRecetas_Insumos sri
INNER JOIN SubRecetas s ON s.Id = sri.IdSubReceta
WHERE s.Sku LIKE N'TEST-SR-%';

DELETE sun
FROM SubRecetas_UnidadesNegocio sun
INNER JOIN SubRecetas s ON s.Id = sun.IdSubReceta
WHERE s.Sku LIKE N'TEST-SR-%';

DELETE FROM SubRecetas WHERE Sku LIKE N'TEST-SR-%';

-- Insumos + proveedor
DELETE ip
FROM Insumos_Proveedores ip
INNER JOIN Insumos i ON i.Id = ip.IdInsumo
WHERE i.Sku LIKE N'TEST-INS-%';

DELETE iun
FROM Insumos_UnidadesNegocio iun
INNER JOIN Insumos i ON i.Id = iun.IdInsumo
WHERE i.Sku LIKE N'TEST-INS-%';

DELETE pil
FROM Proveedores_Insumos_Listas pil
WHERE pil.Codigo LIKE N'TEST-INS-%';

DELETE FROM Insumos WHERE Sku LIKE N'TEST-INS-%';

-- Catálogos creados solo por el seed (si quedaron vacíos / sin uso)
DELETE FROM Proveedores WHERE Nombre = N'Proveedor TEST Seed'
  AND NOT EXISTS (SELECT 1 FROM Proveedores_Insumos_Listas WHERE IdProveedor = Proveedores.Id)
  AND NOT EXISTS (SELECT 1 FROM Insumos_Proveedores WHERE IdProveedor = Proveedores.Id);

COMMIT TRAN;
PRINT N'Limpieza TEST-* OK. Ya podés volver a ejecutar 006_Seed_DatosPrueba_Recetas.sql';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(N'Limpieza falló: %s', 16, 1, @Err);
END CATCH;
GO
