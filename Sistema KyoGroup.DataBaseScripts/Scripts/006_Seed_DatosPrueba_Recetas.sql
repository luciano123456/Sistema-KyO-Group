-- =============================================================================
-- Seed de datos de prueba: insumos, subrecetas y recetas
-- Ejecutar en la base Sistema_KyoGroup (connection SistemaDB)
--
-- Crea (prefijo TEST-*, re-ejecutable / idempotente):
--   - 20 insumos con vínculo a proveedor + lista de precios (para OC)
--   - 10 subrecetas con insumos
--   - 10 recetas solo con insumos
--   - 10 recetas con insumos + subrecetas adentro
--
-- Reutiliza el primer Usuario, UnidadNegocio, UnidadesMedida, Categorías y
-- Proveedor existentes. Si faltan catálogos mínimos, los crea.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF EXISTS (SELECT 1 FROM Insumos WHERE Sku LIKE N'TEST-INS-%')
BEGIN
    PRINT N'Ya existen datos TEST-* (Insumos). Script omitido. Para regenerar, borrá primero los registros con Sku/Descripcion TEST-.';
    RETURN;
END

BEGIN TRY
BEGIN TRAN;

DECLARE @Ahora DATETIME = GETDATE();
DECLARE @IdUsuario INT;
DECLARE @IdUN INT;
DECLARE @IdUM INT;
DECLARE @IdUMKg INT;
DECLARE @IdUMLt INT;
DECLARE @IdUMUn INT;
DECLARE @IdCatInsumo INT;
DECLARE @IdCatReceta INT;
DECLARE @IdCatSubReceta INT;
DECLARE @IdProveedor INT;

-- ---------------------------------------------------------------------------
-- Catálogos base
-- ---------------------------------------------------------------------------
SELECT TOP 1 @IdUsuario = Id FROM Usuarios ORDER BY Id;
IF @IdUsuario IS NULL
    THROW 50001, N'No hay usuarios en Usuarios. Creá al menos uno antes de seedear.', 1;

SELECT TOP 1 @IdUN = Id FROM Unidades_Negocio ORDER BY Id;
IF @IdUN IS NULL
BEGIN
    INSERT INTO Unidades_Negocio (Nombre) VALUES (N'TEST - Unidad');
    SET @IdUN = SCOPE_IDENTITY();
END

SELECT TOP 1 @IdUMKg = Id FROM Unidades_Medida WHERE Nombre LIKE N'%kg%' OR Nombre LIKE N'%kilo%' ORDER BY Id;
SELECT TOP 1 @IdUMLt = Id FROM Unidades_Medida WHERE Nombre LIKE N'%lt%' OR Nombre LIKE N'%litro%' ORDER BY Id;
SELECT TOP 1 @IdUMUn = Id FROM Unidades_Medida WHERE Nombre LIKE N'%un%' OR Nombre LIKE N'%unidad%' ORDER BY Id;
SELECT TOP 1 @IdUM = Id FROM Unidades_Medida ORDER BY Id;

IF @IdUM IS NULL
BEGIN
    INSERT INTO Unidades_Medida (Nombre) VALUES (N'Kg');
    SET @IdUMKg = SCOPE_IDENTITY();
    INSERT INTO Unidades_Medida (Nombre) VALUES (N'Lt');
    SET @IdUMLt = SCOPE_IDENTITY();
    INSERT INTO Unidades_Medida (Nombre) VALUES (N'Un');
    SET @IdUMUn = SCOPE_IDENTITY();
    SET @IdUM = @IdUMKg;
END

SET @IdUMKg = ISNULL(@IdUMKg, @IdUM);
SET @IdUMLt = ISNULL(@IdUMLt, @IdUM);
SET @IdUMUn = ISNULL(@IdUMUn, @IdUM);

SELECT TOP 1 @IdCatInsumo = Id FROM Insumos_Categorias ORDER BY Id;
IF @IdCatInsumo IS NULL
BEGIN
    INSERT INTO Insumos_Categorias (Nombre) VALUES (N'TEST - Almacén');
    SET @IdCatInsumo = SCOPE_IDENTITY();
