using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;
using System.Globalization;

namespace SistemaKyoGroup.DAL;

/// <summary>
/// Historial por entidad: cada ABM tiene su tabla (*_Historial).
/// Utilidades compartidas + escritura/lectura tipada.
/// </summary>
public static class EntidadHistorialHelper
{
    /// <summary>Usuario de la request actual (seteado por middleware de Application).</summary>
    private static readonly AsyncLocal<int?> CurrentUserIdHolder = new();

    public static void SetCurrentUserId(int? idUsuario) => CurrentUserIdHolder.Value = idUsuario;
    public static int? CurrentUserId => CurrentUserIdHolder.Value;

    public const string Insumo = "Insumo";
    public const string Proveedor = "Proveedor";
    public const string Usuario = "Usuario";
    public const string Compra = "Compra";
    public const string OrdenCompra = "OrdenCompra";
    public const string Local = "Local";
    public const string UnidadNegocio = "UnidadNegocio";
    public const string UnidadMedida = "UnidadMedida";
    public const string CategoriaInsumo = "CategoriaInsumo";
    public const string CategoriaReceta = "CategoriaReceta";
    public const string CategoriaSubReceta = "CategoriaSubReceta";
    public const string Rol = "Rol";
    public const string EstadoUsuario = "EstadoUsuario";
    public const string EstadoOrdenCompra = "EstadoOrdenCompra";
    public const string Cuenta = "Cuenta";
    public const string Importacion = "Importacion";
    public const string Rubro = "Rubro";

    public const string AccionCreacion = "Creacion";
    public const string AccionModificacion = "Modificacion";
    public const string AccionEliminacion = "Eliminacion";

    private static readonly (string Key, string Table)[] Catalog =
    {
        (Insumo, "Insumos_Historial"),
        (Proveedor, "Proveedores_Historial"),
        (Usuario, "Usuarios_Historial"),
        (Compra, "Compras_Historial"),
        (OrdenCompra, "OrdenesCompras_Historial"),
        (Local, "Locales_Historial"),
        (UnidadNegocio, "UnidadesNegocio_Historial"),
        (UnidadMedida, "UnidadesMedida_Historial"),
        (CategoriaInsumo, "InsumosCategorias_Historial"),
        (CategoriaReceta, "RecetasCategorias_Historial"),
        (CategoriaSubReceta, "SubRecetasCategorias_Historial"),
        (Rol, "Roles_Historial"),
        (EstadoUsuario, "EstadosUsuarios_Historial"),
        (EstadoOrdenCompra, "OrdenesComprasEstados_Historial"),
        (Cuenta, "Cuentas_Historial"),
        (Importacion, "Importaciones_Historial"),
        (Rubro, "Rubros_Historial"),
    };

    /// <summary>Resuelve el actor: explícito, o el de la request (AsyncLocal).</summary>
    public static int ResolveUserId(int? explicitId = null)
    {
        if (explicitId is > 0) return explicitId.Value;
        return CurrentUserId is > 0 ? CurrentUserId.Value : 0;
    }

    public static async Task LogNombreCatalogoAsync(
        SistemaKyoGroupContext db,
        string entidadKey,
        int idEntidad,
        string accion,
        string etiqueta,
        string? nombreAntes,
        string? nombreDespues,
        object? extraDetalle = null)
    {
        var uid = ResolveUserId();
        if (uid <= 0 || idEntidad <= 0) return;

        var nombreUser = await NombreUsuarioAsync(db, uid);
        if (accion == AccionModificacion)
        {
            var antes = Snapshot(("Nombre", nombreAntes));
            var despues = Snapshot(("Nombre", nombreDespues));
            if (!AgregarSiCambio(db, entidadKey, idEntidad, etiqueta, antes, despues, uid, nombreUser))
                return;
        }
        else
        {
            var detalle = accion == AccionCreacion
                ? $"Nombre: {Fmt(nombreDespues)}{(extraDetalle != null ? $". {extraDetalle}" : "")}"
                : (nombreAntes != null ? $"Nombre: {Fmt(nombreAntes)}" : null);
            Agregar(db, entidadKey, idEntidad, accion,
                accion == AccionCreacion ? $"Alta de {etiqueta}" :
                accion == AccionEliminacion ? $"Eliminación de {etiqueta}" : $"Modificación de {etiqueta}",
                detalle, uid, nombreUser);
        }
        await db.SaveChangesAsync();
    }

