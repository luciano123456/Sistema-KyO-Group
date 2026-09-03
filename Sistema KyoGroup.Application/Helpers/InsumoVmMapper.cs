using SistemaKyoGroup.Application.Models.ViewModels;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.Application.Helpers;

public static class InsumoVmMapper
{
    public static VMInsumo ToViewModel(Insumo c, int? idProveedorFiltro = null)
    {
        var proveedorMasBarato = idProveedorFiltro is int pid && pid > 0
            ? c.InsumosProveedores.FirstOrDefault(p =>
                p.IdListaProveedorNavigation != null &&
                p.IdListaProveedorNavigation.IdProveedor == pid)
            : c.InsumosProveedores
                .Where(p => p.IdListaProveedorNavigation != null && p.IdListaProveedorNavigation.IdProveedorNavigation != null)
                .OrderBy(p => p.IdListaProveedorNavigation!.CostoUnitario)
                .FirstOrDefault();

        return new VMInsumo
        {
            Id = c.Id,
            Descripcion = c.Descripcion,
            Sku = c.Sku,
            IdCategoria = c.IdCategoria,
            IdUnidadMedida = c.IdUnidadMedida,
            FechaActualizacion = c.FechaActualizacion,
            Categoria = c.IdCategoriaNavigation?.Nombre ?? "",
            UnidadMedida = c.IdUnidadMedidaNavigation?.Nombre ?? "",
            UnidadesNegocio = c.InsumosUnidadesNegocios
                .Select(u => u.IdUnidadNegocioNavigation?.Nombre ?? "")
                .ToList(),
            ProveedorDestacado = proveedorMasBarato?.IdListaProveedorNavigation?.IdProveedorNavigation?.Nombre ?? "",
            CostoUnitario = proveedorMasBarato?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
            PrecioLista = proveedorMasBarato?.IdListaProveedorNavigation?.CostoUnitario ?? 0,
            CantidadProveedores = c.InsumosProveedores?.Count ?? 0,
            IdProveedorLista = proveedorMasBarato?.IdListaProveedorNavigation?.Id ?? 0,
            IdUsuarioRegistra = (int)c.IdUsuarioRegistra,
            FechaRegistra = (DateTime)c.FechaRegistra,
            IdUsuarioModifica = c.IdUsuarioModifica,
            FechaModifica = c.FechaModifica,
            UsuarioRegistra = c.IdUsuarioRegistraNavigation?.Usuario,
            UsuarioModifica = c.IdUsuarioModificaNavigation?.Usuario
        };
    }
}