END

SELECT TOP 1 @IdCatReceta = Id FROM Recetas_Categorias ORDER BY Id;
IF @IdCatReceta IS NULL
BEGIN
    INSERT INTO Recetas_Categorias (Nombre) VALUES (N'TEST - Platos');
    SET @IdCatReceta = SCOPE_IDENTITY();
END

SELECT TOP 1 @IdCatSubReceta = Id FROM SubRecetas_Categorias ORDER BY Id;
IF @IdCatSubReceta IS NULL
BEGIN
    INSERT INTO SubRecetas_Categorias (Nombre) VALUES (N'TEST - Prefabricados');
    SET @IdCatSubReceta = SCOPE_IDENTITY();
END

SELECT TOP 1 @IdProveedor = Id FROM Proveedores ORDER BY Id;
IF @IdProveedor IS NULL
BEGIN
    INSERT INTO Proveedores (Nombre, Apodo, IdUsuarioRegistra, FechaRegistra)
    VALUES (N'Proveedor TEST Seed', N'TEST', @IdUsuario, @Ahora);
    SET @IdProveedor = SCOPE_IDENTITY();
END

PRINT N'Catálogos: Usuario=' + CAST(@IdUsuario AS VARCHAR(10))
    + N', UN=' + CAST(@IdUN AS VARCHAR(10))
    + N', Proveedor=' + CAST(@IdProveedor AS VARCHAR(10));

-- ---------------------------------------------------------------------------
-- Insumos (20) + UN + lista proveedor + vínculo
-- ---------------------------------------------------------------------------
DECLARE @Insumos TABLE (
    Nro INT PRIMARY KEY,
    Sku VARCHAR(100) NOT NULL,
    Descripcion VARCHAR(150) NOT NULL,
    IdUM INT NOT NULL,
    CostoUnitario DECIMAL(18,2) NOT NULL,
    IdInsumo INT NULL,
    IdLista INT NULL
);

INSERT INTO @Insumos (Nro, Sku, Descripcion, IdUM, CostoUnitario) VALUES
 (1,  'TEST-INS-001', 'Harina 000',              @IdUMKg,  450.00),
 (2,  'TEST-INS-002', 'Azúcar común',            @IdUMKg,  380.00),
 (3,  'TEST-INS-003', 'Sal fina',                @IdUMKg,  120.00),
 (4,  'TEST-INS-004', 'Aceite girasol',          @IdUMLt,  890.00),
 (5,  'TEST-INS-005', 'Huevos',                  @IdUMUn,   45.00),
 (6,  'TEST-INS-006', 'Leche entera',            @IdUMLt,  520.00),
 (7,  'TEST-INS-007', 'Manteca',                 @IdUMKg, 2800.00),
 (8,  'TEST-INS-008', 'Queso mozzarella',        @IdUMKg, 4200.00),
 (9,  'TEST-INS-009', 'Tomate triturado',        @IdUMKg,  650.00),
 (10, 'TEST-INS-010', 'Cebolla',                 @IdUMKg,  280.00),
 (11, 'TEST-INS-011', 'Ajo',                     @IdUMKg, 1100.00),
 (12, 'TEST-INS-012', 'Papa',                    @IdUMKg,  320.00),
 (13, 'TEST-INS-013', 'Carne molida',            @IdUMKg, 3800.00),
 (14, 'TEST-INS-014', 'Pollo pechuga',           @IdUMKg, 4100.00),
 (15, 'TEST-INS-015', 'Pan rallado',             @IdUMKg,  720.00),
 (16, 'TEST-INS-016', 'Levadura seca',           @IdUMKg, 3500.00),
 (17, 'TEST-INS-017', 'Crema de leche',          @IdUMLt, 1400.00),
 (18, 'TEST-INS-018', 'Orégano',                 @IdUMKg, 4800.00),
 (19, 'TEST-INS-019', 'Pimienta negra',          @IdUMKg, 6200.00),
 (20, 'TEST-INS-020', 'Vinagre blanco',          @IdUMLt,  310.00);

