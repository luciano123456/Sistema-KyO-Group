using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System.Globalization;

namespace SistemaKyoGroup.DAL;

public static class ProveedoresInsumosHistorialHelper
{
    public const string OrigenManual = "Manual";
    public const string OrigenImportacion = "Importacion";
    public const string OrigenSistema = "Sistema";
    public const string OrigenCompra = "Compra";

    public static async Task EnsureTableAsync(SistemaKyoGroupContext db)
    {
        await db.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Proveedores_Insumos_Listas_Historial')
BEGIN
    CREATE TABLE Proveedores_Insumos_Listas_Historial (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        IdLista INT NOT NULL,
        IdProveedor INT NOT NULL,
        Accion VARCHAR(20) NOT NULL,
        Origen VARCHAR(20) NOT NULL CONSTRAINT DF_PILH_Origen DEFAULT 'Manual',
        Resumen NVARCHAR(500) NOT NULL,
        Detalle NVARCHAR(MAX) NULL,
        CostoAnterior DECIMAL(18,4) NULL,
        CostoNuevo DECIMAL(18,4) NULL,
        CostoUnitarioAnterior DECIMAL(18,4) NULL,
        CostoUnitarioNuevo DECIMAL(18,4) NULL,
        CantidadAnterior DECIMAL(18,4) NULL,
        CantidadNueva DECIMAL(18,4) NULL,
        PorcDescAnterior DECIMAL(18,4) NULL,
        PorcDescNuevo DECIMAL(18,4) NULL,
        IdUsuario INT NOT NULL,
        UsuarioNombre NVARCHAR(150) NULL,
        Fecha DATETIME NOT NULL CONSTRAINT DF_PILH_Fecha DEFAULT GETDATE()
    );
    CREATE INDEX IX_PILH_Lista_Fecha
        ON Proveedores_Insumos_Listas_Historial (IdLista, Fecha DESC);
    CREATE INDEX IX_PILH_Proveedor_Fecha
        ON Proveedores_Insumos_Listas_Historial (IdProveedor, Fecha DESC);
END");
    }

    public static void AgregarCreacion(
        SistemaKyoGroupContext db,
        ProveedoresInsumosLista lista,
        int idUsuario,
        string? usuarioNombre,
        string origen = OrigenManual)
    {
        if (lista.Id <= 0 || idUsuario <= 0) return;

        db.ProveedoresInsumosListaHistoriales.Add(new ProveedoresInsumosListaHistorial
        {
            IdLista = lista.Id,
            IdProveedor = lista.IdProveedor,
            Accion = "Creacion",
            Origen = origen,
            Resumen = $"Alta de precio \"{lista.Descripcion}\"",
            Detalle = $"Costo: {Fmt(lista.Costo)}. Costo unitario: {Fmt(lista.CostoUnitario)}. Cantidad: {Fmt(lista.Cantidad)}. Desc%: {Fmt(lista.PorcDesc)}.",
            CostoAnterior = null,
            CostoNuevo = lista.Costo,
            CostoUnitarioAnterior = null,
            CostoUnitarioNuevo = lista.CostoUnitario,
            CantidadAnterior = null,
            CantidadNueva = lista.Cantidad,
            PorcDescAnterior = null,
            PorcDescNuevo = lista.PorcDesc,
            IdUsuario = idUsuario,
            UsuarioNombre = Truncate(usuarioNombre, 150),
            Fecha = DateTime.Now
        });
    }

