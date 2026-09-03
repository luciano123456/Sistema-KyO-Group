let gridVentas;

function money(n) {
    return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function authHeaders() {
    return { Authorization: 'Bearer ' + (window.token || localStorage.getItem('JwtToken') || '') };
}

function verVenta(id) {
    window.location.href = '/Ventas/Detalle?id=' + id;
}

function verHistorialVenta(id) {
    if (typeof verHistorialEntidad === 'function') verHistorialEntidad('Importacion', id);
}

async function eliminarVenta(id) {
    const ok = await confirmarModal('¿Eliminar esta importación de ventas?', {
        title: 'Eliminar importación',
        okText: 'Sí, eliminar',
        cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
        const r = await fetch('/Ventas/Eliminar', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ Id: id })
        });
        const d = await r.json();
        if (d.valor) {
            kyoGridReload(gridVentas);
            cargarKpis();
            exitoModal('Importación eliminada correctamente.');
        } else {
            errorModal('No se pudo eliminar la importación.');
        }
    } catch (e) {
        errorModal(e.message || 'No se pudo eliminar la importación.');
    }
}

async function cargarLocalesFiltro() {
    const sel = document.getElementById('fltLocal');
    if (!sel) return;
    try {
        const r = await fetch('/Locales/Lista', { headers: authHeaders() });
        if (!r.ok) return;
        const data = await r.json();
        (data || []).forEach(l => {
            const o = document.createElement('option');
            o.value = l.Id;
            o.textContent = l.Nombre;
            sel.appendChild(o);
        });
    } catch { /* ignore */ }
}

async function cargarKpis() {
    const p = new URLSearchParams();
    if (fltDesde.value) p.set('fechaDesde', fltDesde.value);
    if (fltHasta.value) p.set('fechaHasta', fltHasta.value);
    const r = await fetch('/Ventas/Kpis?' + p.toString(), { headers: authHeaders() });
    if (!r.ok) return;
    const d = await r.json();
    document.getElementById('kpiImportaciones').textContent = d.Importaciones ?? 0;
    document.getElementById('kpiVenta').textContent = money(d.VentaPeriodo);
    document.getElementById('kpiLocales').textContent = d.LocalesCargados ?? 0;
    document.getElementById('kpiSinMatch').textContent = d.ItemsSinMatch ?? 0;
}

async function initVentasGrid() {
    gridVentas = $('#grd_Ventas').DataTable({
        processing: true,
        serverSide: true,
        searching: true,
        order: [[2, 'desc']],
        pageLength: 25,
        language: window.kyoDtLanguageEs || undefined,
        columnDefs: columnDefsGridLista(),
        kyoColumnFilterSkip: [0],
        ajax: kyoServerGridAjax('/Ventas/ListaPaginada', () => ({
            fechaDesde: fltDesde.value || '',
            fechaHasta: fltHasta.value || '',
            idLocal: fltLocal.value || 0
        })),
        columns: [
            columnaGridAcciones({ ver: 'verVenta', historial: 'verHistorialVenta', eliminar: 'eliminarVenta' }),
            columnaGridId(),
            {
                data: 'Fecha', render: v => {
                    if (!v) return '';
                    const d = new Date(v);
                    return isNaN(d) ? v : d.toLocaleDateString('es-AR');
                }
            },
            { data: 'LocalNombre' },
            { data: 'UnidadNegocioNombre' },
            { data: 'TotalVenta', render: money },
            { data: 'TotalCosto', render: money },
            { data: 'UsuarioNombre' }
        ],
        initComplete: function () {
            const api = this.api();
            setTimeout(() => {
                try { api.columns.adjust().draw(false); } catch (e) { /* ignore */ }
            }, 50);
        }
    });
}

$(document).ready(async () => {
    const vf = window.kyoVentasFiltros;
    await cargarLocalesFiltro();

    if (vf) vf.applyToDom(vf.load());
    else {
        const hoy = new Date();
        const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fltDesde.value = desde.toISOString().slice(0, 10);
        fltHasta.value = hoy.toISOString().slice(0, 10);
    }

    await cargarKpis();
    await initVentasGrid();

    if (vf) {
        // Guarda al cambiar; al Filtrar también (ver handler abajo)
        [fltDesde, fltHasta, fltLocal].forEach(el => {
            if (!el) return;
            el.addEventListener('change', () => vf.persistFromDom());
        });
    }

    $('#btnFiltrar').on('click', () => {
        if (vf) vf.persistFromDom();
        cargarKpis();
        kyoGridReload(gridVentas);
    });
});