DECLARE @Nro INT = 1;
DECLARE @Sku VARCHAR(100), @Desc VARCHAR(150);
DECLARE @IdUMRow INT, @Costo DECIMAL(18,2);
DECLARE @IdInsumo INT, @IdLista INT;

WHILE @Nro <= 20
BEGIN
    SELECT @Sku = Sku, @Desc = Descripcion, @IdUMRow = IdUM, @Costo = CostoUnitario
    FROM @Insumos WHERE Nro = @Nro;

    INSERT INTO Insumos (Sku, Descripcion, IdUnidadMedida, IdCategoria, FechaActualizacion, IdUsuarioRegistra, FechaRegistra)
    VALUES (@Sku, @Desc, @IdUMRow, @IdCatInsumo, @Ahora, @IdUsuario, @Ahora);
    SET @IdInsumo = SCOPE_IDENTITY();

    INSERT INTO Insumos_UnidadesNegocio (IdInsumo, IdUnidadNegocio)
    VALUES (@IdInsumo, @IdUN);

    INSERT INTO Proveedores_Insumos_Listas
        (IdProveedor, Codigo, Descripcion, Costo, CostoUnitario, Cantidad, PorcDesc, FechaActualizacion, IdUsuarioRegistra, FechaRegistra)
    VALUES
        (@IdProveedor, @Sku, @Desc, @Costo, @Costo, 1, 0, @Ahora, @IdUsuario, @Ahora);
    SET @IdLista = SCOPE_IDENTITY();

    INSERT INTO Insumos_Proveedores (IdInsumo, IdProveedor, IdListaProveedor)
    VALUES (@IdInsumo, @IdProveedor, @IdLista);

    UPDATE @Insumos SET IdInsumo = @IdInsumo, IdLista = @IdLista WHERE Nro = @Nro;
    SET @Nro += 1;
END

PRINT N'Insumos creados: 20 (con proveedor/lista/UN)';

-- Helper: costo de un insumo por nro
-- ---------------------------------------------------------------------------
-- SubRecetas (10) con insumos
-- ---------------------------------------------------------------------------
DECLARE @SubRecetas TABLE (
    Nro INT PRIMARY KEY,
    Sku VARCHAR(150) NOT NULL,
    Descripcion VARCHAR(150) NOT NULL,
    Rendimiento DECIMAL(20,2) NOT NULL,
    IdSubReceta INT NULL,
    CostoInsumos DECIMAL(20,2) NULL,
    CostoPorcion DECIMAL(20,2) NULL,
    CostoUnitario DECIMAL(20,2) NULL
);

INSERT INTO @SubRecetas (Nro, Sku, Descripcion, Rendimiento) VALUES
 (1,  'TEST-SR-001', 'Masa pizza',           10),
 (2,  'TEST-SR-002', 'Salsa tomate base',     5),
 (3,  'TEST-SR-003', 'Bechamel',              4),
 (4,  'TEST-SR-004', 'Mix verduras salteadas',3),
 (5,  'TEST-SR-005', 'Pan hamburguesa',      12),
 (6,  'TEST-SR-006', 'Empanada masa',        20),
 (7,  'TEST-SR-007', 'Relleno carne',         8),
 (8,  'TEST-SR-008', 'Papas fritas precocidas',6),
 (9,  'TEST-SR-009', 'Aderezo ajo',           2),
 (10, 'TEST-SR-010', 'Rebozado milanesa',     5);

