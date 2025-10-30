using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class Local
{
    public int Id { get; set; }

    public int? IdUnidadNegocio { get; set; }

    public string? Nombre { get; set; }

    public virtual ICollection<Compra> Compras { get; set; } = new List<Compra>();

    public virtual UnidadesNegocio? IdUnidadNegocioNavigation { get; set; }

    public virtual ICollection<Importacion> Importaciones { get; set; } = new List<Importacion>();

    public virtual ICollection<InventarioMovimiento> InventarioMovimientos { get; set; } = new List<InventarioMovimiento>();

    public virtual ICollection<InventarioTransferencia> InventarioTransferenciaIdLocalDestinoNavigations { get; set; } = new List<InventarioTransferencia>();

    public virtual ICollection<InventarioTransferencia> InventarioTransferenciaIdLocalOrigenNavigations { get; set; } = new List<InventarioTransferencia>();

    public virtual ICollection<Inventario> Inventarios { get; set; } = new List<Inventario>();

    public virtual ICollection<OrdenesCompra> OrdenesCompras { get; set; } = new List<OrdenesCompra>();

    public virtual ICollection<UsuariosLocal> UsuariosLocales { get; set; } = new List<UsuariosLocal>();
}
