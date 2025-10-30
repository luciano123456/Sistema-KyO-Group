using System;
using System.Collections.Generic;

namespace SistemaKyoGroup.Models;

public partial class User
{
    public int Id { get; set; }

    public string? Usuario { get; set; }

    public string? Nombre { get; set; }

    public string? Apellido { get; set; }

    public string? Dni { get; set; }

    public string? Telefono { get; set; }

    public string? Direccion { get; set; }

    public int IdRol { get; set; }

    public string Contrasena { get; set; } = null!;

    public int IdEstado { get; set; }

    public virtual ICollection<Caja> CajaIdUsuarioModificaNavigations { get; set; } = new List<Caja>();

    public virtual ICollection<Caja> CajaIdUsuarioRegistraNavigations { get; set; } = new List<Caja>();

    public virtual ICollection<CajasTransferenciasCuenta> CajasTransferenciasCuentaIdUsuarioModificaNavigations { get; set; } = new List<CajasTransferenciasCuenta>();

    public virtual ICollection<CajasTransferenciasCuenta> CajasTransferenciasCuentaIdUsuarioRegistraNavigations { get; set; } = new List<CajasTransferenciasCuenta>();

    public virtual ICollection<ChequesEmitido> ChequesEmitidoIdUsuarioModificaNavigations { get; set; } = new List<ChequesEmitido>();

    public virtual ICollection<ChequesEmitido> ChequesEmitidoIdUsuarioRegistraNavigations { get; set; } = new List<ChequesEmitido>();

    public virtual ICollection<Compra> CompraIdUsuarioModificaNavigations { get; set; } = new List<Compra>();

    public virtual ICollection<Compra> CompraIdUsuarioRegistraNavigations { get; set; } = new List<Compra>();

    public virtual ICollection<ComprasInsumo> ComprasInsumoIdUsuarioModificaNavigations { get; set; } = new List<ComprasInsumo>();

    public virtual ICollection<ComprasInsumo> ComprasInsumoIdUsuarioRegistraNavigations { get; set; } = new List<ComprasInsumo>();

    public virtual EstadosUsuario IdEstadoNavigation { get; set; } = null!;

    public virtual Rol IdRolNavigation { get; set; } = null!;

    public virtual ICollection<Importacion> ImportacioneIdUsuarioModificaNavigations { get; set; } = new List<Importacion>();

    public virtual ICollection<Importacion> ImportacioneIdUsuarioNavigations { get; set; } = new List<Importacion>();

    public virtual ICollection<Importacion> ImportacioneIdUsuarioRegistraNavigations { get; set; } = new List<Importacion>();

    public virtual ICollection<ImportacionesInsumo> ImportacionesInsumoIdUsuarioModificaNavigations { get; set; } = new List<ImportacionesInsumo>();

    public virtual ICollection<ImportacionesInsumo> ImportacionesInsumoIdUsuarioRegistraNavigations { get; set; } = new List<ImportacionesInsumo>();

    public virtual ICollection<ImportacionesReceta> ImportacionesRecetaIdUsuarioModificaNavigations { get; set; } = new List<ImportacionesReceta>();

    public virtual ICollection<ImportacionesReceta> ImportacionesRecetaIdUsuarioRegistraNavigations { get; set; } = new List<ImportacionesReceta>();

    public virtual ICollection<ImportacionesSubreceta> ImportacionesSubrecetaIdUsuarioModificaNavigations { get; set; } = new List<ImportacionesSubreceta>();

    public virtual ICollection<ImportacionesSubreceta> ImportacionesSubrecetaIdUsuarioRegistraNavigations { get; set; } = new List<ImportacionesSubreceta>();

    public virtual ICollection<Insumo> InsumoIdUsuarioModificaNavigations { get; set; } = new List<Insumo>();

    public virtual ICollection<Insumo> InsumoIdUsuarioRegistraNavigations { get; set; } = new List<Insumo>();

    public virtual ICollection<InventarioMovimiento> InventarioMovimientoIdUsuarioModificaNavigations { get; set; } = new List<InventarioMovimiento>();

    public virtual ICollection<InventarioMovimiento> InventarioMovimientoIdUsuarioRegistraNavigations { get; set; } = new List<InventarioMovimiento>();

    public virtual ICollection<InventarioTransferencia> InventarioTransferenciaIdUsuarioModificaNavigations { get; set; } = new List<InventarioTransferencia>();