-- Composición: (NroSub, NroInsumo, Cantidad)
DECLARE @SRInsumos TABLE (NroSub INT, NroIns INT, Cantidad DECIMAL(20,2));
INSERT INTO @SRInsumos (NroSub, NroIns, Cantidad) VALUES
 -- Masa pizza
 (1,1,1.00),(1,3,0.02),(1,4,0.05),(1,6,0.20),(1,16,0.01),
 -- Salsa tomate
 (2,9,2.00),(2,10,0.30),(2,11,0.05),(2,4,0.05),(2,18,0.01),
 -- Bechamel
 (3,1,0.08),(3,7,0.08),(3,6,1.00),(3,3,0.01),
 -- Mix verduras
 (4,10,0.50),(4,11,0.05),(4,4,0.03),(4,19,0.005),
 -- Pan hamburguesa
 (5,1,1.20),(5,2,0.10),(5,5,2),(5,6,0.30),(5,16,0.015),(5,7,0.05),
 -- Masa empanada
 (6,1,1.00),(6,3,0.02),(6,4,0.10),(6,6,0.15),
 -- Relleno carne
 (7,13,1.00),(7,10,0.40),(7,11,0.03),(7,5,1),(7,3,0.01),
 -- Papas
 (8,12,3.00),(8,4,0.20),(8,3,0.02),
 -- Aderezo ajo
 (9,11,0.20),(9,4,0.30),(9,20,0.10),(9,3,0.01),
 -- Rebozado
 (10,1,0.30),(10,15,0.50),(10,5,3),(10,3,0.01);

DECLARE @NroSR INT = 1;
DECLARE @IdSR INT;
DECLARE @CostoInsSR DECIMAL(20,2);
DECLARE @CostoPorcSR DECIMAL(20,2);
DECLARE @Rend DECIMAL(20,2);
DECLARE @SkuSR VARCHAR(150), @DescSR VARCHAR(150);

WHILE @NroSR <= 10
BEGIN
    SELECT @SkuSR = Sku, @DescSR = Descripcion, @Rend = Rendimiento
    FROM @SubRecetas WHERE Nro = @NroSR;

    SELECT @CostoInsSR = SUM(s.Cantidad * i.CostoUnitario)
    FROM @SRInsumos s
    INNER JOIN @Insumos i ON i.Nro = s.NroIns
    WHERE s.NroSub = @NroSR;

    SET @CostoInsSR = ISNULL(@CostoInsSR, 0);
    SET @CostoPorcSR = CASE WHEN @Rend > 0 THEN ROUND(@CostoInsSR / @Rend, 2) ELSE @CostoInsSR END;

    INSERT INTO SubRecetas
        (IdUnidadNegocio, Sku, Descripcion, IdUnidadMedida, IdCategoria,
         CostoPorcion, CostoSubRecetas, CostoInsumos, Rendimiento, CostoUnitario,
         FechaActualizacion, IdUsuarioRegistra, FechaRegistra)
    VALUES
        (@IdUN, @SkuSR, @DescSR, @IdUMUn, @IdCatSubReceta,
         @CostoPorcSR, 0, @CostoInsSR, @Rend, @CostoPorcSR,
         @Ahora, @IdUsuario, @Ahora);
    SET @IdSR = SCOPE_IDENTITY();

    INSERT INTO SubRecetas_UnidadesNegocio (IdSubReceta, IdUnidadNegocio)
    VALUES (@IdSR, @IdUN);

    INSERT INTO SubRecetas_Insumos
        (IdSubReceta, IdInsumo, Cantidad, CostoUnitario, SubTotal, IdUsuarioRegistra, FechaRegistra)
    SELECT
        @IdSR,
        i.IdInsumo,
        s.Cantidad,
        i.CostoUnitario,
        ROUND(s.Cantidad * i.CostoUnitario, 2),
        @IdUsuario,
        @Ahora
    FROM @SRInsumos s
    INNER JOIN @Insumos i ON i.Nro = s.NroIns
    WHERE s.NroSub = @NroSR;

    UPDATE @SubRecetas
    SET IdSubReceta = @IdSR,
        CostoInsumos = @CostoInsSR,
        CostoPorcion = @CostoPorcSR,
        CostoUnitario = @CostoPorcSR
    WHERE Nro = @NroSR;

    SET @NroSR += 1;
END

PRINT N'SubRecetas creadas: 10 (con insumos)';