    public static void AgregarCambioSiCorresponde(
        SistemaKyoGroupContext db,
        ProveedoresInsumosLista antes,
        ProveedoresInsumosLista despues,
        int idUsuario,
        string? usuarioNombre,
        string origen = OrigenManual)
    {
        if (despues.Id <= 0 || idUsuario <= 0) return;

        var cambios = new List<string>();
        void Diff(string campo, decimal? a, decimal? d)
        {
            if (NumsIguales(a, d)) return;
            cambios.Add($"{campo}: {Fmt(a)} → {Fmt(d)}");
        }

        Diff("Costo", antes.Costo, despues.Costo);
        Diff("Costo unitario", antes.CostoUnitario, despues.CostoUnitario);
        Diff("Cantidad", antes.Cantidad, despues.Cantidad);
        Diff("Desc%", antes.PorcDesc, despues.PorcDesc);

        var descCambio = !string.Equals(
            (antes.Descripcion ?? "").Trim(),
            (despues.Descripcion ?? "").Trim(),
            StringComparison.OrdinalIgnoreCase);
        var codigoCambio = !string.Equals(
            (antes.Codigo ?? "").Trim(),
            (despues.Codigo ?? "").Trim(),
            StringComparison.OrdinalIgnoreCase);

        if (descCambio) cambios.Add($"Descripción: {antes.Descripcion} → {despues.Descripcion}");
        if (codigoCambio) cambios.Add($"Código: {antes.Codigo} → {despues.Codigo}");

        if (cambios.Count == 0) return;

        var varUnit = VariacionPct(antes.CostoUnitario, despues.CostoUnitario);
        var tendencia = varUnit > 0.0001m ? "↑ subió" : varUnit < -0.0001m ? "↓ bajó" : "sin cambio de unitario";
        var resumen = $"Precio \"{despues.Descripcion}\" {tendencia}";
        if (Math.Abs(varUnit) > 0.0001m)
            resumen += $" ({varUnit.ToString("+0.##;-0.##", CultureInfo.InvariantCulture)}%)";

        db.ProveedoresInsumosListaHistoriales.Add(new ProveedoresInsumosListaHistorial
        {
            IdLista = despues.Id,
            IdProveedor = despues.IdProveedor,
            Accion = "Modificacion",
            Origen = origen,
            Resumen = Truncate(resumen, 500),
            Detalle = string.Join(" | ", cambios),
            CostoAnterior = antes.Costo,
            CostoNuevo = despues.Costo,
            CostoUnitarioAnterior = antes.CostoUnitario,
            CostoUnitarioNuevo = despues.CostoUnitario,
            CantidadAnterior = antes.Cantidad,
            CantidadNueva = despues.Cantidad,
            PorcDescAnterior = antes.PorcDesc,
            PorcDescNuevo = despues.PorcDesc,
            IdUsuario = idUsuario,
            UsuarioNombre = Truncate(usuarioNombre, 150),
            Fecha = DateTime.Now
        });
    }

    public static async Task<List<ProveedoresInsumosListaHistorial>> ListarPorListaAsync(
        SistemaKyoGroupContext db, int idLista)
    {
        return await db.ProveedoresInsumosListaHistoriales
            .AsNoTracking()
            .Where(h => h.IdLista == idLista)
            .OrderByDescending(h => h.Fecha)
            .ThenByDescending(h => h.Id)
            .Take(200)
            .ToListAsync();
    }

    public static async Task<List<ProveedoresInsumosListaHistorial>> ListarPorProveedorAsync(
        SistemaKyoGroupContext db, int idProveedor, int take = 100)
    {
        return await db.ProveedoresInsumosListaHistoriales
            .AsNoTracking()
            .Where(h => h.IdProveedor == idProveedor)
            .OrderByDescending(h => h.Fecha)
            .ThenByDescending(h => h.Id)
            .Take(take)
            .ToListAsync();
    }

    public static async Task<string?> NombreUsuarioAsync(SistemaKyoGroupContext db, int? idUsuario)
    {
        if (idUsuario is null or <= 0) return null;
        return await db.Usuarios.AsNoTracking()
            .Where(u => u.Id == idUsuario.Value)
            .Select(u => u.Usuario)
            .FirstOrDefaultAsync();
    }

    private static bool NumsIguales(decimal? a, decimal? d)
    {
        if (a is null && d is null) return true;
        if (a is null || d is null) return false;
        return Math.Abs(a.Value - d.Value) < 0.0000001m;
    }

    private static decimal VariacionPct(decimal? anterior, decimal? nuevo)
    {
        if (anterior is null || nuevo is null) return 0;
        if (Math.Abs(anterior.Value) < 0.0000001m) return nuevo.Value == 0 ? 0 : 100m;
        return ((nuevo.Value - anterior.Value) / anterior.Value) * 100m;
    }

    private static string Fmt(decimal? v)
    {
        if (v is null) return "—";
        return v.Value.ToString("0.########", CultureInfo.InvariantCulture);
    }

    private static string Truncate(string? value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value ?? "";
        return value.Length <= max ? value : value[..max];
    }
}
