(function () {
    'use strict';

    function authHeaders() {
        return { Authorization: 'Bearer ' + (window.token || localStorage.getItem('JwtToken') || '') };
    }
    function money(n) {
        return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
    }

    function vinculoBadge(row) {
        const tipo = (row.TipoVinculo || '').toString();
        const title = 'Producto del Excel = SKU de una receta o insumo del sistema';
        if (tipo === 'Receta' || row.IdReceta) {
            return `<span class="vt-badge-ok" title="${title}">Receta</span>`;
        }
        if (tipo === 'Insumo' || row.IdInsumo) {
            return `<span class="vt-badge-insumo" title="${title}">Insumo</span>`;
        }
        if (row.Matched) {
            return `<span class="vt-badge-ok" title="${title}">Vinculado</span>`;
        }
        return `<span class="vt-badge-miss" title="${title}">Sin vínculo</span>`;
    }

    const id = Number(document.querySelector('[data-id]')?.dataset?.id || 0);

    async function load() {
        if (!id) return;
        const r = await fetch('/Ventas/ObtenerDetalle?id=' + id, { headers: authHeaders() });
        if (!r.ok) {
            errorModal('No se encontró la importación');
            return;
        }
        const d = await r.json();
        const fecha = d.Fecha ? new Date(d.Fecha).toLocaleDateString('es-AR') : '';
        document.getElementById('detTitulo').textContent = `${d.LocalNombre || 'Venta'} · ${fecha}`;
        document.getElementById('detSub').textContent = `Importación #${d.Id || id}`;
        document.getElementById('detVenta').textContent = money(d.TotalVenta);
        document.getElementById('detCosto').textContent = money(d.TotalCosto);
        document.getElementById('detGanancia').textContent = money(d.TotalGanancia);
        const items = d.CantidadItems ?? (d.Lineas || []).length;
        const matched = d.ItemsMatched ?? 0;
        const pct = items ? Math.round(100 * matched / items) : 0;
        document.getElementById('detItems').textContent = String(items);
        document.getElementById('detMatch').textContent = `${matched}/${items} (${pct}%)`;
        document.getElementById('detArchivo').textContent = d.NombreArchivo || '—';
        document.getElementById('detUsuario').textContent = d.UsuarioNombre || '—';
        document.getElementById('detUn').textContent = d.UnidadNegocioNombre || '—';
        document.getElementById('detItemsMeta').textContent = `${items} ítems · ${matched} vinculados (${pct}%)`;

        $('#grd_Detalle').DataTable({
            data: d.Lineas || [],
            pageLength: 50,
            order: [[5, 'desc']],
            language: window.kyoDtLanguageEs || undefined,
            columns: [
                { data: 'Codigo' },
                {
                    data: 'Descripcion',
                    render: (v, t, row) => {
                        if (row.IdReceta) return `<a href="/Recetas/NuevoModif?id=${row.IdReceta}">${v || ''}</a>`;
                        if (row.IdInsumo) return `<a href="/Insumos?sku=${encodeURIComponent(row.Codigo || '')}">${v || ''}</a>`;
                        return v || '';
                    }
                },
                { data: 'Rubro' },
                { data: 'Cantidad' },
                { data: 'PrecioUnitario', render: money },
                { data: 'Subtotal', render: money },
                { data: 'SubtotalCosto', render: money },
                { data: 'Ganancia', render: money },
                {
                    data: 'TipoVinculo',
                    orderable: false,
                    render: (v, t, row) => vinculoBadge(row)
                }
            ]
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btnHistorialDet')?.addEventListener('click', () => {
            if (typeof verHistorialEntidad === 'function') verHistorialEntidad('Importacion', id);
        });
        load();
    });
})();
