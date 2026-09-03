using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;

namespace SistemaKyoGroup.DAL;

/// <summary>
/// Esquema de presencia de usuarios: columnas de actividad en Usuarios
/// y tabla de eventos de conexión. Idempotente, se ejecuta al arrancar.
/// </summary>
public static class UsuariosPresenciaSchemaHelper
{
    public static async Task EnsureSchemaAsync(SistemaKyoGroupContext db)
    {
        // Cada bloque va aislado: si el usuario de BD no tiene ALTER sobre Usuarios,
        // igual se crea la tabla de conexiones.
        await TryExecAsync(db, "Usuarios.FechaUltimaActividad", @"
IF COL_LENGTH('Usuarios', 'FechaUltimaActividad') IS NULL
    ALTER TABLE [Usuarios] ADD FechaUltimaActividad DATETIME2 NULL;");

        await TryExecAsync(db, "Usuarios.UltimoModulo", @"
IF COL_LENGTH('Usuarios', 'UltimoModulo') IS NULL
    ALTER TABLE [Usuarios] ADD UltimoModulo VARCHAR(40) NULL;");

        await TryExecAsync(db, "UsuariosConexiones", @"
IF OBJECT_ID('UsuariosConexiones', 'U') IS NULL
BEGIN
    CREATE TABLE [UsuariosConexiones] (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UsuariosConexiones PRIMARY KEY,
        IdUsuario INT NOT NULL,
        Tipo TINYINT NOT NULL, -- 1=Conecto, 2=Desconecto, 3=Sesion expirada
        Fecha DATETIME2 NOT NULL CONSTRAINT DF_UsuariosConexiones_Fecha DEFAULT (SYSUTCDATETIME()),
        Ip NVARCHAR(64) NULL,
        UserAgent NVARCHAR(512) NULL,
        TokenJti NVARCHAR(64) NULL,
        Detalle NVARCHAR(200) NULL,
        CONSTRAINT FK_UsuariosConexiones_Usuarios
            FOREIGN KEY (IdUsuario) REFERENCES [Usuarios](Id)
    );

    CREATE INDEX IX_UsuariosConexiones_Usuario_Fecha
        ON [UsuariosConexiones] (IdUsuario, Fecha DESC);

    CREATE INDEX IX_UsuariosConexiones_Jti
        ON [UsuariosConexiones] (TokenJti);
END");
    }

    private static async Task TryExecAsync(SistemaKyoGroupContext db, string paso, string sql)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(sql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"UsuariosPresenciaSchemaHelper [{paso}]: {ex.Message}");
        }
    }
}