    public virtual ICollection<InventarioTransferencia> InventarioTransferenciaIdUsuarioRegistraNavigations { get; set; } = new List<InventarioTransferencia>();

    public virtual ICollection<InvetarioTransferenciasDetalle> InvetarioTransferenciasDetalleIdUsuarioModificaNavigations { get; set; } = new List<InvetarioTransferenciasDetalle>();

    public virtual ICollection<InvetarioTransferenciasDetalle> InvetarioTransferenciasDetalleIdUsuarioRegistraNavigations { get; set; } = new List<InvetarioTransferenciasDetalle>();

    public virtual ICollection<OrdenesCompra> OrdenesCompraIdUsuarioModificaNavigations { get; set; } = new List<OrdenesCompra>();

    public virtual ICollection<OrdenesCompra> OrdenesCompraIdUsuarioRegistraNavigations { get; set; } = new List<OrdenesCompra>();

    public virtual ICollection<OrdenesComprasInsumo> OrdenesComprasInsumoIdUsuarioModificaNavigations { get; set; } = new List<OrdenesComprasInsumo>();

    public virtual ICollection<OrdenesComprasInsumo> OrdenesComprasInsumoIdUsuarioRegistraNavigations { get; set; } = new List<OrdenesComprasInsumo>();

    public virtual ICollection<Proveedor> ProveedoreIdUsuarioModificaNavigations { get; set; } = new List<Proveedor>();

    public virtual ICollection<Proveedor> ProveedoreIdUsuarioRegistraNavigations { get; set; } = new List<Proveedor>();

    public virtual ICollection<ProveedoresInsumosLista> ProveedoresInsumosListaIdUsuarioModificaNavigations { get; set; } = new List<ProveedoresInsumosLista>();

    public virtual ICollection<ProveedoresInsumosLista> ProveedoresInsumosListaIdUsuarioRegistraNavigations { get; set; } = new List<ProveedoresInsumosLista>();

    public virtual ICollection<ProveedoresPago> ProveedoresPagoIdUsuarioModificaNavigations { get; set; } = new List<ProveedoresPago>();

    public virtual ICollection<ProveedoresPago> ProveedoresPagoIdUsuarioRegistraNavigations { get; set; } = new List<ProveedoresPago>();

    public virtual ICollection<Receta> RecetaIdUsuarioModificaNavigations { get; set; } = new List<Receta>();

    public virtual ICollection<Receta> RecetaIdUsuarioRegistraNavigations { get; set; } = new List<Receta>();

    public virtual ICollection<RecetasInsumo> RecetasInsumoIdUsuarioModificaNavigations { get; set; } = new List<RecetasInsumo>();

    public virtual ICollection<RecetasInsumo> RecetasInsumoIdUsuarioRegistraNavigations { get; set; } = new List<RecetasInsumo>();

    public virtual ICollection<RecetasSubreceta> RecetasSubrecetaIdUsuarioModificaNavigations { get; set; } = new List<RecetasSubreceta>();

    public virtual ICollection<RecetasSubreceta> RecetasSubrecetaIdUsuarioRegistraNavigations { get; set; } = new List<RecetasSubreceta>();

    public virtual ICollection<Subreceta> SubrecetaIdUsuarioModificaNavigations { get; set; } = new List<Subreceta>();

    public virtual ICollection<Subreceta> SubrecetaIdUsuarioRegistraNavigations { get; set; } = new List<Subreceta>();

    public virtual ICollection<SubrecetasInsumo> SubrecetasInsumoIdUsuarioModificaNavigations { get; set; } = new List<SubrecetasInsumo>();

    public virtual ICollection<SubrecetasInsumo> SubrecetasInsumoIdUsuarioRegistraNavigations { get; set; } = new List<SubrecetasInsumo>();

    public virtual ICollection<SubrecetasSubreceta> SubrecetasSubrecetaIdUsuarioModificaNavigations { get; set; } = new List<SubrecetasSubreceta>();

    public virtual ICollection<SubrecetasSubreceta> SubrecetasSubrecetaIdUsuarioRegistraNavigations { get; set; } = new List<SubrecetasSubreceta>();

    public virtual ICollection<UsuariosLocal> UsuariosLocales { get; set; } = new List<UsuariosLocal>();

    public virtual ICollection<UsuariosUnidadesNegocio> UsuariosUnidadesNegocios { get; set; } = new List<UsuariosUnidadesNegocio>();
}
