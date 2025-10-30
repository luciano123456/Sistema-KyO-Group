using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.DataContext;

public partial class SistemaKyoGroupContext : DbContext
{
    public SistemaKyoGroupContext()
    {
    }

    public SistemaKyoGroupContext(DbContextOptions<SistemaKyoGroupContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Caja> Cajas { get; set; }

    public virtual DbSet<CajasTransferenciasCuenta> CajasTransferenciasCuentas { get; set; }

    public virtual DbSet<ChequesEmitido> ChequesEmitidos { get; set; }

    public virtual DbSet<ChequesEstado> ChequesEstados { get; set; }

    public virtual DbSet<Compra> Compras { get; set; }

    public virtual DbSet<ComprasInsumo> ComprasInsumos { get; set; }

    public virtual DbSet<Cuenta> Cuentas { get; set; }

    public virtual DbSet<EstadosUsuario> EstadosUsuarios { get; set; }

    public virtual DbSet<Importacion> Importacions { get; set; }

    public virtual DbSet<ImportacionsInsumo> ImportacionsInsumos { get; set; }

    public virtual DbSet<ImportacionsReceta> ImportacionsRecetas { get; set; }

    public virtual DbSet<ImportacionsSubreceta> ImportacionsSubrecetas { get; set; }

    public virtual DbSet<ImportacionsTipo> ImportacionsTipos { get; set; }

    public virtual DbSet<Insumo> Insumos { get; set; }

    public virtual DbSet<InsumosCategoria> InsumosCategorias { get; set; }

    public virtual DbSet<InsumosProveedor> InsumosProveedors { get; set; }

    public virtual DbSet<InsumosUnidadesNegocio> InsumosUnidadesNegocios { get; set; }

    public virtual DbSet<Inventario> Inventarios { get; set; }

    public virtual DbSet<InventarioMovimiento> InventarioMovimientos { get; set; }

    public virtual DbSet<InventarioTransferencia> InventarioTransferencias { get; set; }

    public virtual DbSet<InventarioTransferenciasMotivo> InventarioTransferenciasMotivos { get; set; }

    public virtual DbSet<InvetarioTransferenciasDetalle> InvetarioTransferenciasDetalles { get; set; }

    public virtual DbSet<Local> Locales { get; set; }

    public virtual DbSet<OrdenesCompra> OrdenesCompras { get; set; }

    public virtual DbSet<OrdenesComprasEstado> OrdenesComprasEstados { get; set; }

    public virtual DbSet<OrdenesComprasInsumo> OrdenesComprasInsumos { get; set; }

    public virtual DbSet<OrdenesComprasInsumosEstado> OrdenesComprasInsumosEstados { get; set; }

    public virtual DbSet<Proveedor> Proveedors { get; set; }

    public virtual DbSet<ProveedorsCuentaCorriente> ProveedorsCuentaCorrientes { get; set; }

    public virtual DbSet<ProveedorsInsumosLista> ProveedorsInsumosListas { get; set; }

    public virtual DbSet<ProveedorsPago> ProveedorsPagos { get; set; }

    public virtual DbSet<Provincia> Provincias { get; set; }

    public virtual DbSet<Receta> Recetas { get; set; }

    public virtual DbSet<RecetasCategoria> RecetasCategorias { get; set; }

    public virtual DbSet<RecetasInsumo> RecetasInsumos { get; set; }

    public virtual DbSet<RecetasSubreceta> RecetasSubrecetas { get; set; }

    public virtual DbSet<RecetasUnidadesNegocio> RecetasUnidadesNegocios { get; set; }

    public virtual DbSet<Rol> Roles { get; set; }

    public virtual DbSet<Subreceta> Subrecetas { get; set; }

    public virtual DbSet<SubrecetasCategoria> SubrecetasCategorias { get; set; }

    public virtual DbSet<SubrecetasInsumo> SubrecetasInsumos { get; set; }

    public virtual DbSet<SubrecetasSubreceta> SubrecetasSubrecetas { get; set; }

    public virtual DbSet<SubrecetasUnidadesNegocio> SubrecetasUnidadesNegocios { get; set; }

    public virtual DbSet<UnidadesMedida> UnidadesMedida { get; set; }

    public virtual DbSet<UnidadesNegocio> UnidadesNegocios { get; set; }

    public virtual DbSet<User> Usuarios { get; set; }

    public virtual DbSet<UsuariosLocal> UsuariosLocales { get; set; }

    public virtual DbSet<UsuariosUnidadesNegocio> UsuariosUnidadesNegocios { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see http://go.microsoft.com/fwlink/?LinkId=723263.
        => optionsBuilder.UseSqlServer("Server=DESKTOP-3MT5F5F; Database=Sistema_KyoGroup; Integrated Security=true; Trusted_Connection=True; Encrypt=False");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Caja>(entity =>
        {
            entity.Property(e => e.Concepto)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.Egreso).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Fecha).HasColumnType("date");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra).HasColumnType("datetime");
            entity.Property(e => e.Ingreso).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TipoMov)
                .HasMaxLength(70)
                .IsUnicode(false);

