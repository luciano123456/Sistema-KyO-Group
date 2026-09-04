using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

/// <summary>
/// Turno de caja: agrupa los movimientos de una cuenta entre una apertura y un cierre
/// para poder arquear (comparar saldo teórico contra lo realmente contado).
/// </summary>
public partial class CajasSesion
{
    public int Id { get; set; }

    public int IdCuenta { get; set; }

    public int? IdLocal { get; set; }

    public int? IdUnidadNegocio { get; set; }

    public int IdEstado { get; set; }

    public DateTime FechaApertura { get; set; }

    public DateTime? FechaCierre { get; set; }

    public decimal SaldoInicial { get; set; }

    /// <summary>Saldo calculado por el sistema al cerrar (inicial + ingresos − egresos).</summary>
    public decimal? SaldoTeorico { get; set; }

    /// <summary>Lo que el operador contó físicamente al cerrar.</summary>
    public decimal? SaldoDeclarado { get; set; }

    public decimal? Diferencia { get; set; }

    public string? NotaApertura { get; set; }

    public string? NotaCierre { get; set; }

    public int IdUsuarioAbre { get; set; }

    public int? IdUsuarioCierra { get; set; }

    public virtual Cuenta IdCuentaNavigation { get; set; } = null!;

    public virtual Local? IdLocalNavigation { get; set; }

    public virtual UnidadesNegocio? IdUnidadNegocioNavigation { get; set; }

    public virtual User IdUsuarioAbreNavigation { get; set; } = null!;

    public virtual User? IdUsuarioCierraNavigation { get; set; }

    public virtual ICollection<Caja> Cajas { get; set; } = new List<Caja>();
}
