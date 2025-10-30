using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class Importacion
{
    public int Id { get; set; }

    public int? IdUsuario { get; set; }

    public int IdTipo { get; set; }

    public int IdUnidadNegocio { get; set; }

    public int IdLocal { get; set; }

    public DateTime Fecha { get; set; }

    public string NombreArchivo { get; set; } = null!;

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual Local IdLocalNavigation { get; set; } = null!;

    public virtual ImportacionesTipo IdTipoNavigation { get; set; } = null!;

    public virtual UnidadesNegocio IdUnidadNegocioNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User? IdUsuarioNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;

    public virtual ICollection<ImportacionesReceta> ImportacionesReceta { get; set; } = new List<ImportacionesReceta>();
}
