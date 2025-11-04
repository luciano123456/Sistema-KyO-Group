using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class SubReceta
{
    public int Id { get; set; }

    public int IdUnidadNegocio { get; set; }

    public string? Sku { get; set; }

    public string Descripcion { get; set; } = null!;

    public int IdUnidadMedida { get; set; }

    public int IdCategoria { get; set; }

    public decimal CostoPorcion { get; set; }

    public decimal? CostoSubRecetas { get; set; }

    public decimal? CostoInsumos { get; set; }

    public decimal? Rendimiento { get; set; }

    public decimal? CostoUnitario { get; set; }

    public DateTime FechaActualizacion { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual SubRecetasCategoria IdCategoriaNavigation { get; set; } = null!;

    public virtual UnidadesMedida IdUnidadMedidaNavigation { get; set; } = null!;

    public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual ICollection<RecetasSubReceta> RecetasSubReceta { get; set; } = new List<RecetasSubReceta>();

    public virtual ICollection<SubRecetasInsumo> SubRecetasInsumos { get; set; } = new List<SubRecetasInsumo>();

    public virtual ICollection<SubRecetasSubReceta> SubRecetasSubRecetaIdSubRecetaHijaNavigations { get; set; } = new List<SubRecetasSubReceta>();

    public virtual ICollection<SubRecetasSubReceta> SubRecetasSubRecetaIdSubRecetaPadreNavigations { get; set; } = new List<SubRecetasSubReceta>();

    public virtual ICollection<SubRecetasUnidadesNegocio> SubRecetasUnidadesNegocios { get; set; } = new List<SubRecetasUnidadesNegocio>();
}
