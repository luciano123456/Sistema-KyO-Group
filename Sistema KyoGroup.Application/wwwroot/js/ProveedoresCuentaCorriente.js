/* ============================================================================
 * ProveedoresCuentaCorriente.js — Vista master-detail global CC
 * ============================================================================ */

let pccGridMovimientos = null;
let pccProveedorSeleccionado = null;
let pccListaCache = [];

const pccToken = () => localStorage.getItem('JwtToken') || (typeof token !== 'undefined' ? token : '');

function pccAuthHeaders(extra = {}) {
    const t = pccToken();
    return t
        ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json', ...extra }
        : { 'Content-Type': 'application/json', ...extra };
}

async function pccFetchJson(url, options = {}) {
    const res = await fetch(url, { ...options, headers: pccAuthHeaders(options.headers || {}) });
    if (!res.ok) {
        let msg = res.statusText;
        try { const j = await res.json(); msg = j?.mensaje || msg; } catch { /* ignore */ }
        throw new Error(msg);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
}

const pccFmtMoney = v => {
    const n = Number(v ?? 0);
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);
};

const pccFmtDate = v => {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString('es-AR'); }
    catch { return String(v); }
};

function pccSaldoClass(saldo) {
    const n = Number(saldo ?? 0);
    if (n > 0) return 'positivo';
    if (n < 0) return 'negativo';
    return 'cero';
}

/* ===================== Init ===================== */
$(document).ready(function () {
    pccCargarProveedores();

    let debounceTimer;
    document.getElementById('pccBuscar')?.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(pccCargarProveedores, 350);
    });

    document.getElementById('pccSoloConSaldo')?.addEventListener('change', pccCargarProveedores);
});

/* ===================== Master: proveedores ===================== */
async function pccCargarProveedores() {
    const buscar = document.getElementById('pccBuscar')?.value?.trim() || '';
    const soloConSaldo = document.getElementById('pccSoloConSaldo')?.checked || false;
    const params = new URLSearchParams();
    if (buscar) params.set('buscar', buscar);
    if (soloConSaldo) params.set('soloConSaldo', 'true');

    const container = document.getElementById('pccListaProveedores');
    if (!container) return;

    try {
        const data = await pccFetchJson(`/ProveedoresCuentaCorriente/Proveedores?${params}`);
        pccListaCache = data || [];
        pccRenderListaProveedores(pccListaCache);

        if (pccProveedorSeleccionado) {
            const still = pccListaCache.find(p => p.Id === pccProveedorSeleccionado);
            if (still) pccSeleccionarProveedor(still.Id, still.Nombre, still.Saldo, false);
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="pg-cc-empty text-danger p-3 text-center">Error al cargar proveedores.</div>';
    }
}

function pccRenderListaProveedores(lista) {
    const container = document.getElementById('pccListaProveedores');
    if (!container) return;

    if (!lista.length) {
        container.innerHTML = '<div class="pg-cc-empty text-muted-cc p-3 text-center">Sin resultados.</div>';
        return;
    }

    container.innerHTML = lista.map(p => {
        const active = pccProveedorSeleccionado === p.Id ? ' is-active' : '';
        const cuit = p.Cuit ? `<div class="pg-cc-cuit">${pccHtml(p.Cuit)}</div>` : '';
        return `
            <div class="pg-cc-proveedor-item${active}" data-id="${p.Id}" data-nombre="${pccAttr(p.Nombre)}" data-saldo="${p.Saldo ?? 0}">
                <div>
                    <div class="pg-cc-nombre">${pccHtml(p.Nombre)}</div>
                    ${cuit}
                </div>
                <div class="pg-cc-saldo ${pccSaldoClass(p.Saldo)}">${pccFmtMoney(p.Saldo)}</div>
            </div>`;
    }).join('');

    container.querySelectorAll('.pg-cc-proveedor-item').forEach(el => {
        el.addEventListener('click', () => {
            pccSeleccionarProveedor(
                Number(el.dataset.id),
                el.dataset.nombre || '',
                Number(el.dataset.saldo || 0)
            );
        });
    });
}

function pccHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function pccAttr(str) {
    return pccHtml(str);
}

function pccSeleccionarProveedor(id, nombre, saldo, recargar = true) {
    pccProveedorSeleccionado = id;

    document.querySelectorAll('.pg-cc-proveedor-item').forEach(el => {
        el.classList.toggle('is-active', Number(el.dataset.id) === id);
    });

    document.getElementById('pccDetalleTitulo').textContent = nombre || 'Proveedor';
    document.getElementById('pccKpiProveedor').textContent = nombre || '—';

    if (recargar) pccCargarMovimientos();
    else {
        const kpiSaldo = document.getElementById('pccKpiSaldoActual');
        if (kpiSaldo) kpiSaldo.textContent = pccFmtMoney(saldo);
    }
}

/* ===================== Detail: movimientos + KPIs ===================== */
async function pccCargarMovimientos() {
    const id = pccProveedorSeleccionado;
    if (!id) {
        advertenciaModal('Seleccione un proveedor.');
        return;
    }

    const params = new URLSearchParams({ idProveedor: id });
    const fd = document.getElementById('pccFechaDesde')?.value;
    const fh = document.getElementById('pccFechaHasta')?.value;
    const tipo = document.getElementById('pccTipoMov')?.value;
    if (fd) params.set('fechaDesde', fd);
    if (fh) params.set('fechaHasta', fh);
    if (tipo) params.set('tipoMov', tipo);

    try {
        const [movs, resumen] = await Promise.all([
            pccFetchJson(`/ProveedoresCuentaCorriente/Movimientos?${params}`),
            pccFetchJson(`/ProveedoresCuentaCorriente/Resumen?${params}`)
        ]);

        pccActualizarKpis(resumen);
        pccConfigGridMovimientos(movs || []);
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los movimientos.');
    }
}

function pccActualizarKpis(r) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = pccFmtMoney(val); };
    set('pccKpiSaldoAnterior', r?.SaldoAnterior);
    set('pccKpiDebe', r?.Debe);
    set('pccKpiHaber', r?.Haber);
    set('pccKpiSaldoActual', r?.SaldoActual);
}

