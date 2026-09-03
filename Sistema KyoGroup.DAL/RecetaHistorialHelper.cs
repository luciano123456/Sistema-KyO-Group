using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL;

public static class RecetaHistorialHelper
{
    public const string TipoReceta = "Receta";
    public const string TipoSubReceta = "SubReceta";

    public static async Task EnsureTableAsync(SistemaKyoGroupContext db)
    {
        await db.Database.ExecuteSqlRawAsync(@"
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
END");
    }

    public static void Agregar(
        SistemaKyoGroupContext db,
        string tipoEntidad,
        int idEntidad,
        string accion,
        string resumen,
        string? detalle,
        int idUsuario,
        string? usuarioNombre)
    {
        if (idEntidad <= 0 || idUsuario <= 0) return;

        db.RecetaSubRecetaHistoriales.Add(new RecetaSubRecetaHistorial
        {
            TipoEntidad = tipoEntidad,
            IdEntidad = idEntidad,
            Accion = accion,
            Resumen = Truncate(resumen, 500),
            Detalle = detalle,
            IdUsuario = idUsuario,
            UsuarioNombre = Truncate(usuarioNombre, 150),
            Fecha = DateTime.Now
        });
    }

    public static async Task<List<RecetaSubRecetaHistorial>> ListarAsync(
        SistemaKyoGroupContext db,
        string tipoEntidad,
        int idEntidad)
    {
        return await db.RecetaSubRecetaHistoriales
            .AsNoTracking()
            .Where(h => h.TipoEntidad == tipoEntidad && h.IdEntidad == idEntidad)
            .OrderByDescending(h => h.Fecha)
            .ThenByDescending(h => h.Id)
            .Take(200)
            .ToListAsync();
    }

    private static string Truncate(string? value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value ?? "";
        return value.Length <= max ? value : value[..max];
    }

    /// <summary>
    /// Compara valores de historial evitando falsos cambios por formato (4.00 vs 4).
    /// </summary>
    public static bool ValoresIguales(object? antes, object? despues)
    {
        if (antes is null && despues is null) return true;
        if (antes is null || despues is null) return false;

        if (TryToDecimal(antes, out var da) && TryToDecimal(despues, out var dd))
            return Math.Abs(da - dd) < 0.0000001m;

        var a = (antes.ToString() ?? "").Trim();
        var d = (despues.ToString() ?? "").Trim();
        return string.Equals(a, d, StringComparison.OrdinalIgnoreCase);
    }

    public static string FormatearValor(object? valor)
    {
        if (valor is null) return "";
        if (TryToDecimal(valor, out var d))
        {
            // Sin ceros basura: 4.00 -> 4 ; 2979.85 -> 2979.85
            return d.ToString("0.########", System.Globalization.CultureInfo.InvariantCulture);
        }
        return (valor.ToString() ?? "").Trim();
    }

    private static bool TryToDecimal(object valor, out decimal result)
    {
        switch (valor)
        {
            case decimal dec:
                result = dec; return true;
            case double dbl:
                result = Convert.ToDecimal(dbl); return true;
            case float fl:
                result = Convert.ToDecimal(fl); return true;
            case int i:
                result = i; return true;
            case long l:
                result = l; return true;
            case short s:
                result = s; return true;
            case byte b:
                result = b; return true;
            case string str when decimal.TryParse(
                str.Trim().Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var parsed):
                result = parsed; return true;
            default:
                result = 0; return false;
        }
    }
}
