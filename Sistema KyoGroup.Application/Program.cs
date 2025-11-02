using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.BLL.Service;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.DAL.Repository;
using SistemaKyoGroup.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();


builder.Services.AddDbContext<SistemaKyoGroupContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SistemaDB")));


// Agregar Razor Pages
builder.Services.AddRazorPages().AddRazorRuntimeCompilation();

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

builder.Services.AddScoped<ISubrecetasCategoriaRepository<SubrecetasCategoria>, SubrecetasCategoriaRepository>();
builder.Services.AddScoped<ISubrecetasCategoriaService, SubrecetasCategoriaService>();

builder.Services.AddScoped<ISubrecetaRepository<Subreceta>, SubrecetaRepository>();
builder.Services.AddScoped<ISubrecetaService, SubrecetaService>();

builder.Services.AddScoped<IRecetasCategoriaRepository<RecetasCategoria>, RecetasCategoriaRepository>();
builder.Services.AddScoped<IRecetasCategoriaService, RecetasCategoriaService>();

builder.Services.AddScoped<IRecetaRepository<Receta>, RecetaRepository>();
builder.Services.AddScoped<IRecetaService, RecetaService>();

builder.Services.AddControllersWithViews()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        o.JsonSerializerOptions.PropertyNamingPolicy = null;
    });



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

// Definir el esquema de autenticación predeterminado
builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build();
});



var app = builder.Build();

// Configurar el pipeline de middleware
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Clientes/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();


app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Login}/{action=Index}/{id?}");

// Asegúrate de que las rutas de login estén excluidas del middleware de autenticación
app.MapControllerRoute(
    name: "login",
    pattern: "Login/{action=Index}",
    defaults: new { controller = "Login", action = "Index" });
app.Run();
    