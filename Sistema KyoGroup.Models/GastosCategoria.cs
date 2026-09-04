using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class GastosCategoria
{
    public int Id { get; set; }

    public string Nombre { get; set; } = null!;

    /// <summary>Permite armar el árbol Servicios → Luz, Gas, Internet.</summary>
    public int? IdPadre { get; set; }

    public string? Color { get; set; }

    public string? Icono { get; set; }

    public bool Activa { get; set; }

    public int Orden { get; set; }

    public virtual GastosCategoria? IdPadreNavigation { get; set; }

    public virtual ICollection<GastosCategoria> Hijas { get; set; } = new List<GastosCategoria>();

    public virtual ICollection<Gasto> Gastos { get; set; } = new List<Gasto>();
}