-- ---------------------------------------------------------------------------
-- Recetas solo insumos (10)
-- ---------------------------------------------------------------------------
DECLARE @RecetasSimple TABLE (
    Nro INT PRIMARY KEY,
    Sku VARCHAR(150) NOT NULL,
    Descripcion VARCHAR(150) NOT NULL,
    Rendimiento DECIMAL(20,2) NOT NULL,
    IdReceta INT NULL
);

INSERT INTO @RecetasSimple (Nro, Sku, Descripcion, Rendimiento) VALUES
 (1,  'TEST-REC-001', 'Ensalada César',        2),
 (2,  'TEST-REC-002', 'Papas fritas porción',   1),
 (3,  'TEST-REC-003', 'Huevos revueltos',       1),
 (4,  'TEST-REC-004', 'Pollo grillé',           1),
 (5,  'TEST-REC-005', 'Carne a la plancha',     1),
 (6,  'TEST-REC-006', 'Tostado queso',          1),
 (7,  'TEST-REC-007', 'Ensalada cruda',         2),
 (8,  'TEST-REC-008', 'Omelette simple',        1),
 (9,  'TEST-REC-009', 'Puré de papas',          4),
 (10, 'TEST-REC-010', 'Vinagreta casa',         10);

DECLARE @RInsumos TABLE (NroRec INT, NroIns INT, Cantidad DECIMAL(20,2));
INSERT INTO @RInsumos (NroRec, NroIns, Cantidad) VALUES
 (1,14,0.15),(1,10,0.10),(1,4,0.02),(1,20,0.01),(1,3,0.005),
 (2,12,0.30),(2,4,0.05),(2,3,0.005),
 (3,5,3),(3,7,0.02),(3,3,0.003),
 (4,14,0.25),(4,4,0.02),(4,3,0.005),(4,19,0.002),
 (5,13,0.25),(5,4,0.02),(5,3,0.005),(5,11,0.01),
 (6,8,0.08),(6,7,0.02),(6,5,1),
 (7,10,0.20),(7,12,0.15),(7,4,0.02),(7,20,0.01),
 (8,5,3),(8,8,0.05),(8,7,0.02),(8,3,0.003),
 (9,12,1.00),(9,6,0.20),(9,7,0.05),(9,3,0.01),
 (10,4,0.50),(10,20,0.30),(10,3,0.01),(10,11,0.02);

DECLARE @NroR INT = 1;
DECLARE @IdRec INT;
DECLARE @CostoInsR DECIMAL(20,2);
DECLARE @CostoPorcR DECIMAL(20,2);
DECLARE @SkuR VARCHAR(150), @DescR VARCHAR(150);

WHILE @NroR <= 10
BEGIN
    SELECT @SkuR = Sku, @DescR = Descripcion, @Rend = Rendimiento
    FROM @RecetasSimple WHERE Nro = @NroR;

    SELECT @CostoInsR = SUM(r.Cantidad * i.CostoUnitario)
    FROM @RInsumos r
    INNER JOIN @Insumos i ON i.Nro = r.NroIns
    WHERE r.NroRec = @NroR;

    SET @CostoInsR = ISNULL(@CostoInsR, 0);
    SET @CostoPorcR = CASE WHEN @Rend > 0 THEN ROUND(@CostoInsR / @Rend, 2) ELSE @CostoInsR END;

    INSERT INTO Recetas
        (IdUnidadNegocio, Sku, Descripcion, IdUnidadMedida, IdCategoria,
         CostoSubRecetas, CostoInsumos, CostoPorcion, Rendimiento, CostoUnitario,
         FechaActualizacion, IdUsuarioRegistra, FechaRegistra)
    VALUES
        (@IdUN, @SkuR, @DescR, @IdUMUn, @IdCatReceta,
         0, @CostoInsR, @CostoPorcR, @Rend, @CostoPorcR,
         @Ahora, @IdUsuario, @Ahora);
    SET @IdRec = SCOPE_IDENTITY();

    INSERT INTO Recetas_UnidadesNegocio (IdReceta, IdUnidadNegocio)
    VALUES (@IdRec, @IdUN);

    INSERT INTO Recetas_Insumos
        (IdReceta, IdInsumo, Cantidad, CostoUnitario, SubTotal, IdUsuarioRegistra, FechaRegistra)
    SELECT
        @IdRec, i.IdInsumo, r.Cantidad, i.CostoUnitario,
        ROUND(r.Cantidad * i.CostoUnitario, 2), @IdUsuario, @Ahora
    FROM @RInsumos r
    INNER JOIN @Insumos i ON i.Nro = r.NroIns
    WHERE r.NroRec = @NroR;

    UPDATE @RecetasSimple SET IdReceta = @IdRec WHERE Nro = @NroR;
    SET @NroR += 1;
