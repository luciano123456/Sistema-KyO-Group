using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;

namespace SistemaKyoGroup.DAL;

public static class VentasSchemaHelper
{
    public static async Task EnsureSchemaAsync(SistemaKyoGroupContext db)
    {
        await TryExec(db, @"
IF OBJECT_ID('ImportacionesRecetas') IS NOT NULL AND COL_LENGTH('ImportacionesRecetas', 'Rubro') IS NULL
    ALTER TABLE ImportacionesRecetas ADD Rubro VARCHAR(100) NULL;");

        await TryExec(db, @"
IF OBJECT_ID('ImportacionesRecetas') IS NOT NULL AND COL_LENGTH('ImportacionesRecetas', 'RubroCodigo') IS NULL
    ALTER TABLE ImportacionesRecetas ADD RubroCodigo INT NULL;");

        await TryExec(db, @"
IF OBJECT_ID('ImportacionesRecetas') IS NOT NULL AND COL_LENGTH('ImportacionesRecetas', 'Matched') IS NULL
    ALTER TABLE ImportacionesRecetas ADD Matched BIT NOT NULL CONSTRAINT DF_ImportacionesRecetas_Matched DEFAULT (0);");

        // Opcionales: si el login SQL no tiene ALTER, EF las ignora ([NotMapped]).
        await TryExec(db, @"
IF OBJECT_ID('ImportacionesRecetas') IS NOT NULL AND COL_LENGTH('ImportacionesRecetas', 'IdInsumo') IS NULL
    ALTER TABLE ImportacionesRecetas ADD IdInsumo INT NULL;");

        await TryExec(db, @"
IF OBJECT_ID('ImportacionesRecetas') IS NOT NULL AND COL_LENGTH('ImportacionesRecetas', 'TipoVinculo') IS NULL
    ALTER TABLE ImportacionesRecetas ADD TipoVinculo VARCHAR(20) NULL;");

        await MakeIntColumnNullableAsync(db, "ImportacionesRecetas", "IdReceta");
        await MakeIntColumnNullableAsync(db, "ImportacionesRecetas", "IdMovInventario");
        await MakeIntColumnNullableAsync(db, "ImportacionesInsumos", "IdMovInventario");
        await MakeIntColumnNullableAsync(db, "ImportacionesSubRecetas", "IdMovInventario");

        await TryExec(db, @"
IF EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('ImportacionesRecetas') AND c.name = 'Cantidad'
      AND t.name IN ('int', 'bigint', 'smallint')
)
    ALTER TABLE ImportacionesRecetas ALTER COLUMN Cantidad DECIMAL(18, 2) NOT NULL;");

        await TryExec(db, @"
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ImportacionesRecetas') AND name = 'Descripcion'
      AND max_length > 0 AND max_length < 250
)
    ALTER TABLE ImportacionesRecetas ALTER COLUMN Descripcion VARCHAR(250) NOT NULL;");

        await TryExec(db, @"
IF OBJECT_ID('Importaciones') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Importaciones_Local_Fecha' AND object_id = OBJECT_ID('Importaciones'))
AND NOT EXISTS (SELECT 1 FROM Importaciones GROUP BY IdLocal, Fecha HAVING COUNT(*) > 1)
    CREATE UNIQUE INDEX UX_Importaciones_Local_Fecha ON Importaciones (IdLocal, Fecha);");

        await TryExec(db, @"
IF OBJECT_ID('ImportacionesTipos') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM ImportacionesTipos WHERE Nombre = N'MaxiRest RankingVentas')
    INSERT INTO ImportacionesTipos (Nombre) VALUES (N'MaxiRest RankingVentas');");

        await TryExec(db, @"
IF OBJECT_ID('Rubros') IS NULL
BEGIN
    CREATE TABLE Rubros (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre VARCHAR(100) NOT NULL
    );
    CREATE UNIQUE INDEX UQ_Rubros_Nombre ON Rubros(Nombre);
END");
    }

    private static async Task MakeIntColumnNullableAsync(SistemaKyoGroupContext db, string table, string column)
    {
        var sql = $@"
IF OBJECT_ID('{table}') IS NOT NULL AND COL_LENGTH('{table}', '{column}') IS NOT NULL
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'';

    SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
        + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
        + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fkc.parent_object_id = OBJECT_ID('{table}') AND c.name = '{column}';

    SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(dc.parent_object_id))
        + N'.' + QUOTENAME(OBJECT_NAME(dc.parent_object_id))
        + N' DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
    FROM sys.default_constraints dc
    WHERE dc.parent_object_id = OBJECT_ID('{table}')
      AND COL_NAME(dc.parent_object_id, dc.parent_column_id) = '{column}';

    SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(cc.parent_object_id))
        + N'.' + QUOTENAME(OBJECT_NAME(cc.parent_object_id))
        + N' DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
    FROM sys.check_constraints cc
    WHERE cc.parent_object_id = OBJECT_ID('{table}')
      AND cc.parent_column_id IS NOT NULL
      AND COL_NAME(cc.parent_object_id, cc.parent_column_id) = '{column}';

    IF LEN(@sql) > 0 EXEC sp_executesql @sql;

    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('{table}') AND name = '{column}' AND is_nullable = 0
    )
        ALTER TABLE [{table}] ALTER COLUMN [{column}] INT NULL;
END
";
        await TryExec(db, sql);
    }

    private static async Task TryExec(SistemaKyoGroupContext db, string sql)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(sql);
        }
        catch (Exception ex)
        {
            Console.WriteLine("VentasSchemaHelper: " + ex.Message);
        }
    }
}