function pccConSaldoAcumulado(rows) {
    const list = Array.isArray(rows) ? rows.slice() : [];
    list.sort((a, b) => {
        const da = new Date(a.Fecha || 0).getTime();
        const db = new Date(b.Fecha || 0).getTime();
        if (da !== db) return da - db;
        return Number(a.Id || 0) - Number(b.Id || 0);
    });
    let saldo = 0;
    return list.map(m => {
        saldo += Number(m.Debe || 0) - Number(m.Haber || 0);
        return { ...m, Saldo: saldo };
    });
}

function pccRenderDebe(d, t) {
    if (t !== 'display') return d;
    const n = Number(d || 0);
    if (!n) return `<span class="cc-amt cc-amt--muted">${pccFmtMoney(0)}</span>`;
    return `<span class="cc-amt cc-amt--debe">${pccFmtMoney(n)}</span>`;
}

function pccRenderHaber(d, t) {
    if (t !== 'display') return d;
    const n = Number(d || 0);
    if (!n) return `<span class="cc-amt cc-amt--muted">${pccFmtMoney(0)}</span>`;
    return `<span class="cc-amt cc-amt--haber">${pccFmtMoney(n)}</span>`;
}

function pccRenderSaldo(d, t) {
    if (t !== 'display') return d;
    const n = Number(d || 0);
    const cls = n > 0 ? 'is-positivo' : (n < 0 ? 'is-negativo' : '');
    return `<span class="cc-amt cc-amt--saldo ${cls}">${pccFmtMoney(n)}</span>`;
}

function pccConfigGridMovimientos(data) {
    const rows = pccConSaldoAcumulado(data);
    const cols = [
        columnaGridId(),
        { data: 'Fecha', render: (d, t) => t === 'display' ? pccFmtDate(d) : d },
        { data: 'TipoMov' },
        { data: 'Concepto' },
        { data: 'Debe', className: 'text-end', render: pccRenderDebe },
        { data: 'Haber', className: 'text-end', render: pccRenderHaber },
        { data: 'Saldo', className: 'text-end', render: pccRenderSaldo }
    ];

    if (!pccGridMovimientos) {
        kyoEnsureFilterRow('#grd_PccMovimientos');
        pccGridMovimientos = $('#grd_PccMovimientos').DataTable({
            data: rows,
            language: { url: '//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json' },
            scrollX: false,
            columns: cols,
            order: [[1, 'asc'], [0, 'asc']],
            pageLength: 25,
            orderCellsTop: true,
            initComplete: async function () {
                await kyoBindColumnFilters(this.api(), {
                    columns: [
                        { index: 0, filterType: 'text', placeholder: 'Id…' },
                        { index: 1, filterType: 'text', placeholder: 'Fecha…' },
                        { index: 2, filterType: 'text', placeholder: 'Tipo…' },
                        { index: 3, filterType: 'text', placeholder: 'Concepto…' },
                        { index: 4, filterType: 'text', placeholder: 'Debe…' },
                        { index: 5, filterType: 'text', placeholder: 'Haber…' },
                        { index: 6, filterType: 'text', placeholder: 'Saldo…' }
                    ],
                    skipIndexes: []
                });
            }
        });
    } else {
        if (pccGridMovimientos.columns().count() !== cols.length) {
            pccGridMovimientos.destroy();
            pccGridMovimientos = null;
            $('#grd_PccMovimientos').find('tbody').empty();
            return pccConfigGridMovimientos(data);
        }
        pccGridMovimientos.clear().rows.add(rows).draw();
    }
}
