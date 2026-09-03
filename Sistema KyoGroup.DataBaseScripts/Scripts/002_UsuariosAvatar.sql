-- KyO Group | 002 - Avatar personalizable del usuario (color, icono y foto)
-- Ejecutar en la base configurada en appsettings (SistemaDB)

IF COL_LENGTH('dbo.Usuarios', 'AvatarColor') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios
        ADD AvatarColor NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.Usuarios', 'AvatarIcono') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios
        ADD AvatarIcono NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.Usuarios', 'AvatarFoto') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios
        ADD AvatarFoto NVARCHAR(250) NULL;
END
GO