END

PRINT N'Recetas simples (solo insumos) creadas: 10';

-- ---------------------------------------------------------------------------
-- Recetas con subrecetas + insumos (10)
-- ---------------------------------------------------------------------------
DECLARE @RecetasComp TABLE (
    Nro INT PRIMARY KEY,
    Sku VARCHAR(150) NOT NULL,
    Descripcion VARCHAR(150) NOT NULL,
    Rendimiento DECIMAL(20,2) NOT NULL,
    IdReceta INT NULL
);

INSERT INTO @RecetasComp (Nro, Sku, Descripcion, Rendimiento) VALUES
 (1,  'TEST-REC-011', 'Pizza muzzarella',       8),
 (2,  'TEST-REC-012', 'Pizza especial',         8),
 (3,  'TEST-REC-013', 'Hamburguesa clásica',    1),
 (4,  'TEST-REC-014', 'Hamburguesa completa',   1),
 (5,  'TEST-REC-015', 'Empanada carne',        12),
 (6,  'TEST-REC-016', 'Milanesa napolitana',    1),
 (7,  'TEST-REC-017', 'Milanesa con papas',     1),
 (8,  'TEST-REC-018', 'Lasagna simple',         6),
 (9,  'TEST-REC-019', 'Sandwich pollo',         1),
 (10, 'TEST-REC-020', 'Combo burger + papas',   1);

-- Insumos directos en receta compuesta
DECLARE @RCInsumos TABLE (NroRec INT, NroIns INT, Cantidad DECIMAL(20,2));
INSERT INTO @RCInsumos (NroRec, NroIns, Cantidad) VALUES
 (1,8,0.25),(1,18,0.005),
 (2,8,0.20),(2,13,0.15),(2,18,0.005),
 (3,13,0.15),(3,8,0.03),(3,10,0.02),
 (4,13,0.18),(4,8,0.04),(4,10,0.03),(4,5,1),
 (5,3,0.01),
 (6,14,0.20),(6,8,0.08),(6,9,0.05),
 (7,14,0.20),(7,3,0.005),
 (8,8,0.30),(8,13,0.40),(8,9,0.30),
 (9,14,0.15),(9,8,0.04),(9,10,0.03),
 (10,13,0.15),(10,8,0.03);

-- Subrecetas dentro de receta: (NroRec, NroSR, Cantidad en porciones/unidades de SR)
DECLARE @RCSub TABLE (NroRec INT, NroSR INT, Cantidad DECIMAL(20,2));
INSERT INTO @RCSub (NroRec, NroSR, Cantidad) VALUES
 (1,1,1.00),(1,2,0.30),
 (2,1,1.00),(2,2,0.30),(2,4,0.20),
 (3,5,1.00),(3,9,0.05),
 (4,5,1.00),(4,8,0.20),(4,9,0.05),
 (5,6,1.00),(5,7,1.00),
 (6,10,1.00),(6,2,0.15),
 (7,10,1.00),(7,8,0.25),
 (8,3,1.00),(8,2,0.40),
 (9,5,1.00),(9,4,0.15),(9,9,0.05),
 (10,5,1.00),(10,8,0.30),(10,9,0.05);

SET @NroR = 1;
DECLARE @CostoSubR DECIMAL(20,2);

