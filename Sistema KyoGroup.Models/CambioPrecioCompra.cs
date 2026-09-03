namespace SistemaKyoGroup.Models;

/// <summary>Impacto de precio de lista al registrar o eliminar una compra.</summary>
public class CambioPrecioCompra
{
    public int IdInsumo { get; set; }
    public int IdProveedorLista { get; set; }
    public string Nombre { get; set; } = "";
    public decimal PrecioActual { get; set; }
    public decimal PrecioNuevo { get; set; }
}
