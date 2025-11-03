// Utils/DbErrorHelper.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;     // SQL Server
using Microsoft.EntityFrameworkCore;

public enum DbErrorKind
{
    Unknown = 0,
    UniqueViolation,
    ForeignKeyViolation,
    CheckViolation,
    NotNullViolation,
    Deadlock,
    Timeout,
    Concurrency,
}

public sealed record DbErrorResult(
    DbErrorKind Kind,
    string Message,                 // Mensaje amigable para UI
    string? Constraint,             // Nombre del constraint/índice si se pudo extraer
    IReadOnlyList<string> Fields,   // Campos inferidos a partir del nombre del constraint
    int? ProviderErrorCode,         // Ej: SqlException.Number
    string? Provider,               // "SqlServer", "Npgsql", "Sqlite", etc
    string? TechnicalMessage        // Texto para logs (no mostrar tal cual al usuario)
);

public sealed class DbErrorOptions
{
    /// <summary>
    /// Nombre amigable de la entidad (ej. "insumo", "proveedor").
    /// </summary>
    public string EntityDisplaySingular { get; init; } = "registro";

    /// <summary>
    /// Mapa opcional de constraint/index name -> etiqueta de campo amigable.
    /// Ej: { "UQ_Insumos_SKU": "SKU" }
    /// </summary>
    public IDictionary<string, string> ConstraintFieldMap { get; init; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Texto por defecto para errores genéricos.
    /// </summary>
    public string DefaultFriendlyMessage { get; init; } =
        "No se pudo completar la operación. Inténtalo nuevamente o contacta soporte.";
}

public static class DbErrorHelper
{
    private static readonly Regex ConstraintNameRegex =
        // captura nombres típicos de constraints/índices en mensajes de distintos providers
        new(@"(?:constraint|índice|index|unique|key)\s+['""]?([A-Za-z0-9_\-\.]+)['""]?",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// Traduce cualquier Exception (de SaveChanges) a un DbErrorResult genérico.
    /// </summary>
    public static DbErrorResult ToFriendlyResult(Exception ex, DbErrorOptions? opts = null)
    {
        opts ??= new DbErrorOptions();

        // Desenrollamos DbUpdateException para llegar al root (provider)
        var dbu = ex as DbUpdateException ?? ex.InnerException as DbUpdateException;
        var root = dbu?.InnerException ?? ex.InnerException ?? ex;

        // Intento provider-specific primero (SQL Server)
        if (root is SqlException sql)
        {
            return FromSqlServer(sql, ex, opts);
        }

        // Otros providers (heurísticas por mensaje)
        var msg = root?.Message ?? ex.Message ?? string.Empty;
        var (constraint, fields) = ExtractConstraintAndFields(msg, opts);

        // Heurísticas cross-provider por mensaje:
        var text = msg.ToLowerInvariant();
        if (text.Contains("unique") || text.Contains("duplicate") || text.Contains("is not unique"))
        {
            return Build(DbErrorKind.UniqueViolation,
                ComposeUniqueMessage(fields, opts), constraint, fields, null, ProviderName(root), ex);
        }
        if (text.Contains("foreign key") || text.Contains("violates foreign key") || text.Contains("constraint failed"))
        {
            return Build(DbErrorKind.ForeignKeyViolation,
                $"No se puede eliminar/actualizar el {opts.EntityDisplaySingular} porque está asociado a otro recurso.",
                constraint, fields, null, ProviderName(root), ex);
        }
        if (text.Contains("not null") || text.Contains("cannot be null"))
        {
            return Build(DbErrorKind.NotNullViolation,
                $"Faltan datos obligatorios. Verificá los campos requeridos.", constraint, fields, null, ProviderName(root), ex);
        }
        if (text.Contains("deadlock"))
        {
            return Build(DbErrorKind.Deadlock,
                "El sistema está ocupado (deadlock). Probá nuevamente.", constraint, fields, null, ProviderName(root), ex);
        }
        if (text.Contains("timeout"))
        {
            return Build(DbErrorKind.Timeout,
                "Se agotó el tiempo de espera. Intentá de nuevo.", constraint, fields, null, ProviderName(root), ex);
        }
        if (text.Contains("concurrency"))
        {
            return Build(DbErrorKind.Concurrency,
                "Otro usuario modificó este registro. Actualizá la pantalla y volvé a intentar.", constraint, fields, null, ProviderName(root), ex);
        }

        return Build(DbErrorKind.Unknown, opts.DefaultFriendlyMessage, constraint, fields, null, ProviderName(root), ex);
    }

    private static DbErrorResult FromSqlServer(SqlException sql, Exception fullEx, DbErrorOptions opts)
    {
        var msg = sql.Message ?? string.Empty;
        var (constraint, fields) = ExtractConstraintAndFields(msg, opts);

        return sql.Number switch
        {
            2627 or 2601 => Build(DbErrorKind.UniqueViolation,
                                  ComposeUniqueMessage(fields, opts), constraint, fields, sql.Number, "SqlServer", fullEx),
            547 => Build(DbErrorKind.ForeignKeyViolation,
                                  $"No se puede eliminar/actualizar el {opts.EntityDisplaySingular} porque está asociado a otro recurso.",
                                  constraint, fields, sql.Number, "SqlServer", fullEx),
            1205 => Build(DbErrorKind.Deadlock,
                                  "El sistema está ocupado (deadlock). Probá nuevamente.",
                                  constraint, fields, sql.Number, "SqlServer", fullEx),
            -2 => Build(DbErrorKind.Timeout,
                                  "Se agotó el tiempo de espera. Intentá de nuevo.",
                                  constraint, fields, sql.Number, "SqlServer", fullEx),
            _ => Build(DbErrorKind.Unknown,
                                  opts.DefaultFriendlyMessage,
                                  constraint, fields, sql.Number, "SqlServer", fullEx),
        };
    }

    private static (string? constraint, List<string> fields) ExtractConstraintAndFields(string message, DbErrorOptions opts)
    {
        string? constraint = null;
        var fields = new List<string>();

        var m = ConstraintNameRegex.Match(message ?? string.Empty);
        if (m.Success && m.Groups.Count > 1)
        {
            constraint = m.Groups[1].Value;

            // 1) Mapeo explícito si lo configuraste
            if (opts.ConstraintFieldMap.TryGetValue(constraint, out var friendlyField) && !string.IsNullOrWhiteSpace(friendlyField))
                fields.Add(friendlyField);

            // 2) Heurística: si el nombre del constraint parece incluir el/los campos
            //    UQ_Insumos_SKU   => ["SKU"]
            //    UX_Insumos_Codigo_Proveedor => ["Codigo","Proveedor"]
            var parts = constraint.Split(new[] { '_', '.' }, StringSplitOptions.RemoveEmptyEntries);
            // filtramos prefijos comunes
            var skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "UQ", "UX", "PK", "FK", "IX", "AK", "Insumos", "dbo", "DBO" };

            foreach (var p in parts.Reverse()) // de derecha a izquierda suele estar el campo
            {
                if (skip.Contains(p)) continue;
                // si parece "IdProveedor", "SKU", "Codigo", etc. lo tomamos
                if (Regex.IsMatch(p, @"^[A-Za-z][A-Za-z0-9]*$"))
                    fields.Insert(0, p);
            }

            fields = fields.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        return (constraint, fields);
    }

    private static string ComposeUniqueMessage(IReadOnlyList<string> fields, DbErrorOptions opts)
    {
        if (fields.Count == 1)
            return $"Ya existe un {opts.EntityDisplaySingular} con el mismo {fields[0]}.";
        if (fields.Count > 1)
            return $"Ya existe un {opts.EntityDisplaySingular} con la misma combinación de {string.Join(" + ", fields)}.";
        // fallback
        return $"Ya existe un {opts.EntityDisplaySingular} con datos que deben ser únicos (revisá duplicados).";
    }

    private static string ProviderName(Exception? root)
    {
        var t = root?.GetType().FullName ?? string.Empty;
        if (t.Contains("SqlException")) return "SqlServer";
        if (t.Contains("Npgsql")) return "Postgres";
        if (t.Contains("Sqlite")) return "Sqlite";
        return null;
    }

    private static DbErrorResult Build(
        DbErrorKind kind,
        string message,
        string? constraint,
        IReadOnlyList<string> fields,
        int? providerCode,
        string? provider,
        Exception fullEx)
    {
        return new DbErrorResult(
            kind,
            message,
            constraint,
            fields?.ToList() ?? new List<string>(),
            providerCode,
            provider,
            fullEx.ToString()
        );
    }

    /// <summary>
    /// Atajo: devuelve solo el mensaje amigable (para usar directo en Controller).
    /// </summary>
    public static string FriendlyMessage(Exception ex, string entidadSingular = "registro",
        IDictionary<string, string>? constraintMap = null)
    {
        var res = ToFriendlyResult(ex, new DbErrorOptions
        {
            EntityDisplaySingular = entidadSingular,
            ConstraintFieldMap = constraintMap ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        });
        return res.Message;
    }
}
