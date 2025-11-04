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

    public virtual ICollection<ImportacionesSubReceta> ImportacionesSubRecetaIdUsuarioModificaNavigations { get; set; } = new List<ImportacionesSubReceta>();

    public virtual ICollection<ImportacionesSubReceta> ImportacionesSubRecetaIdUsuarioRegistraNavigations { get; set; } = new List<ImportacionesSubReceta>();

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

    public virtual ICollection<Proveedor> ProveedorIdUsuarioModificaNavigations { get; set; } = new List<Proveedor>();

    public virtual ICollection<Proveedor> ProveedorIdUsuarioRegistraNavigations { get; set; } = new List<Proveedor>();

    public virtual ICollection<ProveedoresInsumosLista> ProveedoresInsumosListaIdUsuarioModificaNavigations { get; set; } = new List<ProveedoresInsumosLista>();

    public virtual ICollection<ProveedoresInsumosLista> ProveedoresInsumosListaIdUsuarioRegistraNavigations { get; set; } = new List<ProveedoresInsumosLista>();

    public virtual ICollection<ProveedoresPago> ProveedoresPagoIdUsuarioModificaNavigations { get; set; } = new List<ProveedoresPago>();

    public virtual ICollection<ProveedoresPago> ProveedoresPagoIdUsuarioRegistraNavigations { get; set; } = new List<ProveedoresPago>();

    public virtual ICollection<Receta> RecetaIdUsuarioModificaNavigations { get; set; } = new List<Receta>();

    public virtual ICollection<Receta> RecetaIdUsuarioRegistraNavigations { get; set; } = new List<Receta>();

    public virtual ICollection<RecetasInsumo> RecetasInsumoIdUsuarioModificaNavigations { get; set; } = new List<RecetasInsumo>();

    public virtual ICollection<RecetasInsumo> RecetasInsumoIdUsuarioRegistraNavigations { get; set; } = new List<RecetasInsumo>();

    public virtual ICollection<RecetasSubReceta> RecetasSubRecetaIdUsuarioModificaNavigations { get; set; } = new List<RecetasSubReceta>();

    public virtual ICollection<RecetasSubReceta> RecetasSubRecetaIdUsuarioRegistraNavigations { get; set; } = new List<RecetasSubReceta>();

    public virtual ICollection<SubReceta> SubRecetaIdUsuarioModificaNavigations { get; set; } = new List<SubReceta>();

    public virtual ICollection<SubReceta> SubRecetaIdUsuarioRegistraNavigations { get; set; } = new List<SubReceta>();

    public virtual ICollection<SubRecetasInsumo> SubRecetasInsumoIdUsuarioModificaNavigations { get; set; } = new List<SubRecetasInsumo>();

    public virtual ICollection<SubRecetasInsumo> SubRecetasInsumoIdUsuarioRegistraNavigations { get; set; } = new List<SubRecetasInsumo>();

    public virtual ICollection<SubRecetasSubReceta> SubRecetasSubRecetaIdUsuarioModificaNavigations { get; set; } = new List<SubRecetasSubReceta>();

    public virtual ICollection<SubRecetasSubReceta> SubRecetasSubRecetaIdUsuarioRegistraNavigations { get; set; } = new List<SubRecetasSubReceta>();

    public virtual ICollection<UsuariosLocal> UsuariosLocales { get; set; } = new List<UsuariosLocal>();

    public virtual ICollection<UsuariosUnidadesNegocio> UsuariosUnidadesNegocios { get; set; } = new List<UsuariosUnidadesNegocio>();
}