WHILE @NroR <= 10
BEGIN
    SELECT @SkuR = Sku, @DescR = Descripcion, @Rend = Rendimiento
    FROM @RecetasComp WHERE Nro = @NroR;

    SELECT @CostoInsR = SUM(r.Cantidad * i.CostoUnitario)
    FROM @RCInsumos r
    INNER JOIN @Insumos i ON i.Nro = r.NroIns
    WHERE r.NroRec = @NroR;
    SET @CostoInsR = ISNULL(@CostoInsR, 0);

    SELECT @CostoSubR = SUM(rs.Cantidad * sr.CostoUnitario)
    FROM @RCSub rs
    INNER JOIN @SubRecetas sr ON sr.Nro = rs.NroSR
    WHERE rs.NroRec = @NroR;
    SET @CostoSubR = ISNULL(@CostoSubR, 0);

    SET @CostoPorcR = CASE WHEN @Rend > 0
        THEN ROUND((@CostoInsR + @CostoSubR) / @Rend, 2)
        ELSE ROUND(@CostoInsR + @CostoSubR, 2) END;

    INSERT INTO Recetas
        (IdUnidadNegocio, Sku, Descripcion, IdUnidadMedida, IdCategoria,
         CostoSubRecetas, CostoInsumos, CostoPorcion, Rendimiento, CostoUnitario,
         FechaActualizacion, IdUsuarioRegistra, FechaRegistra)
    VALUES
        (@IdUN, @SkuR, @DescR, @IdUMUn, @IdCatReceta,
         @CostoSubR, @CostoInsR, @CostoPorcR, @Rend, @CostoPorcR,
         @Ahora, @IdUsuario, @Ahora);
    SET @IdRec = SCOPE_IDENTITY();

    INSERT INTO Recetas_UnidadesNegocio (IdReceta, IdUnidadNegocio)
    VALUES (@IdRec, @IdUN);

    INSERT INTO Recetas_Insumos
        (IdReceta, IdInsumo, Cantidad, CostoUnitario, SubTotal, IdUsuarioRegistra, FechaRegistra)
    SELECT
        @IdRec, i.IdInsumo, r.Cantidad, i.CostoUnitario,
        ROUND(r.Cantidad * i.CostoUnitario, 2), @IdUsuario, @Ahora
    FROM @RCInsumos r
    INNER JOIN @Insumos i ON i.Nro = r.NroIns
    WHERE r.NroRec = @NroR;

    INSERT INTO Recetas_SubRecetas
        (IdReceta, IdSubReceta, Cantidad, CostoUnitario, SubTotal, IdUsuarioRegistra, FechaRegistra)
    SELECT
        @IdRec, sr.IdSubReceta, rs.Cantidad, sr.CostoUnitario,
        ROUND(rs.Cantidad * sr.CostoUnitario, 2), @IdUsuario, @Ahora
    FROM @RCSub rs
    INNER JOIN @SubRecetas sr ON sr.Nro = rs.NroSR
    WHERE rs.NroRec = @NroR;

    UPDATE @RecetasComp SET IdReceta = @IdRec WHERE Nro = @NroR;
    SET @NroR += 1;
END

PRINT N'Recetas con subrecetas creadas: 10';

COMMIT TRAN;

PRINT N'----------------------------------------';
PRINT N'Seed OK.';
PRINT N'  Insumos:            20 (TEST-INS-001..020) + proveedor/lista';
PRINT N'  SubRecetas:         10 (TEST-SR-001..010)';
PRINT N'  Recetas (insumos):  10 (TEST-REC-001..010)';
PRINT N'  Recetas (compuestas):10 (TEST-REC-011..020)';
PRINT N'Para OC: usá el proveedor existente + insumos TEST-INS-*.';
PRINT N'Para limpiar: borrá por Sku LIKE ''TEST-%'' en el orden inverso (detalle → cabecera).';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @Line INT = ERROR_LINE();
    RAISERROR(N'Seed falló (línea %d): %s', 16, 1, @Line, @Err);
END CATCH;
GO
