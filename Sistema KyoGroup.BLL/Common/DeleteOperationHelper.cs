using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.Models.Common;

namespace SistemaKyoGroup.BLL.Common
{
    public static class DeleteOperationHelper
    {
        public static async Task<ServiceResult> ExecuteAsync(
            Func<Task<bool>> delete,
            string entidad,
            string mensajeExito,
            int? idReferencia = null,
            Func<Task<string?>>? preCheck = null)
        {
            var result = await ExecuteDeleteAsync(
                async cascade =>
                {
                    if (!cascade && preCheck != null)
                    {
                        var bloqueo = await preCheck();
                        if (!string.IsNullOrWhiteSpace(bloqueo))
                        {
                            return DeleteResult.Relacion(
                                bloqueo,
                                new[]
                                {
                                    new DeleteDependencia
                                    {
                                        Entidad = "Registros relacionados",
                                        Cantidad = 1,
                                        Detalle = bloqueo,
                                        Cascadeable = false
                                    }
                                },
                                cascadeDisponible: false);
                        }
                    }

                    var ok = await delete();
                    if (!ok)
                        return DeleteResult.NotFound(entidad);
                    return DeleteResult.Success(mensajeExito);
                },
                entidad,
                cascade: false,
                idReferencia);

            return result;
        }

        /// <summary>
        /// Ejecuta eliminación con soporte de dependencias / cascada.
        /// </summary>
        public static async Task<ServiceResult> ExecuteDeleteAsync(
            Func<bool, Task<DeleteResult>> delete,
            string entidad,
            bool cascade = false,
            int? idReferencia = null)
        {
            try
            {
                var r = await delete(cascade);
                var sr = ServiceResult.FromDelete(r);
                sr.IdReferencia = idReferencia;
                return sr;
            }
            catch (InvalidOperationException ex)
            {
                var msg = !string.IsNullOrWhiteSpace(ex.Message)
                    ? ex.Message
                    : $"No se pudo eliminar {entidad} porque tiene registros relacionados.";

                return new ServiceResult
                {
                    Ok = false,
                    Mensaje = msg,
                    Tipo = "relacion",
                    IdReferencia = idReferencia,
                    CascadeDisponible = false,
                    Dependencias =
                    {
                        new DeleteDependencia
                        {
                            Entidad = "Registros relacionados",
                            Cantidad = 1,
                            Detalle = msg,
                            Cascadeable = false
                        }
                    }
                };
            }
            catch (DbUpdateException ex)
            {
                var msg = MapDbUpdate(ex, entidad)
                    ?? $"No se pudo eliminar {entidad} porque tiene registros relacionados.";
                return new ServiceResult
                {
                    Ok = false,
                    Mensaje = msg,
                    Tipo = "relacion",
                    IdReferencia = idReferencia,
                    CascadeDisponible = false,
                    Dependencias =
                    {
                        new DeleteDependencia
                        {
                            Entidad = "Registros relacionados",
                            Cantidad = 1,
                            Detalle = msg,
                            Cascadeable = false
                        }
                    }
                };
            }
            catch (Exception)
            {
                return ServiceResult.Error($"Error inesperado al eliminar {entidad}.");
            }
        }

        private static string? MapDbUpdate(DbUpdateException ex, string entidad)
        {
            var text = ex.InnerException?.Message ?? ex.Message;
            if (!text.Contains("REFERENCE", StringComparison.OrdinalIgnoreCase)
                && !text.Contains("DELETE statement conflict", StringComparison.OrdinalIgnoreCase)
                && !text.Contains("conflicted with the", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            if (text.Contains("ProveedoresPagos", StringComparison.OrdinalIgnoreCase))
                return $"No se pudo eliminar {entidad}: pagos al proveedor vinculados.";

            if (text.Contains("ProveedoresCuentaCorriente", StringComparison.OrdinalIgnoreCase))
                return $"No se pudo eliminar {entidad}: movimientos en cuenta corriente del proveedor.";

            if (text.Contains("Compras", StringComparison.OrdinalIgnoreCase))
                return $"No se pudo eliminar {entidad}: compras vinculadas.";

            if (text.Contains("InventarioMovimientos", StringComparison.OrdinalIgnoreCase))
                return $"No se pudo eliminar {entidad}: movimientos de inventario vinculados.";

            return $"No se pudo eliminar {entidad} porque tiene registros relacionados en el sistema.";
        }
    }
}
