using System.IO.Compression;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SistemaKyoGroup.Application.Configuration;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;

var builder = WebApplication.CreateBuilder(args);

Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

builder.Services.AddMemoryCache();
// Solo Gzip: Brotli venía con Content-Encoding: br inválido → ERR_CONTENT_DECODING_FAILED en Chrome
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Clear();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.AddControllersWithViews()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        o.JsonSerializerOptions.PropertyNamingPolicy = null;
    });

builder.Services.AddDbContextPool<SistemaKyoGroupContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SistemaDB")));

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddRazorPages().AddRazorRuntimeCompilation();
}
else
{
    builder.Services.AddRazorPages();
}

// Registrar repositorios y servicios
builder.Services.AddScoped<IUsuariosRepository<User>, UsuariosRepository>();
builder.Services.AddScoped<IUsuariosService, UsuariosService>();

builder.Services.AddScoped<IEstadosUsuariosRepository<EstadosUsuario>, EstadosUsuariosRepository>();
builder.Services.AddScoped<IEstadosUsuariosService, EstadosUsuariosService>();

builder.Services.AddScoped<IRolesRepository<Rol>, RolesRepository>();
builder.Services.AddScoped<IRolesService, RolesService>();

builder.Services.AddScoped<ILoginRepository<User>, LoginRepository>();
builder.Services.AddScoped<ILoginService, LoginService>();

builder.Services.AddScoped<ILocalesRepository<Local>, LocalesRepository>();
builder.Services.AddScoped<ILocalesService, LocalesService>();

builder.Services.AddScoped<IUnidadesNegocioRepository<UnidadesNegocio>, UnidadesNegocioRepository>();
builder.Services.AddScoped<IUnidadesNegocioService, UnidadesNegociosService>();

builder.Services.AddScoped<IProveedoresRepository<Proveedor>, ProveedoresRepository>();
builder.Services.AddScoped<IProveedoresService, ProveedoresService>();

builder.Services.AddScoped<IInsumosCategoriaRepository<InsumosCategoria>, InsumosCategoriaRepository>();
builder.Services.AddScoped<IInsumosCategoriaService, InsumosCategoriaService>();

builder.Services.AddScoped<IInsumoRepository<Insumo>, InsumoRepository>();
builder.Services.AddScoped<IInsumoService, InsumoService>();

builder.Services.AddScoped<IProveedoresInsumosRepository<ProveedoresInsumosLista>, ProveedoresInsumosRepository>();
builder.Services.AddScoped<IProveedoresInsumoservice, ProveedoresInsumoservice>();


builder.Services.AddScoped<IUnidadesMedidaRepository<UnidadesMedida>, UnidadesMedidaRepository>();
builder.Services.AddScoped<IUnidadesMedidaService, UnidadesMedidaService>();

builder.Services.AddScoped<IRubrosRepository<Rubro>, RubrosRepository>();
builder.Services.AddScoped<IRubrosService, RubrosService>();

builder.Services.AddScoped<ISubRecetasCategoriaRepository<SubRecetasCategoria>, SubRecetasCategoriaRepository>();
builder.Services.AddScoped<ISubRecetasCategoriaService, SubRecetasCategoriaService>();

builder.Services.AddScoped<ISubRecetaRepository<SubReceta>, SubRecetaRepository>();
builder.Services.AddScoped<ISubRecetaService, SubRecetaService>();

builder.Services.AddScoped<IRecetasCategoriaRepository<RecetasCategoria>, RecetasCategoriaRepository>();
builder.Services.AddScoped<IRecetasCategoriaService, RecetasCategoriaService>();

builder.Services.AddScoped<IRecetaRepository<Receta>, RecetaRepository>();
builder.Services.AddScoped<IRecetaService, RecetaService>();

builder.Services.AddScoped<IOrdenCompraRepository<OrdenesCompra>, OrdenCompraRepository>();
builder.Services.AddScoped<IOrdenCompraService, OrdenCompraService>();


builder.Services.AddScoped<IOrdenesComprasEstadoRepository<OrdenesComprasEstado>, OrdenesComprasEstadoRepository>();
builder.Services.AddScoped<IOrdenesComprasEstadoservice, OrdenesComprasEstadoService>();

builder.Services.AddScoped<IOrdenesComprasInsumoEstadoRepository<OrdenesComprasInsumosEstado>, OrdenesComprasInsumosEstadoRepository>();
builder.Services.AddScoped<IOrdenesComprasInsumosEstadoservice, OrdenesComprasInsumosEstadoService>();

builder.Services.AddScoped<ICompraRepository<Compra>, CompraRepository>();
builder.Services.AddScoped<ICompraService, CompraService>();

builder.Services.AddScoped<IProveedoresCuentaCorrienteRepository, ProveedoresCuentaCorrienteRepository>();
builder.Services.AddScoped<IProveedoresCuentaCorrienteService, ProveedoresCuentaCorrienteService>();
builder.Services.AddScoped<SistemaKyoGroup.DAL.Contracts.IProveedoresCuentaCorrienteCompraSync>(sp =>
    (SistemaKyoGroup.DAL.Contracts.IProveedoresCuentaCorrienteCompraSync)sp.GetRequiredService<IProveedoresCuentaCorrienteService>());

