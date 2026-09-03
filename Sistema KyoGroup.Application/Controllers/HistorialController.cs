using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaKyoGroup.DAL;
using SistemaKyoGroup.DAL.DataContext;

namespace SistemaKyoGroup.Application.Controllers;

[Authorize]
[Route("[controller]/[action]")]
public class HistorialController : Controller
{
    private readonly SistemaKyoGroupContext _db;

    public HistorialController(SistemaKyoGroupContext db)
    {
        _db = db;
    }

    /// <summary>GET /Historial/Entidad?tipo=Insumo&amp;id=123</summary>
    [HttpGet]
    public async Task<IActionResult> Entidad(string tipo, int id)
    {
        if (id <= 0)
            return Ok(Array.Empty<object>());

        var key = EntidadHistorialHelper.NormalizarKey(tipo);
        if (key is null)
            return BadRequest(new { mensaje = "Tipo de entidad inválido." });

        var items = await EntidadHistorialHelper.ListarAsync(_db, key, id);
        return Ok(items.Select(h => new
        {
            h.Id,
            h.IdEntidad,
            h.Accion,
            h.Resumen,
            h.Detalle,
            h.IdUsuario,
            h.UsuarioNombre,
            h.Fecha
        }));
    }
}
