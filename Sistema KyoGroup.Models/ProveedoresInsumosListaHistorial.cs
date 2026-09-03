using System;

namespace SistemaKyoGroup.Models;

/// <summary>Historial de precios de ítems de lista de proveedor (Proveedores_Insumos_Listas).</summary>
public partial class ProveedoresInsumosListaHistorial
{
    public int Id { get; set; }

    public int IdLista { get; set; }

    public int IdProveedor { get; set; }

    /// <summary>Creacion | Modificacion | Eliminacion</summary>
    public string Accion { get; set; } = null!;

    /// <summary>Manual | Importacion | Sistema</summary>
    public string Origen { get; set; } = "Manual";

    public string Resumen { get; set; } = null!;

    public string? Detalle { get; set; }

    public decimal? CostoAnterior { get; set; }
    public decimal? CostoNuevo { get; set; }

    public decimal? CostoUnitarioAnterior { get; set; }
    public decimal? CostoUnitarioNuevo { get; set; }

    public decimal? CantidadAnterior { get; set; }
    public decimal? CantidadNueva { get; set; }

    public decimal? PorcDescAnterior { get; set; }
    public decimal? PorcDescNuevo { get; set; }

    public int IdUsuario { get; set; }

    public string? UsuarioNombre { get; set; }

    public DateTime Fecha { get; set; }

    public virtual User IdUsuarioNavigation { get; set; } = null!;
}
