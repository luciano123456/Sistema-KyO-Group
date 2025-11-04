using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class Receta
{
    public int Id { get; set; }

    public int IdUnidadNegocio { get; set; }

    public string Sku { get; set; } = null!;

    public string Descripcion { get; set; } = null!;

    public int IdUnidadMedida { get; set; }

    public int IdCategoria { get; set; }

    public decimal? CostoSubRecetas { get; set; }

    public decimal CostoInsumos { get; set; }

    public decimal CostoPorcion { get; set; }

    public decimal? Rendimiento { get; set; }

    public decimal? CostoUnitario { get; set; }

    public DateTime FechaActualizacion { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual RecetasCategoria IdCategoriaNavigation { get; set; } = null!;

    public virtual UnidadesMedida IdUnidadMedidaNavigation { get; set; } = null!;

    public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual ICollection<RecetasInsumo> RecetasInsumos { get; set; } = new List<RecetasInsumo>();

    public virtual ICollection<RecetasSubReceta> RecetasSubReceta { get; set; } = new List<RecetasSubReceta>();

    public virtual ICollection<RecetasUnidadesNegocio> RecetasUnidadesNegocios { get; set; } = new List<RecetasUnidadesNegocio>();
}
