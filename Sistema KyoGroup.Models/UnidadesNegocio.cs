using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class UnidadesNegocio
{
    public int Id { get; set; }

    public string? Nombre { get; set; }

    public virtual ICollection<Compra> Compras { get; set; } = new List<Compra>();

    public virtual ICollection<Importacion> Importaciones { get; set; } = new List<Importacion>();

    public virtual ICollection<InsumosUnidadesNegocio> InsumosUnidadesNegocios { get; set; } = new List<InsumosUnidadesNegocio>();

    public virtual ICollection<InventarioMovimiento> InventarioMovimientos { get; set; } = new List<InventarioMovimiento>();

    public virtual ICollection<InventarioTransferencia> InventarioTransferencia { get; set; } = new List<InventarioTransferencia>();

    public virtual ICollection<Inventario> Inventarios { get; set; } = new List<Inventario>();

    public virtual ICollection<Local> Local { get; set; } = new List<Local>();

    public virtual ICollection<OrdenesCompra> OrdenesCompras { get; set; } = new List<OrdenesCompra>();

    public virtual ICollection<Receta> Receta { get; set; } = new List<Receta>();

    public virtual ICollection<RecetasUnidadesNegocio> RecetasUnidadesNegocios { get; set; } = new List<RecetasUnidadesNegocio>();

    public virtual ICollection<Subreceta> Subreceta { get; set; } = new List<Subreceta>();

    public virtual ICollection<SubrecetasUnidadesNegocio> SubrecetasUnidadesNegocios { get; set; } = new List<SubrecetasUnidadesNegocio>();

    public virtual ICollection<UsuariosUnidadesNegocio> UsuariosUnidadesNegocios { get; set; } = new List<UsuariosUnidadesNegocio>();
}