    public static async Task EnsureAllTablesAsync(SistemaKyoGroupContext db)
    {
        foreach (var (_, table) in Catalog)
        {
            await db.Database.ExecuteSqlRawAsync($@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '{table}')
BEGIN
    CREATE TABLE [{table}] (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        IdEntidad INT NOT NULL,
        Accion VARCHAR(20) NOT NULL,
        Resumen NVARCHAR(500) NOT NULL,
        Detalle NVARCHAR(MAX) NULL,
        IdUsuario INT NOT NULL,
        UsuarioNombre NVARCHAR(150) NULL,
        Fecha DATETIME NOT NULL CONSTRAINT [DF_{table}_Fecha] DEFAULT GETDATE()
    );
    CREATE INDEX [IX_{table}_Entidad_Fecha]
        ON [{table}] (IdEntidad, Fecha DESC);
END");
        }
    }

    public static void Agregar(
        SistemaKyoGroupContext db,
        string entidadKey,
        int idEntidad,
        string accion,
        string resumen,
        string? detalle,
        int idUsuario,
        string? usuarioNombre)
    {
        if (idEntidad <= 0 || idUsuario <= 0) return;

        var row = CreateRow(entidadKey);
        if (row is null) return;

        row.IdEntidad = idEntidad;
        row.Accion = Truncate(accion, 20);
        row.Resumen = Truncate(resumen, 500);
        row.Detalle = detalle;
        row.IdUsuario = idUsuario;
        row.UsuarioNombre = Truncate(usuarioNombre, 150);
        row.Fecha = DateTime.Now;

        switch (entidadKey)
        {
            case Insumo: db.InsumosHistorial.Add((InsumoHistorial)row); break;
            case Proveedor: db.ProveedoresHistorial.Add((ProveedorHistorial)row); break;
            case Usuario: db.UsuariosHistorial.Add((UsuarioHistorial)row); break;
            case Compra: db.ComprasHistorial.Add((CompraHistorial)row); break;
            case OrdenCompra: db.OrdenesComprasHistorial.Add((OrdenCompraHistorial)row); break;
            case Local: db.LocalesHistorial.Add((LocalHistorial)row); break;
            case UnidadNegocio: db.UnidadesNegocioHistorial.Add((UnidadNegocioHistorial)row); break;
            case UnidadMedida: db.UnidadesMedidaHistorial.Add((UnidadMedidaHistorial)row); break;
            case CategoriaInsumo: db.InsumosCategoriasHistorial.Add((CategoriaInsumoHistorial)row); break;
            case CategoriaReceta: db.RecetasCategoriasHistorial.Add((CategoriaRecetaHistorial)row); break;
            case CategoriaSubReceta: db.SubRecetasCategoriasHistorial.Add((CategoriaSubRecetaHistorial)row); break;
            case Rol: db.RolesHistorial.Add((RolHistorial)row); break;
            case EstadoUsuario: db.EstadosUsuariosHistorial.Add((EstadoUsuarioHistorial)row); break;
            case EstadoOrdenCompra: db.OrdenesComprasEstadosHistorial.Add((EstadoOrdenCompraHistorial)row); break;
            case Cuenta: db.CuentasHistorial.Add((CuentaHistorial)row); break;
            case Importacion: db.ImportacionesHistorial.Add((ImportacionHistorial)row); break;
            case Rubro: db.RubrosHistorial.Add((RubroHistorial)row); break;
        }
    }

    public static bool AgregarSiCambio(
        SistemaKyoGroupContext db,
        string entidadKey,
        int idEntidad,
        string etiqueta,
        IReadOnlyDictionary<string, string?> antes,
        IReadOnlyDictionary<string, string?> despues,
        int idUsuario,
        string? usuarioNombre)
    {
        var cambios = Diff(antes, despues);
        if (cambios.Count == 0) return false;
        Agregar(db, entidadKey, idEntidad, AccionModificacion,
            $"Modificación de {etiqueta}",
            string.Join(" | ", cambios),
            idUsuario, usuarioNombre);
        return true;
    }

