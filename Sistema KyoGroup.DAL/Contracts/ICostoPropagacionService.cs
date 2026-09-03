using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Contracts;

public interface ICostoPropagacionService
{
    Task PropagarDesdeCompra(Compra compra, int idUsuario);
    Task RevertirDesdeCompra(int idCompra, int idUsuario);

    /// <summary>Precios de lista que cambiarían al guardar la compra (precio factura ≠ actual).</summary>
    Task<List<CambioPrecioCompra>> PreviewPropagacionAsync(IEnumerable<ComprasInsumo> lineas);

    /// <summary>Precios de lista que volverían al valor anterior al eliminar la compra.</summary>
    Task<List<CambioPrecioCompra>> PreviewReversionAsync(int idCompra);
}
