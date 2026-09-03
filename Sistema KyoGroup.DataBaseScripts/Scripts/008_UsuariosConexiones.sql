-- Presencia e historial de conexiones de usuarios.
-- Requiere una cuenta con permiso ALTER sobre dbo.Usuarios
-- (user_xestion no lo tiene: la app loguea el error y sigue).

IF COL_LENGTH('dbo.Usuarios', 'FechaUltimaActividad') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios
        ADD FechaUltimaActividad DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.Usuarios', 'UltimoModulo') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios
        ADD UltimoModulo VARCHAR(40) NULL;
END
GO

IF OBJECT_ID('dbo.UsuariosConexiones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UsuariosConexiones (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UsuariosConexiones PRIMARY KEY,
        IdUsuario INT NOT NULL,
        Tipo TINYINT NOT NULL, -- 1=Conecto, 2=Desconecto, 3=Sesion expirada
        Fecha DATETIME2 NOT NULL CONSTRAINT DF_UsuariosConexiones_Fecha DEFAULT (SYSUTCDATETIME()),
        Ip NVARCHAR(64) NULL,
        UserAgent NVARCHAR(512) NULL,
        TokenJti NVARCHAR(64) NULL,
        Detalle NVARCHAR(200) NULL,
        CONSTRAINT FK_UsuariosConexiones_Usuarios
            FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id)
    );

    CREATE INDEX IX_UsuariosConexiones_Usuario_Fecha
        ON dbo.UsuariosConexiones (IdUsuario, Fecha DESC);

    CREATE INDEX IX_UsuariosConexiones_Jti
        ON dbo.UsuariosConexiones (TokenJti);
END
GO
