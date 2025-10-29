﻿using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class RecetasInsumo
{
    public int Id { get; set; }

    public int IdReceta { get; set; }

    public int IdInsumo { get; set; }

    public decimal Cantidad { get; set; }

    public decimal CostoUnitario { get; set; }

    public decimal SubTotal { get; set; }

    public int IdUsuarioRegistra { get; set; }

    public DateTime FechaRegistra { get; set; }

    public int? IdUsuarioModifica { get; set; }

    public DateTime? FechaModifica { get; set; }

    public virtual Insumo IdInsumoNavigation { get; set; } = null!;

    public virtual Receta IdRecetaNavigation { get; set; } = null!;

    public virtual User? IdUsuarioModificaNavigation { get; set; }

    public virtual User IdUsuarioRegistraNavigation { get; set; } = null!;
}
