using System.Data;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.DAL;

/// <summary>
/// Desvincula FKs a Usuarios para poder borrar un usuario sin tocar datos de negocio.
/// Asignaciones/sesiones se eliminan; auditoría nullable se anula; NOT NULL se reasigna.
/// </summary>
internal static class UsuarioDeleteHelper
{
    private static readonly HashSet<string> TablasPropias = new(StringComparer.OrdinalIgnoreCase)
    {
        "Usuarios_Locales",
        "Usuarios_UnidadesNegocio",
        "UsuariosConexiones"
    };

    private static readonly Dictionary<string, string> NombresTabla = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Usuarios_Locales"] = "Locales",
        ["Usuarios_UnidadesNegocio"] = "Unidades de negocio",
        ["UsuariosConexiones"] = "Sesiones de conexión",
        ["Insumos"] = "Insumos",
        ["Insumos_CostoHistorial"] = "Historial de costos",
        ["Recetas"] = "Recetas",
        ["Recetas_Insumos"] = "Insumos de recetas",
        ["Recetas_SubRecetas"] = "Subrecetas de recetas",
        ["Recetas_SubRecetas_Historial"] = "Historial de recetas/subrecetas",
        ["SubRecetas"] = "Subrecetas",
        ["SubRecetas_Insumos"] = "Insumos de subrecetas",
        ["SubRecetas_SubRecetas"] = "Subrecetas anidadas",
        ["Proveedores"] = "Proveedores",
        ["Proveedores_Insumos_Listas"] = "Listas de precios",
        ["Proveedores_Insumos_Listas_Historial"] = "Historial de listas",
        ["ProveedoresPagos"] = "Pagos a proveedores",
        ["Compras"] = "Compras",
        ["ComprasInsumos"] = "Detalle de compras",
        ["OrdenesCompras"] = "Órdenes de compra",
        ["OrdenesComprasInsumos"] = "Detalle de OC",
        ["Importaciones"] = "Importaciones",
        ["ImportacionesInsumos"] = "Importaciones de insumos",
        ["ImportacionesRecetas"] = "Importaciones de recetas",
        ["ImportacionesSubRecetas"] = "Importaciones de subrecetas",
        ["InventarioMovimientos"] = "Movimientos de inventario",
        ["InventarioTransferencias"] = "Transferencias de inventario",
        ["InvetarioTransferenciasDetalle"] = "Detalle de transferencias",
        ["Cajas"] = "Movimientos de caja",
        ["CajasSesiones"] = "Sesiones de caja",
        ["CajasTransferenciasCuentas"] = "Transferencias de tesorería",
        ["ChequesEmitidos"] = "Cheques emitidos",
        ["Gastos"] = "Gastos",
        ["GastosPagos"] = "Pagos de gastos"
    };

    internal sealed record FkCol(string Schema, string Table, string Column, bool Nullable);

    internal sealed class TablaDeps
    {
        public string Table { get; init; } = "";
        public string Schema { get; init; } = "dbo";
        public bool EsPropia { get; init; }
        public bool RequiereReasignar { get; init; }
        public int Cantidad { get; init; }
        public List<FkCol> Columnas { get; init; } = new();
    }

    public static async Task<List<TablaDeps>> ListarDependenciasAsync(SistemaKyoGroupContext db, int idUsuario)
    {
        var cols = await ListarFksAsync(db);
        var result = new List<TablaDeps>();

        foreach (var g in cols.GroupBy(c => (c.Schema, c.Table)))
        {
            var groupCols = g.ToList();
            var count = await ContarAsync(db, groupCols, idUsuario);
            if (count <= 0) continue;

            result.Add(new TablaDeps
            {
                Schema = g.Key.Schema,
                Table = g.Key.Table,
                EsPropia = TablasPropias.Contains(g.Key.Table),
                RequiereReasignar = groupCols.Any(c => !c.Nullable),
                Cantidad = count,
                Columnas = groupCols
            });
        }

        return result.OrderBy(t => t.EsPropia ? 0 : 1).ThenBy(t => NombreAmigable(t.Table)).ToList();
    }

    public static List<DeleteDependencia> ToDeleteDeps(IEnumerable<TablaDeps> tablas)
    {
        return tablas.Select(t => new DeleteDependencia
        {
            Entidad = NombreAmigable(t.Table),
            Cantidad = t.Cantidad,
            Detalle = t.EsPropia
                ? "Asignaciones o sesiones del usuario (se eliminan)"
                : t.RequiereReasignar
                    ? "Referencias que no pueden quedar vacías (se reasignan al usuario que confirma)"
                    : "Creador o último editor (se desvincula; el registro no se borra)",
            Cascadeable = true
        }).ToList();
    }

    public static async Task DesvincularAsync(
        SistemaKyoGroupContext db,
        IReadOnlyList<TablaDeps> tablas,
        int idUsuario,
        int? idReasignar)
    {
        foreach (var t in tablas)
        {
            if (t.EsPropia)
            {
                var where = WhereOr(t.Columnas, "{0}");
                await db.Database.ExecuteSqlRawAsync(
                    $"DELETE FROM {Q(t.Schema)}.{Q(t.Table)} WHERE {where}",
                    idUsuario);
                continue;
            }

            foreach (var col in t.Columnas)
            {
                if (col.Nullable)
                {
                    await db.Database.ExecuteSqlRawAsync(
                        $"UPDATE {Q(col.Schema)}.{Q(col.Table)} SET {Q(col.Column)} = NULL WHERE {Q(col.Column)} = {{0}}",
                        idUsuario);
                }
                else
                {
                    if (idReasignar is not > 0)
                        throw new InvalidOperationException(
                            $"No hay otro usuario para reasignar referencias en {NombreAmigable(col.Table)}.");

                    await db.Database.ExecuteSqlRawAsync(
                        $"UPDATE {Q(col.Schema)}.{Q(col.Table)} SET {Q(col.Column)} = {{0}} WHERE {Q(col.Column)} = {{1}}",
                        idReasignar.Value, idUsuario);
                }
            }
        }
    }

    private static async Task<List<FkCol>> ListarFksAsync(SistemaKyoGroupContext db)
    {
        var list = new List<FkCol>();
        var conn = db.Database.GetDbConnection();
        var close = conn.State != ConnectionState.Open;
        if (close) await conn.OpenAsync();
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
SELECT
    OBJECT_SCHEMA_NAME(fk.parent_object_id) AS SchemaName,
    OBJECT_NAME(fk.parent_object_id) AS TableName,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
    c.is_nullable
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = fk.object_id
INNER JOIN sys.columns c
    ON c.object_id = fc.parent_object_id AND c.column_id = fc.parent_column_id
INNER JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
WHERE rt.name = N'Usuarios'
  AND OBJECT_NAME(fk.parent_object_id) <> N'Usuarios';";

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var schema = reader.GetString(0);
                var table = reader.GetString(1);
                var column = reader.GetString(2);
                if (!EsIdentificador(schema) || !EsIdentificador(table) || !EsIdentificador(column))
                    continue;

                list.Add(new FkCol(schema, table, column, Convert.ToBoolean(reader.GetValue(3))));
            }
        }
        finally
        {
            if (close) await conn.CloseAsync();
        }

        return list;
    }

    private static async Task<int> ContarAsync(SistemaKyoGroupContext db, List<FkCol> cols, int idUsuario)
    {
        if (cols.Count == 0) return 0;
        var first = cols[0];
        var where = WhereOr(cols, "@id");
        var conn = db.Database.GetDbConnection();
        var close = conn.State != ConnectionState.Open;
        if (close) await conn.OpenAsync();
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"SELECT COUNT_BIG(1) FROM {Q(first.Schema)}.{Q(first.Table)} WHERE {where}";
            var p = cmd.CreateParameter();
            p.ParameterName = "@id";
            p.Value = idUsuario;
            cmd.Parameters.Add(p);
            var scalar = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(scalar);
        }
        finally
        {
            if (close) await conn.CloseAsync();
        }
    }

    private static string WhereOr(IReadOnlyList<FkCol> cols, string placeholder)
    {
        var sb = new StringBuilder();
        for (var i = 0; i < cols.Count; i++)
        {
            if (i > 0) sb.Append(" OR ");
            sb.Append(Q(cols[i].Column)).Append(" = ").Append(placeholder);
        }
        return sb.ToString();
    }

    private static string NombreAmigable(string table)
        => NombresTabla.TryGetValue(table, out var n) ? n : table.Replace('_', ' ');

    private static string Q(string name)
    {
        if (!EsIdentificador(name))
            throw new InvalidOperationException("Identificador de SQL inválido.");
        return "[" + name + "]";
    }

    private static bool EsIdentificador(string? name)
    {
        if (string.IsNullOrEmpty(name) || name.Length > 128) return false;
        if (!char.IsLetter(name[0]) && name[0] != '_') return false;
        foreach (var c in name)
        {
            if (!char.IsLetterOrDigit(c) && c != '_') return false;
        }
        return true;
    }
}
