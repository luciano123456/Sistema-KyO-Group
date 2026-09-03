using System;

namespace SistemaKyoGroup.Models;

public partial class InsumosCostoHistorial
{
    public int Id { get; set; }

    public int IdInsumo { get; set; }

    public decimal CostoAnterior { get; set; }

    public decimal CostoNuevo { get; set; }

    public string Origen { get; set; } = null!;

    public int? IdCompra { get; set; }

    public DateTime Fecha { get; set; }

    public int IdUsuario { get; set; }

    public virtual Insumo IdInsumoNavigation { get; set; } = null!;

    public virtual User IdUsuarioNavigation { get; set; } = null!;
}