            entity.HasOne(d => d.IdCuentaNavigation).WithMany(p => p.Cajas)
                .HasForeignKey(d => d.IdCuenta)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Cajas_Cuentas");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.CajaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Cajas_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.CajaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Cajas_UsuarioRegistra");
        });

        modelBuilder.Entity<CajasTransferenciasCuenta>(entity =>
        {
            entity.Property(e => e.Concepto)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Fecha).HasColumnType("date");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra).HasColumnType("datetime");
            entity.Property(e => e.ImporteDestino).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.ImporteOrigen).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.NotaInterna)
                .HasMaxLength(200)
                .IsUnicode(false);

            entity.HasOne(d => d.IdCuentaDestinoNavigation).WithMany(p => p.CajasTransferenciasCuentaIdCuentaDestinoNavigations)
                .HasForeignKey(d => d.IdCuentaDestino)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CajasTransferenciasCuentas_Cuentas1");

            entity.HasOne(d => d.IdCuentaOrigenNavigation).WithMany(p => p.CajasTransferenciasCuentaIdCuentaOrigenNavigations)
                .HasForeignKey(d => d.IdCuentaOrigen)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CajasTransferenciasCuentas_Cuentas");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.CajasTransferenciasCuentaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_CajasTransferenciasCuentas_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.CajasTransferenciasCuentaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CajasTransferenciasCuentas_UsuarioRegistra");
        });

        modelBuilder.Entity<ChequesEmitido>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ChequesEmitidos_1");

            entity.Property(e => e.FechaEmision).HasColumnType("date");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaPago).HasColumnType("date");
            entity.Property(e => e.FechaRegistra).HasColumnType("datetime");
            entity.Property(e => e.Importe).HasColumnType("date");
            entity.Property(e => e.Numero)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.IdCuentaDebitarNavigation).WithMany(p => p.ChequesEmitidos)
                .HasForeignKey(d => d.IdCuentaDebitar)
                .HasConstraintName("FK_ChequesEmitidos_Cuentas");

            entity.HasOne(d => d.IdEstadoNavigation).WithMany(p => p.ChequesEmitidos)
                .HasForeignKey(d => d.IdEstado)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ChequesEmitidos_ChequesEstados");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.ChequesEmitidoIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_ChequesEmitidos_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.ChequesEmitidoIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ChequesEmitidos_UsuarioRegistra");
        });

        modelBuilder.Entity<ChequesEstado>(entity =>
        {
            entity.Property(e => e.Nombre)
                .HasMaxLength(70)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Compra>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_FacturasProveedors");

            entity.Property(e => e.Descuentos).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.Fecha).HasColumnType("datetime");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra).HasColumnType("datetime");
            entity.Property(e => e.NotaInterna)
                .HasMaxLength(500)
                .IsUnicode(false);
            entity.Property(e => e.Subtotal).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.SubtotalFinal).HasColumnType("decimal(20, 2)");

            entity.HasOne(d => d.IdLocalNavigation).WithMany(p => p.Compras)
                .HasForeignKey(d => d.IdLocal)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_FacturasProveedors_Locals");

            entity.HasOne(d => d.IdOrdenCompraNavigation).WithMany(p => p.Compras)
                .HasForeignKey(d => d.IdOrdenCompra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_FacturasProveedors_OrdenesCompras");

            entity.HasOne(d => d.IdProveedorNavigation).WithMany(p => p.Compras)
                .HasForeignKey(d => d.IdProveedor)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_FacturasProveedors_Proveedors");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.Compras)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_FacturasProveedors_Unidades_Negocio");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.CompraIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Compras_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.CompraIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Compras_UsuarioRegistra");
        });

        modelBuilder.Entity<ComprasInsumo>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_FacturasProveedorsInsumos");

            entity.Property(e => e.Cantidad).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.DescuentoTotal).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.DescuentoUnitario).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.Diferencia).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra).HasColumnType("datetime");
            entity.Property(e => e.PorcDescuento).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.PrecioFactura).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.PrecioFinal).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.PrecioLista).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.SubtotalConDescuento).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.SubtotalFinal).HasColumnType("decimal(20, 2)");

            entity.HasOne(d => d.IdCompraNavigation).WithMany(p => p.ComprasInsumos)
                .HasForeignKey(d => d.IdCompra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_FacturasProveedorsInsumos_FacturasProveedors");

            entity.HasOne(d => d.IdInsumoNavigation).WithMany(p => p.ComprasInsumos)
                .HasForeignKey(d => d.IdInsumo)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ComprasInsumos_Insumos");

            entity.HasOne(d => d.IdProveedorListaNavigation).WithMany(p => p.ComprasInsumos)
                .HasForeignKey(d => d.IdProveedorLista)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_FacturasProveedorsInsumos_Proveedors_Insumos_Listas");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.ComprasInsumoIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_ComprasInsumos_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.ComprasInsumoIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ComprasInsumos_UsuarioRegistra");
        });

        modelBuilder.Entity<Cuenta>(entity =>
        {
            entity.Property(e => e.Nombre)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<EstadosUsuario>(entity =>
        {
            entity.Property(e => e.Nombre)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Importacion>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_VentasImportacions");

            entity.Property(e => e.Fecha).HasColumnType("date");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra).HasColumnType("datetime");
            entity.Property(e => e.NombreArchivo)
                .HasMaxLength(100)
                .IsUnicode(false);

            entity.HasOne(d => d.IdLocalNavigation).WithMany(p => p.Importacions)
                .HasForeignKey(d => d.IdLocal)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Importacions_Locals");

            entity.HasOne(d => d.IdTipoNavigation).WithMany(p => p.Importacions)
                .HasForeignKey(d => d.IdTipo)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Importacions_ImportacionsTipos");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.Importacions)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Importacions_Unidades_Negocio");

            entity.HasOne(d => d.IdUsuarioNavigation).WithMany(p => p.ImportacionIdUsuarioNavigations)
                .HasForeignKey(d => d.IdUsuario)
                .HasConstraintName("FK_Importacions_Usuarios");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.ImportacionIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Importacions_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.ImportacionIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Importacions_UsuarioRegistra");
        });

        modelBuilder.Entity<ImportacionsInsumo>(entity =>
        {
            entity.Property(e => e.Cantidad).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra).HasColumnType("datetime");
            entity.Property(e => e.Subtotal).HasColumnType("decimal(18, 2)");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.ImportacionsInsumoIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_ImportacionsInsumos_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.ImportacionsInsumoIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ImportacionsInsumos_UsuarioRegistra");

            entity.HasOne(d => d.IdVentaRecetaNavigation).WithMany(p => p.ImportacionsInsumos)
                .HasForeignKey(d => d.IdVentaReceta)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ImportacionsInsumos_ImportacionsRecetas");
        });

        modelBuilder.Entity<ImportacionsReceta>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_VentasRecetas");

            entity.Property(e => e.Codigo)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Descripcion)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra).HasColumnType("datetime");
            entity.Property(e => e.Ganancia).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.PrecioUnitario).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Subtotal).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SubtotalCosto).HasColumnType("decimal(18, 2)");

            entity.HasOne(d => d.IdImportacionNavigation).WithMany(p => p.ImportacionsReceta)
                .HasForeignKey(d => d.IdImportacion)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_VentasRecetas_VentasImportacions");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.ImportacionsRecetaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_ImportacionsRecetas_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.ImportacionsRecetaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ImportacionsRecetas_UsuarioRegistra");
        });

        modelBuilder.Entity<ImportacionsSubreceta>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_VentasRecetasSubrecetas");

            entity.Property(e => e.Cantidad).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra).HasColumnType("datetime");
            entity.Property(e => e.Subtotal).HasColumnType("decimal(18, 2)");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.ImportacionsSubrecetaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_ImportacionsSubrecetas_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.ImportacionsSubrecetaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ImportacionsSubrecetas_UsuarioRegistra");

            entity.HasOne(d => d.IdVentaRecetaNavigation).WithMany(p => p.ImportacionsSubreceta)
                .HasForeignKey(d => d.IdVentaReceta)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_VentasRecetasSubrecetas_VentasRecetas");
        });

        modelBuilder.Entity<ImportacionsTipo>(entity =>
        {
            entity.Property(e => e.Nombre)
                .HasMaxLength(70)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Insumo>(entity =>
        {
            entity.Property(e => e.Descripcion)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.FechaActualizacion).HasColumnType("datetime");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.Sku)
                .HasMaxLength(150)
                .IsUnicode(false);

            entity.HasOne(d => d.IdCategoriaNavigation).WithMany(p => p.Insumos)
                .HasForeignKey(d => d.IdCategoria)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Insumos_Insumos_Categorias");

            entity.HasOne(d => d.IdUnidadMedidaNavigation).WithMany(p => p.Insumos)
                .HasForeignKey(d => d.IdUnidadMedida)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Insumos_Unidades_Medida");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.InsumoIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Insumos_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.InsumoIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Insumos_UsuarioRegistra");
        });

        modelBuilder.Entity<InsumosCategoria>(entity =>
        {
            entity.ToTable("Insumos_Categorias");

            entity.Property(e => e.Nombre)
                .HasMaxLength(255)
                .IsUnicode(false);
        });

        modelBuilder.Entity<InsumosProveedor>(entity =>
        {
            entity.ToTable("Insumos_Proveedors");

            entity.Property(e => e.IdInsumo)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.IdListaProveedorNavigation).WithMany(p => p.InsumosProveedors)
                .HasForeignKey(d => d.IdListaProveedor)
                .HasConstraintName("FK_Insumos_Proveedors_Proveedors_Insumos_Listas");
        });

        modelBuilder.Entity<InsumosUnidadesNegocio>(entity =>
        {
            entity.ToTable("Insumos_UnidadesNegocio");

            entity.Property(e => e.IdInsumo)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.InsumosUnidadesNegocios)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_Insumos_UnidadesNegocio_Unidades_Negocio");
        });

        modelBuilder.Entity<Inventario>(entity =>
        {
            entity.ToTable("Inventario");

            entity.Property(e => e.Cantidad).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Tipo)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.IdLocalNavigation).WithMany(p => p.Inventarios)
                .HasForeignKey(d => d.IdLocal)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Inventario_Locals");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.Inventarios)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Inventario_Unidades_Negocio");
        });

        modelBuilder.Entity<InventarioMovimiento>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Insumos_Stock");

            entity.Property(e => e.Concepto)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.Entrada).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.Fecha).HasColumnType("date");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.Salida).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.Tipo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.TipoMovimiento)
                .HasMaxLength(70)
                .IsUnicode(false);

            entity.HasOne(d => d.IdLocalNavigation).WithMany(p => p.InventarioMovimientos)
                .HasForeignKey(d => d.IdLocal)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Insumos_Stock_Locals");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.InventarioMovimientos)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Insumos_Stock_Unidades_Negocio");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.InventarioMovimientoIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_InventarioMovimientos_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.InventarioMovimientoIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_InventarioMovimientos_UsuarioRegistra");
        });

        modelBuilder.Entity<InventarioTransferencia>(entity =>
        {
            entity.Property(e => e.Concepto)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.Fecha).HasColumnType("date");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.NotaInterna)
                .HasMaxLength(200)
                .IsUnicode(false);

            entity.HasOne(d => d.IdLocalDestinoNavigation).WithMany(p => p.InventarioTransferenciaIdLocalDestinoNavigations)
                .HasForeignKey(d => d.IdLocalDestino)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_InventarioTransferencias_Locals1");

            entity.HasOne(d => d.IdLocalOrigenNavigation).WithMany(p => p.InventarioTransferenciaIdLocalOrigenNavigations)
                .HasForeignKey(d => d.IdLocalOrigen)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_InventarioTransferencias_Locals");

            entity.HasOne(d => d.IdMotivoNavigation).WithMany(p => p.InventarioTransferencia)
                .HasForeignKey(d => d.IdMotivo)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_InventarioTransferencias_InventarioTransferenciasMotivos");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.InventarioTransferencia)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_InventarioTransferencias_Unidades_Negocio");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.InventarioTransferenciaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_InventarioTransferencias_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.InventarioTransferenciaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_InventarioTransferencias_UsuarioRegistra");
        });

        modelBuilder.Entity<InventarioTransferenciasMotivo>(entity =>
        {
            entity.Property(e => e.Nombre)
                .HasMaxLength(50)
                .IsUnicode(false);
        });

        modelBuilder.Entity<InvetarioTransferenciasDetalle>(entity =>
        {
            entity.ToTable("InvetarioTransferenciasDetalle");

            entity.Property(e => e.Cantidad).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.Tipo)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.IdTransferenciaNavigation).WithMany(p => p.InvetarioTransferenciasDetalles)
                .HasForeignKey(d => d.IdTransferencia)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_InvetarioTransferenciasDetalle_InventarioTransferencias");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.InvetarioTransferenciasDetalleIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_InvetarioTransferenciasDetalle_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.InvetarioTransferenciasDetalleIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_InvetarioTransferenciasDetalle_UsuarioRegistra");
        });

        modelBuilder.Entity<Local>(entity =>
        {
            entity.Property(e => e.Nombre)
                .HasMaxLength(150)
                .IsUnicode(false);

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.Local)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .HasConstraintName("FK_Locals_Unidades_Negocio");
        });

        modelBuilder.Entity<OrdenesCompra>(entity =>
        {
            entity.Property(e => e.CostoTotal).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.FechaEmision).HasColumnType("datetime");
            entity.Property(e => e.FechaEntrega).HasColumnType("datetime");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.NotaInterna)
                .HasMaxLength(500)
                .IsUnicode(false);

            entity.HasOne(d => d.IdEstadoNavigation).WithMany(p => p.OrdenesCompras)
                .HasForeignKey(d => d.IdEstado)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrdenesCompras_OrdenesComprasEstados");

            entity.HasOne(d => d.IdLocalNavigation).WithMany(p => p.OrdenesCompras)
                .HasForeignKey(d => d.IdLocal)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrdenesCompras_Locals");

            entity.HasOne(d => d.IdProveedorNavigation).WithMany(p => p.OrdenesCompras)
                .HasForeignKey(d => d.IdProveedor)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrdenesCompras_Proveedors");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.OrdenesCompras)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrdenesCompras_Unidades_Negocio");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.OrdenesCompraIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_OrdenesCompras_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.OrdenesCompraIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrdenesCompras_UsuarioRegistra");
        });

        modelBuilder.Entity<OrdenesComprasEstado>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Estados");

            entity.Property(e => e.Nombre)
                .HasMaxLength(255)
                .IsUnicode(false);
        });

        modelBuilder.Entity<OrdenesComprasInsumo>(entity =>
        {
            entity.Property(e => e.CantidadEntregada).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CantidadPedida).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CantidadRestante).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdInsumo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.NotaInterna)
                .HasMaxLength(500)
                .IsUnicode(false);
            entity.Property(e => e.PrecioLista).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.Subtotal).HasColumnType("decimal(20, 2)");

            entity.HasOne(d => d.IdEstadoNavigation).WithMany(p => p.OrdenesComprasInsumos)
                .HasForeignKey(d => d.IdEstado)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrdenesComprasInsumos_OrdenesComprasInsumosEstados");

            entity.HasOne(d => d.IdOrdenCompraNavigation).WithMany(p => p.OrdenesComprasInsumos)
                .HasForeignKey(d => d.IdOrdenCompra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrdenesComprasInsumos_OrdenesCompras");

            entity.HasOne(d => d.IdProveedorListaNavigation).WithMany(p => p.OrdenesComprasInsumos)
                .HasForeignKey(d => d.IdProveedorLista)
                .HasConstraintName("FK_OrdenesComprasInsumos_Proveedors_Insumos_Listas");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.OrdenesComprasInsumoIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_OrdenesComprasInsumos_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.OrdenesComprasInsumoIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrdenesComprasInsumos_UsuarioRegistra");
        });

        modelBuilder.Entity<OrdenesComprasInsumosEstado>(entity =>
        {
            entity.Property(e => e.Nombre)
                .HasMaxLength(200)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Proveedor>(entity =>
        {
            entity.Property(e => e.Apodo)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.Cbu)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("CBU");
            entity.Property(e => e.Cuit)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CUIT");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.Nombre)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.Telefono)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Ubicacion)
                .HasMaxLength(500)
                .IsUnicode(false);

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.ProveedorIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Proveedors_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.ProveedorIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Proveedors_UsuarioRegistra");
        });

        modelBuilder.Entity<ProveedorsCuentaCorriente>(entity =>
        {
            entity.ToTable("Proveedors_CuentaCorriente");

            entity.Property(e => e.Concepto)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.Debe).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Fecha).HasColumnType("date");
            entity.Property(e => e.Haber).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TipoMov)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.IdProveedorNavigation).WithMany(p => p.ProveedorsCuentaCorrientes)
                .HasForeignKey(d => d.IdProveedor)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Proveedors_CuentaCorriente_Proveedors");
        });

        modelBuilder.Entity<ProveedorsInsumosLista>(entity =>
        {
            entity.ToTable("Proveedors_Insumos_Listas");

            entity.Property(e => e.Codigo)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Descripcion)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.FechaActualizacion).HasColumnType("datetime");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");

            entity.HasOne(d => d.IdProveedorNavigation).WithMany(p => p.ProveedorsInsumosLista)
                .HasForeignKey(d => d.IdProveedor)
                .HasConstraintName("FK_Proveedors_Insumos_Listas_Proveedors");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.ProveedorsInsumosListaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Proveedors_Insumos_Listas_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.ProveedorsInsumosListaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Proveedors_Insumos_Listas_UsuarioRegistra");
        });

        modelBuilder.Entity<ProveedorsPago>(entity =>
        {
            entity.Property(e => e.Concepto)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.Fecha).HasColumnType("date");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.Importe).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.NotaInterna)
                .HasMaxLength(200)
                .IsUnicode(false);

            entity.HasOne(d => d.IdCuentaNavigation).WithMany(p => p.ProveedorsPagos)
                .HasForeignKey(d => d.IdCuenta)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ComprasPagos_Cuentas");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.ProveedorsPagoIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_ProveedorsPagos_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.ProveedorsPagoIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ProveedorsPagos_UsuarioRegistra");
        });

        modelBuilder.Entity<Provincia>(entity =>
        {
            entity.Property(e => e.Nombre)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Receta>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Productos");

            entity.Property(e => e.CostoInsumos).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoPorcion).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoSubRecetas).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.Descripcion)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.FechaActualizacion).HasColumnType("datetime");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.Rendimiento).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.Sku)
                .HasMaxLength(150)
                .IsUnicode(false);

            entity.HasOne(d => d.IdCategoriaNavigation).WithMany(p => p.Receta)
                .HasForeignKey(d => d.IdCategoria)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_Recetas_Categorias");

            entity.HasOne(d => d.IdUnidadMedidaNavigation).WithMany(p => p.Receta)
                .HasForeignKey(d => d.IdUnidadMedida)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_Unidades_Medida");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.Receta)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_Unidades_Negocio");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.RecetaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Recetas_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.RecetaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_UsuarioRegistra");
        });

        modelBuilder.Entity<RecetasCategoria>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Productos_Categorias");

            entity.ToTable("Recetas_Categorias");

            entity.Property(e => e.Nombre)
                .HasMaxLength(150)
                .IsUnicode(false);
        });

        modelBuilder.Entity<RecetasInsumo>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Productos_Insumos");

            entity.ToTable("Recetas_Insumos");

            entity.Property(e => e.Cantidad).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.SubTotal).HasColumnType("decimal(20, 2)");

            entity.HasOne(d => d.IdInsumoNavigation).WithMany(p => p.RecetasInsumos)
                .HasForeignKey(d => d.IdInsumo)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_Insumos_Insumos");

            entity.HasOne(d => d.IdRecetaNavigation).WithMany(p => p.RecetasInsumos)
                .HasForeignKey(d => d.IdReceta)
                .HasConstraintName("FK_Recetas_Insumos_Recetas");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.RecetasInsumoIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Recetas_Insumos_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.RecetasInsumoIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_Insumos_UsuarioRegistra");
        });

        modelBuilder.Entity<RecetasSubreceta>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Recetas_Prefabricados");

            entity.ToTable("Recetas_Subrecetas");

            entity.Property(e => e.Cantidad).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.SubTotal).HasColumnType("decimal(20, 2)");

            entity.HasOne(d => d.IdRecetaNavigation).WithMany(p => p.RecetasSubreceta)
                .HasForeignKey(d => d.IdReceta)
                .HasConstraintName("FK_Recetas_Prefabricados_Recetas");

            entity.HasOne(d => d.IdSubRecetaNavigation).WithMany(p => p.RecetasSubreceta)
                .HasForeignKey(d => d.IdSubReceta)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_Subrecetas_Subrecetas");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.RecetasSubrecetaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Recetas_Subrecetas_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.RecetasSubrecetaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_Subrecetas_UsuarioRegistra");
        });

        modelBuilder.Entity<RecetasUnidadesNegocio>(entity =>
        {
            entity.ToTable("Recetas_UnidadesNegocio");

            entity.HasOne(d => d.IdRecetaNavigation).WithMany(p => p.RecetasUnidadesNegocios)
                .HasForeignKey(d => d.IdReceta)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_UnidadesNegocio_Recetas");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.RecetasUnidadesNegocios)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Recetas_UnidadesNegocio_Unidades_Negocio");
        });

        modelBuilder.Entity<Rol>(entity =>
        {
            entity.Property(e => e.Nombre)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Subreceta>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Prefabricados");

            entity.Property(e => e.CostoInsumos).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoPorcion).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoSubRecetas).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.Descripcion)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.FechaActualizacion).HasColumnType("datetime");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.Rendimiento).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.Sku)
                .HasMaxLength(150)
                .IsUnicode(false);

            entity.HasOne(d => d.IdCategoriaNavigation).WithMany(p => p.Subreceta)
                .HasForeignKey(d => d.IdCategoria)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subrecetas_Subrecetas_Categorias");

            entity.HasOne(d => d.IdUnidadMedidaNavigation).WithMany(p => p.Subreceta)
                .HasForeignKey(d => d.IdUnidadMedida)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subrecetas_Unidades_Medida");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.Subreceta)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subrecetas_Unidades_Negocio");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.SubrecetaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Subrecetas_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.SubrecetaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subrecetas_UsuarioRegistra");
        });

        modelBuilder.Entity<SubrecetasCategoria>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Prefabricados_Categorias");

            entity.ToTable("Subrecetas_Categorias");

            entity.Property(e => e.Nombre)
                .HasMaxLength(150)
                .IsUnicode(false);
        });

        modelBuilder.Entity<SubrecetasInsumo>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Prefabricados_Insumos");

            entity.ToTable("Subrecetas_Insumos");

            entity.Property(e => e.Cantidad).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.SubTotal).HasColumnType("decimal(20, 2)");

            entity.HasOne(d => d.IdInsumoNavigation).WithMany(p => p.SubrecetasInsumos)
                .HasForeignKey(d => d.IdInsumo)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subrecetas_Insumos_Insumos");

            entity.HasOne(d => d.IdSubrecetaNavigation).WithMany(p => p.SubrecetasInsumos)
                .HasForeignKey(d => d.IdSubreceta)
                .HasConstraintName("FK_Subrecetas_Insumos_Subrecetas");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.SubrecetasInsumoIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Subrecetas_Insumos_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.SubrecetasInsumoIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subrecetas_Insumos_UsuarioRegistra");
        });

        modelBuilder.Entity<SubrecetasSubreceta>(entity =>
        {
            entity.ToTable("Subrecetas_Subrecetas");

            entity.Property(e => e.Cantidad).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.CostoUnitario).HasColumnType("decimal(20, 2)");
            entity.Property(e => e.FechaModifica).HasColumnType("datetime");
            entity.Property(e => e.FechaRegistra)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IdUsuarioRegistra).HasDefaultValueSql("((1))");
            entity.Property(e => e.Subtotal).HasColumnType("decimal(20, 2)");

            entity.HasOne(d => d.IdSubRecetaHijaNavigation).WithMany(p => p.SubrecetasSubrecetaIdSubRecetaHijaNavigations)
                .HasForeignKey(d => d.IdSubRecetaHija)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subrecetas_Subrecetas_Subrecetas");

            entity.HasOne(d => d.IdSubRecetaPadreNavigation).WithMany(p => p.SubrecetasSubrecetaIdSubRecetaPadreNavigations)
                .HasForeignKey(d => d.IdSubRecetaPadre)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subrecetas_Subrecetas_Subrecetas1");

            entity.HasOne(d => d.IdUsuarioModificaNavigation).WithMany(p => p.SubrecetasSubrecetaIdUsuarioModificaNavigations)
                .HasForeignKey(d => d.IdUsuarioModifica)
                .HasConstraintName("FK_Subrecetas_Subrecetas_UsuarioModifica");

            entity.HasOne(d => d.IdUsuarioRegistraNavigation).WithMany(p => p.SubrecetasSubrecetaIdUsuarioRegistraNavigations)
                .HasForeignKey(d => d.IdUsuarioRegistra)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subrecetas_Subrecetas_UsuarioRegistra");
        });

        modelBuilder.Entity<SubrecetasUnidadesNegocio>(entity =>
        {
            entity.ToTable("Subrecetas_UnidadesNegocio");

            entity.HasOne(d => d.IdSubrecetaNavigation).WithMany(p => p.SubrecetasUnidadesNegocios)
                .HasForeignKey(d => d.IdSubreceta)
                .HasConstraintName("FK_Subrecetas_UnidadesNegocio_Subrecetas");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.SubrecetasUnidadesNegocios)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .HasConstraintName("FK_Subrecetas_UnidadesNegocio_Unidades_Negocio");
        });

        modelBuilder.Entity<UnidadesMedida>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ProductosUnidadesDeMedida");

            entity.ToTable("Unidades_Medida");

            entity.Property(e => e.Nombre)
                .HasMaxLength(255)
                .IsUnicode(false);
        });

        modelBuilder.Entity<UnidadesNegocio>(entity =>
        {
            entity.ToTable("Unidades_Negocio");

            entity.Property(e => e.Nombre)
                .HasMaxLength(150)
                .IsUnicode(false);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(e => e.Apellido)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Contrasena)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.Direccion)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Dni)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Nombre)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Telefono)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Usuario)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("Usuario");

            entity.HasOne(d => d.IdEstadoNavigation).WithMany(p => p.Usuarios)
                .HasForeignKey(d => d.IdEstado)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Usuarios_EstadosUsuarios");

            entity.HasOne(d => d.IdRolNavigation).WithMany(p => p.Usuarios)
                .HasForeignKey(d => d.IdRol)
                .HasConstraintName("FK_Usuarios_Roles");
        });

        modelBuilder.Entity<UsuariosLocal>(entity =>
        {
            entity.ToTable("Usuarios_Locals");

            entity.HasOne(d => d.IdLocalNavigation).WithMany(p => p.UsuariosLocals)
                .HasForeignKey(d => d.IdLocal)
                .HasConstraintName("FK_Usuarios_Locals_Locals");
        });

        modelBuilder.Entity<UsuariosUnidadesNegocio>(entity =>
        {
            entity.ToTable("Usuarios_UnidadesNegocio");

            entity.HasOne(d => d.IdUnidadNegocioNavigation).WithMany(p => p.UsuariosUnidadesNegocios)
                .HasForeignKey(d => d.IdUnidadNegocio)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_Usuarios_UnidadesNegocio_Unidades_Negocio");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