    public static async Task<List<EntidadHistorialBase>> ListarAsync(
        SistemaKyoGroupContext db,
        string entidadKey,
        int idEntidad,
        int take = 150)
    {
        take = Math.Clamp(take, 1, 300);
        List<EntidadHistorialBase> items = entidadKey switch
        {
            Insumo => (await Query(db.InsumosHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            Proveedor => (await Query(db.ProveedoresHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            Usuario => (await Query(db.UsuariosHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            Compra => (await Query(db.ComprasHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            OrdenCompra => (await Query(db.OrdenesComprasHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            Local => (await Query(db.LocalesHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            UnidadNegocio => (await Query(db.UnidadesNegocioHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            UnidadMedida => (await Query(db.UnidadesMedidaHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            CategoriaInsumo => (await Query(db.InsumosCategoriasHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            CategoriaReceta => (await Query(db.RecetasCategoriasHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            CategoriaSubReceta => (await Query(db.SubRecetasCategoriasHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            Rol => (await Query(db.RolesHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            EstadoUsuario => (await Query(db.EstadosUsuariosHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            EstadoOrdenCompra => (await Query(db.OrdenesComprasEstadosHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            Cuenta => (await Query(db.CuentasHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            Importacion => (await Query(db.ImportacionesHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            Rubro => (await Query(db.RubrosHistorial, idEntidad, take)).Cast<EntidadHistorialBase>().ToList(),
            _ => new List<EntidadHistorialBase>()
        };
        return items;
    }

    private static async Task<List<T>> Query<T>(DbSet<T> set, int idEntidad, int take) where T : EntidadHistorialBase
        => await set.AsNoTracking()
            .Where(h => h.IdEntidad == idEntidad)
            .OrderByDescending(h => h.Fecha)
            .ThenByDescending(h => h.Id)
            .Take(take)
            .ToListAsync();


    public static bool EsEntidadValida(string? key)
        => !string.IsNullOrWhiteSpace(key) && Catalog.Any(c => c.Key.Equals(key, StringComparison.OrdinalIgnoreCase));

    public static string? NormalizarKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        return Catalog.FirstOrDefault(c => c.Key.Equals(key, StringComparison.OrdinalIgnoreCase)).Key;
    }

    public static async Task<string?> NombreUsuarioAsync(SistemaKyoGroupContext db, int? idUsuario)
    {
        if (idUsuario is null or <= 0) return null;
        return await db.Usuarios.AsNoTracking()
            .Where(u => u.Id == idUsuario.Value)
            .Select(u => u.Usuario)
            .FirstOrDefaultAsync();
    }

    /// <summary>Resuelve un FK a nombre legible para historial (nunca guardar solo el Id).</summary>
    public static async Task<string> NombreFkAsync(SistemaKyoGroupContext db, string tipoFk, int? id)
    {
        if (id is null or <= 0) return "—";
        var idv = id.Value;
        string? nom = tipoFk switch
        {
            "CategoriaInsumo" => await db.InsumosCategorias.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "CategoriaReceta" => await db.RecetasCategorias.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "CategoriaSubReceta" => await db.SubRecetasCategorias.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "UnidadMedida" => await db.UnidadesMedida.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "UnidadNegocio" => await db.UnidadesNegocios.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "Proveedor" => await db.Proveedores.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "Local" => await db.Locales.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "Rol" => await db.Roles.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "EstadoUsuario" => await db.EstadosUsuarios.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "EstadoOrdenCompra" => await db.OrdenesComprasEstados.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Nombre).FirstOrDefaultAsync(),
            "Insumo" => await db.Insumos.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Descripcion).FirstOrDefaultAsync(),
            "SubReceta" => await db.SubRecetas.AsNoTracking().Where(x => x.Id == idv).Select(x => x.Descripcion).FirstOrDefaultAsync(),
            _ => null
        };
        return string.IsNullOrWhiteSpace(nom) ? $"#{idv}" : nom!;
    }

    public static async Task<string> NombresFkListaAsync(
        SistemaKyoGroupContext db, string tipoFk, IEnumerable<int?> ids)
    {
        var list = ids?.Where(i => i.HasValue && i.Value > 0).Select(i => i!.Value).Distinct().OrderBy(i => i).ToList()
            ?? new List<int>();
        if (list.Count == 0) return "—";
        var names = new List<string>();
        foreach (var id in list)
            names.Add(await NombreFkAsync(db, tipoFk, id));
        return string.Join(", ", names);
    }

    public static Task<string> NombresFkListaAsync(
        SistemaKyoGroupContext db, string tipoFk, IEnumerable<int> ids)
        => NombresFkListaAsync(db, tipoFk, ids.Select(i => (int?)i));

    public static Dictionary<string, string?> Snapshot(params (string key, object? value)[] pairs)
    {
        var d = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in pairs)
            d[key] = S(value);
        return d;
    }

    public static List<string> Diff(
        IReadOnlyDictionary<string, string?> antes,
        IReadOnlyDictionary<string, string?> despues)
    {
        var keys = new HashSet<string>(antes.Keys, StringComparer.OrdinalIgnoreCase);
        foreach (var k in despues.Keys) keys.Add(k);
        var list = new List<string>();
        foreach (var key in keys.OrderBy(k => k, StringComparer.OrdinalIgnoreCase))
        {
            antes.TryGetValue(key, out var a);
            despues.TryGetValue(key, out var d);
            if (ValoresIguales(a, d)) continue;
            list.Add($"{key}: {Fmt(a)} → {Fmt(d)}");
        }
        return list;
    }

    public static string S(object? v) => Fmt(v);

    public static string Fmt(object? v)
    {
        if (v is null) return "—";
        return v switch
        {
            DateTime dt => dt.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
            decimal d => d.ToString("0.########", CultureInfo.InvariantCulture),
            double db => db.ToString("0.########", CultureInfo.InvariantCulture),
            float f => f.ToString("0.########", CultureInfo.InvariantCulture),
            bool b => b ? "Sí" : "No",
            _ => string.IsNullOrWhiteSpace(Convert.ToString(v, CultureInfo.InvariantCulture))
                ? "—"
                : Convert.ToString(v, CultureInfo.InvariantCulture)!.Trim()
        };
    }

    public static bool ValoresIguales(string? a, string? d)
    {
        var aa = Normalize(a);
        var dd = Normalize(d);
        if (aa == dd) return true;
        if (decimal.TryParse(aa, NumberStyles.Any, CultureInfo.InvariantCulture, out var na) &&
            decimal.TryParse(dd, NumberStyles.Any, CultureInfo.InvariantCulture, out var nd))
            return Math.Abs(na - nd) < 0.0000001m;
        return false;
    }

    private static string Normalize(string? v)
        => string.IsNullOrWhiteSpace(v) || v == "—" ? "" : v.Trim();

    private static string Truncate(string? value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value ?? "";
        return value.Length <= max ? value : value[..max];
    }

    private static EntidadHistorialBase? CreateRow(string key) => key switch
    {
        Insumo => new InsumoHistorial(),
        Proveedor => new ProveedorHistorial(),
        Usuario => new UsuarioHistorial(),
        Compra => new CompraHistorial(),
        OrdenCompra => new OrdenCompraHistorial(),
        Local => new LocalHistorial(),
        UnidadNegocio => new UnidadNegocioHistorial(),
        UnidadMedida => new UnidadMedidaHistorial(),
        CategoriaInsumo => new CategoriaInsumoHistorial(),
        CategoriaReceta => new CategoriaRecetaHistorial(),
        CategoriaSubReceta => new CategoriaSubRecetaHistorial(),
        Rol => new RolHistorial(),
        EstadoUsuario => new EstadoUsuarioHistorial(),
        EstadoOrdenCompra => new EstadoOrdenCompraHistorial(),
        Cuenta => new CuentaHistorial(),
        Importacion => new ImportacionHistorial(),
        Rubro => new RubroHistorial(),
        _ => null
    };
}