builder.Services.AddScoped<SistemaKyoGroup.DAL.Contracts.ICostoPropagacionService, CostoPropagacionService>();
builder.Services.AddScoped<ICostoPropagacionService, CostoPropagacionService>();
builder.Services.AddScoped<IAnalisisDatosRepository, AnalisisDatosRepository>();
builder.Services.AddScoped<IAnalisisDatosService, AnalisisDatosService>();
builder.Services.AddScoped<IVentasRepository, VentasRepository>();
builder.Services.AddScoped<IVentasService, VentasService>();
builder.Services.AddScoped<ICuentasRepository, CuentasRepository>();
builder.Services.AddScoped<ICuentasService, CuentasService>();

// Tesorería: libro de caja, gastos y sus catálogos
builder.Services.AddScoped<ICajasRepository, CajasRepository>();
builder.Services.AddScoped<ICajasService, CajasService>();
builder.Services.AddScoped<IGastosRepository, GastosRepository>();
builder.Services.AddScoped<IGastosService, GastosService>();
builder.Services.AddScoped<ITesoreriaService, TesoreriaService>();
builder.Services.AddScoped<IGastosCategoriasRepository, GastosCategoriasRepository>();
builder.Services.AddScoped<IGastosCategoriasService, GastosCategoriasService>();
builder.Services.AddScoped<IMediosPagoRepository, MediosPagoRepository>();
builder.Services.AddScoped<IMediosPagoService, MediosPagoService>();
builder.Services.AddScoped<ICuentasTiposRepository, CuentasTiposRepository>();
builder.Services.AddScoped<ICuentasTiposService, CuentasTiposService>();
builder.Services.AddScoped<IUsuariosConexionesRepository, UsuariosConexionesRepository>();
builder.Services.AddScoped<IUsuariosConexionesService, UsuariosConexionesService>();

var sessionSettings = new SessionSettings();
builder.Configuration.GetSection("SessionSettings").Bind(sessionSettings);
if (sessionSettings.GetDuration() <= TimeSpan.Zero)
{
    throw new InvalidOperationException(
        "Configure SessionSettings:DurationHours y/o SessionSettings:DurationMinutes en appsettings.json");
}
builder.Services.AddSingleton(sessionSettings);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:SecretKey"]))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build();
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var ct = context.Response.ContentType;
        if (string.IsNullOrEmpty(ct))
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            return Task.CompletedTask;
        }

        if (!ct.Contains("charset", StringComparison.OrdinalIgnoreCase)
            && (ct.StartsWith("text/html", StringComparison.OrdinalIgnoreCase)
                || ct.StartsWith("text/css", StringComparison.OrdinalIgnoreCase)
                || ct.StartsWith("text/javascript", StringComparison.OrdinalIgnoreCase)
                || ct.StartsWith("application/javascript", StringComparison.OrdinalIgnoreCase)
                || ct.StartsWith("application/json", StringComparison.OrdinalIgnoreCase)))
        {
            context.Response.ContentType = ct + "; charset=utf-8";
        }

        return Task.CompletedTask;
    });

    await next();
});

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Login/Error");
    app.UseHsts();
}

app.UseResponseCompression();
app.UseHttpsRedirection();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        if (ctx.File.Name.EndsWith(".js") || ctx.File.Name.EndsWith(".css"))
        {
            ctx.Context.Response.Headers.CacheControl = "public,max-age=604800";
        }
    }
});

app.UseRouting();

app.UseAuthentication();
app.Use(async (ctx, next) =>
{
    var claim = ctx.User?.FindFirst("Id")?.Value;
    if (int.TryParse(claim, out var uid) && uid > 0)
        EntidadHistorialHelper.SetCurrentUserId(uid);
    await next();
});
app.UseAuthorization();

// Asegura tablas de historial y columnas de Ventas (cada bloque aislado)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<SistemaKyoGroupContext>();
    try { await RecetaHistorialHelper.EnsureTableAsync(db); }
    catch (Exception ex) { Console.WriteLine("RecetaHistorialHelper: " + ex.Message); }
    try { await ProveedoresInsumosHistorialHelper.EnsureTableAsync(db); }
    catch (Exception ex) { Console.WriteLine("ProveedoresInsumosHistorialHelper: " + ex.Message); }
    try { await EntidadHistorialHelper.EnsureAllTablesAsync(db); }
    catch (Exception ex) { Console.WriteLine("EntidadHistorialHelper: " + ex.Message); }
    try { await VentasSchemaHelper.EnsureSchemaAsync(db); }
    catch (Exception ex) { Console.WriteLine("VentasSchemaHelper: " + ex.Message); }
    try { await UsuariosPresenciaSchemaHelper.EnsureSchemaAsync(db); }
    catch (Exception ex) { Console.WriteLine("UsuariosPresenciaSchemaHelper: " + ex.Message); }
    try { await TesoreriaSchemaHelper.EnsureSchemaAsync(db); }
    catch (Exception ex) { Console.WriteLine("TesoreriaSchemaHelper: " + ex.Message); }
}

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Login}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "login",
    pattern: "Login/{action=Index}",
    defaults: new { controller = "Login", action = "Index" });

app.MapGet("/Dashboard", () => Results.Redirect("/Proveedores"));
app.MapGet("/Dashboard/Index", () => Results.Redirect("/Proveedores"));

app.Run();
