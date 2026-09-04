using System;

namespace SistemaKyoGroup.Models;

/// <summary>Forma común de historiales por entidad (una tabla física por ABM).</summary>
public abstract class EntidadHistorialBase
{
    public int Id { get; set; }
    public int IdEntidad { get; set; }
    public string Accion { get; set; } = null!;
    public string Resumen { get; set; } = null!;
    public string? Detalle { get; set; }
    public int IdUsuario { get; set; }
    public string? UsuarioNombre { get; set; }
    public DateTime Fecha { get; set; }
}

public class InsumoHistorial : EntidadHistorialBase { }
public class ProveedorHistorial : EntidadHistorialBase { }
public class UsuarioHistorial : EntidadHistorialBase { }
public class CompraHistorial : EntidadHistorialBase { }
public class OrdenCompraHistorial : EntidadHistorialBase { }
public class LocalHistorial : EntidadHistorialBase { }
public class UnidadNegocioHistorial : EntidadHistorialBase { }
public class UnidadMedidaHistorial : EntidadHistorialBase { }
public class CategoriaInsumoHistorial : EntidadHistorialBase { }
public class CategoriaRecetaHistorial : EntidadHistorialBase { }
public class CategoriaSubRecetaHistorial : EntidadHistorialBase { }
public class RolHistorial : EntidadHistorialBase { }
public class EstadoUsuarioHistorial : EntidadHistorialBase { }
public class EstadoOrdenCompraHistorial : EntidadHistorialBase { }
public class CuentaHistorial : EntidadHistorialBase { }
public class ImportacionHistorial : EntidadHistorialBase { }
public class RubroHistorial : EntidadHistorialBase { }
public class GastoHistorial : EntidadHistorialBase { }
public class CategoriaGastoHistorial : EntidadHistorialBase { }
public class MedioPagoHistorial : EntidadHistorialBase { }
public class CuentaTipoHistorial : EntidadHistorialBase { }
public class CajaSesionHistorial : EntidadHistorialBase { }
