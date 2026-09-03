/********************  OrdenesCompras.js (INDEX → patrón SubRecetas)  ********************/
let gridOrdenes;
let isEditing = false;

/* ================== AUTH / FETCH HELPERS ================== */
// Usa "token" global (igual que SubRecetas)
function authHeaders(extra = {}) {
    const t = (typeof token !== 'undefined' && token) ? token : '';
    return t ? { 'Authorization': 'Bearer ' + t, ...extra } : { ...extra };
}
async function fetchJson(url, options = {}) {
    const opts = { ...options, headers: authHeaders(options.headers || {}) };
    const r = await fetch(url, opts);
    if ((r.status === 401 || r.status === 403) && typeof advertenciaModal === 'function') {
        advertenciaModal('Sesión expirada o sin permisos.');
    }
    if (!r.ok) throw new Error(await r.text().catch(() => 'Error HTTP'));
    return await r.json();
}

/* ================== CONFIG DE FILTROS POR COLUMNA ================== */
/* 0 Acciones | 1 Id | 2 N° | 3 F.Emisión | 4 UN | 5 Local | 6 Proveedor | 7 F.Entrega | 8 Estado | 9 Compra | 10 Total | 11 Nota */
const columnConfig = [
    { index: 2, filterType: 'text' },                                          // N°
    { index: 3, filterType: 'text' },                                          // Fecha Emisión
    { index: 4, filterType: 'select', fetchDataFunc: listaUnidadesNegocioFilter }, // UN
    {
        index: 5,
        filterType: 'select',
        dependsOnIndex: 4, // Local según Unidad de negocio del filtro de columna
        fetchDataFunc: (idUN) => listaLocalesFilter(Number(idUN || document.getElementById('UnidadNegocioFiltro')?.value || -1))
    },
    { index: 6, filterType: 'select', fetchDataFunc: listaProveedoresFilter },     // Proveedor
    { index: 7, filterType: 'text' },                                          // Fecha Entrega
    { index: 8, filterType: 'select', fetchDataFunc: listaOrdenesComprasEstadoFilter }, // Estado
    { index: 10, filterType: 'text' },                                          // Costo Total
    { index: 11, filterType: 'text' },                                          // Nota
];

/* ================== FORMATOS / KPIs ================== */
const _num = v => Number(v ?? 0);
const fmtARS = v => new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
}).format(_num(v));
const fmtDec = v => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(_num(v));
const fmtDate = v => {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString('es-AR'); }
    catch { return String(v); }
};
function formatNumber(v) { return fmtDec(v); }

function renderKpis(rows) {
    try {
        const data = Array.isArray(rows) ? rows : [];
        const cant = data.length;
        const tot = data.reduce((a, r) => a + _num(r.CostoTotal), 0);
        const pendientes = data.filter(r => {
            const e = String(r.Estado || r.EstadoNombre || '').toLowerCase();
            return (e.includes('pend')) || (!e.includes('final') && (r.IdEstado ?? 0) > 0);
        }).length;

        const $ = id => document.getElementById(id);
        $('kpiCantidadOC') && ($('kpiCantidadOC').textContent = fmtDec(cant));
        $('kpiTotalOC') && ($('kpiTotalOC').textContent = fmtARS(tot));
        $('kpiPendientesOC') && ($('kpiPendientesOC').textContent = fmtDec(pendientes));
    } catch { /* noop */ }
}

/* ================== TOGGLE FILTROS (panel + thead .filters) ================== */
// Igual que en SubRecetas, pero con claves/ids de Órdenes
const LS_FILTROS_VISIBLE = 'OrdenesCompras_FiltrosVisible';
function setFiltrosState(show) {
    const panel = document.getElementById('formFiltrosOC');
    const icon = document.getElementById('iconFiltrosOC');

    // Mostrar / ocultar SOLO el panel de filtros superior
    if (panel) panel.style.display = show ? 'block' : 'none';

    // Iconito flecha
    if (icon) icon.className = show ? 'fa fa-arrow-up me-2' : 'fa fa-arrow-down me-2';

    // Persistir en localStorage
    localStorage.setItem(LS_FILTROS_VISIBLE, show ? '1' : '0');
}
function initToggleFiltrosOC() {
    const btn = document.getElementById('btnToggleFiltrosOC');
    if (!btn) return;

    // Por defecto: visibles (si no hay nada guardado)
    const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
    setFiltrosState(visible);

    btn.addEventListener('click', () => {
        const now = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
        setFiltrosState(!now);
    });
}
/* ================== INIT ================== */
$(document).ready(async () => {

    // Fechas default: últimos 7 días hasta hoy (como sugeriste)
    try {
        const fd = document.getElementById('FechaDesdeFiltro');
        const fh = document.getElementById('FechaHastaFiltro');
        if (fd && fh && typeof moment !== 'undefined') {
            fd.value = moment().subtract(7, 'days').format('YYYY-MM-DD');
            fh.value = moment().format('YYYY-MM-DD');
        }
    } catch { }

    // Filtros superiores (combos)
    await listaUnidadesNegocioFiltro();   // UN top
    await listaProveedoresFiltro();       // Proveedores top
    await listaEstadosOCFiltro();         // Estados top

    // Local comienza vacío + deshabilitado hasta elegir UN
    prepararLocalTopInicial();

    // Cuando cambia UN → recargar locales top dependientes
    $('#UnidadNegocioFiltro').on('change', async function () {
        const idUN = Number($(this).val() ?? -1);
        await poblarLocalesTop(idUN);
    });

    // Primer listado
    await aplicarFiltrosOC();

    // Toggle filtros (aunque al principio no exista thead.filters, luego se re-aplica)
    initToggleFiltrosOC();
});

/* ================== CRUD (igual a SubRecetas pero para OC) ================== */
function nuevoOrdenCompra() {
    // Navega al NuevoModif (como SubRecetas)
    window.location.href = "/OrdenesCompras/NuevoModif";
}
function editarOrdenCompra(id) {
    window.location.href = '/OrdenesCompras/NuevoModif/' + id;
}
function duplicarOrdenCompra(id) {
    window.location.href = '/OrdenesCompras/NuevoModif?duplicar=' + id;
}

async function eliminarOrdenCompra(id) {
    return eliminarConCascada({
        url: '/OrdenesCompras/Eliminar',
        id,
        confirmMsg: '¿Desea eliminar la Orden de Compra?',
        headers: () => authHeaders(),
        onSuccess: async (j) => {
            await aplicarFiltrosOC();
            exitoModal(j.mensaje || 'Orden eliminada correctamente');
        }
    });
}

/* ================== FILTRO SUPERIOR ================== */
async function aplicarFiltrosOC() {
    const und = Number(document.getElementById("UnidadNegocioFiltro")?.value ?? -1);

    const locSel = document.getElementById("LocalFiltro");
    let loc = -1;
    if (locSel && !locSel.disabled) {
        const val = locSel.value;
        loc = (val === '' || val === '-1') ? -1 : Number(val);
    }

    const prvVal = document.getElementById("ProveedorFiltro")?.value ?? -1;
    const prv = (prvVal === '' || prvVal === '-1') ? -1 : Number(prvVal);

    const estVal = document.getElementById("EstadoFiltro")?.value ?? '';
    const idEstado = (estVal === '' || estVal === '-1') ? null : Number(estVal);

    const fD = document.getElementById("FechaDesdeFiltro")?.value || '';
    const fH = document.getElementById("FechaHastaFiltro")?.value || '';

    await listaOrdenesCompras({
        IdUnidadNegocio: und,
        IdLocal: loc,
        IdProveedor: prv,
        IdEstado: idEstado,
        FechaDesde: fD,
        FechaHasta: fH
    });
}

function limpiarFiltrosOC() {
    const UN = document.getElementById("UnidadNegocioFiltro");
    const PRV = document.getElementById("ProveedorFiltro");
    const EST = document.getElementById("EstadoFiltro");
    const FD = document.getElementById("FechaDesdeFiltro");
    const FH = document.getElementById("FechaHastaFiltro");

    if (UN) UN.value = -1;
    prepararLocalTopInicial(); // vuelve a placeholder y deshabilitado

    if (PRV) PRV.value = -1;
    if (EST) EST.value = '';

    if (FD && typeof moment !== 'undefined') FD.value = moment().subtract(7, 'days').format('YYYY-MM-DD');
    if (FH && typeof moment !== 'undefined') FH.value = moment().format('YYYY-MM-DD');

    aplicarFiltrosOC();
}

/* ================== LISTADO (carga + DataTable) ================== */
async function listaOrdenesCompras(f) {
    const qs = new URLSearchParams();
    if (typeof f?.IdUnidadNegocio !== 'undefined') qs.append('IdUnidadNegocio', String(f.IdUnidadNegocio));
    if (f?.IdLocal && f.IdLocal > 0) qs.append('IdLocal', String(f.IdLocal));
    if (f?.IdProveedor && f.IdProveedor > 0) qs.append('IdProveedor', String(f.IdProveedor));
    if (f?.IdEstado != null && !Number.isNaN(f.IdEstado)) qs.append('IdEstado', String(f.IdEstado));
    if (f?.FechaDesde) qs.append('FechaDesde', f.FechaDesde);
    if (f?.FechaHasta) qs.append('FechaHasta', f.FechaHasta);

    let data = [];
    try {
        // Preferentemente endpoint filtrado
        data = await fetchJson(`/OrdenesCompras/ListaFiltrada?${qs.toString()}`, { headers: authHeaders() });
    } catch {
        // Fallback al viejo Lista (mínimo UN + Estado)
        const qs2 = new URLSearchParams();
        qs2.append('IdUnidadNegocio', String(f?.IdUnidadNegocio ?? -1));
        if (f?.IdEstado != null && !Number.isNaN(f.IdEstado)) qs2.append('IdEstado', String(f.IdEstado));
        data = await fetchJson(`/OrdenesCompras/Lista?${qs2.toString()}`, { headers: authHeaders() });
    }

    renderKpis(data || []);
    await configurarDataTableOC(data || []);
}

async function configurarDataTableOC(data) {
    if (window.ensureKyoExportLibs) await window.ensureKyoExportLibs();
    if (!gridOrdenes) {
        // Clonar fila del thead para filtros por columna (igual que SubRecetas)
        $('#grd_OrdenesCompra thead tr').clone(true).addClass('filters').appendTo('#grd_OrdenesCompra thead');

        gridOrdenes = $('#grd_OrdenesCompra').DataTable({
            data: data,
            language: {
                sLengthMenu: "Mostrar MENU registros",
                lengthMenu: "Anzeigen von _MENU_ Einträge",
                url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json"
            },
            scrollX: false,
            scrollCollapse: true,
            columns: [
                columnaGridAcciones({ editar: 'editarOrdenCompra', duplicar: 'duplicarOrdenCompra', historial: 'verHistorialOrdenCompra', eliminar: 'eliminarOrdenCompra' }),
                columnaGridId(),

                // N° OC con «pill»
                {
                    data: null,
                    title: 'N°',
                    render: r => `<span class="oc-pill-id">${r.Id}</span>`
                },

                // Fecha Emisión
                {
                    data: null,
                    title: 'F. Emisión',
                    render: r => `<span class="oc-fecha-emi">${fmtDate(r.FechaEmision)}</span>`
                },

                // Unidad de Negocio
                {
                    data: null,
                    title: 'Unidad Negocio',
                    render: r => r.UnidadNegocio || r.UnidadNegocioNombre
                },

                // Local
                {
                    data: null,
                    title: 'Local',
                    render: r => r.Local || r.LocalNombre
                },

                // Proveedor
                {
                    data: null,
                    title: 'Proveedor',
                    render: r => r.Proveedor || r.ProveedorNombre
                },

                // Fecha Entrega con color según vencimiento
                {
                    data: null,
                    title: 'F. Entrega',
                    render: function (r) {
                        const txt = fmtDate(r.FechaEntrega);
                        if (!txt) return '—';

                        let cls = 'oc-fecha-entrega';
                        try {
                            const f = new Date(r.FechaEntrega);
                            if (!Number.isNaN(f.getTime())) {
                                const hoy = new Date();
                                hoy.setHours(0, 0, 0, 0);
                                const fd = new Date(f.getFullYear(), f.getMonth(), f.getDate());
                                const diff = (fd - hoy) / 86400000;
                                if (diff < 0) cls += ' oc-fecha-atrasada';
                                else if (diff === 0) cls += ' oc-fecha-hoy';
                                else cls += ' oc-fecha-futura';
                            }
                        } catch { /* ignore */ }

                        return `<span class="${cls}">${txt}</span>`;
                    }
                },

                // Estado con badge tipo «pill»
                {
                    data: null,
                    title: 'Estado',
                    render: function (r) {
                        const txt = (r.Estado || r.EstadoNombre || '').trim();
                        const lower = txt.toLowerCase();
                        let cls = 'oc-estado-default';

                        if (lower.indexOf('pend') >= 0) cls = 'oc-estado-pendiente';
                        else if (lower.indexOf('parc') >= 0 || lower.indexOf('incom') >= 0) cls = 'oc-estado-parcial';
                        else if (lower.indexOf('comp') >= 0 || lower.indexOf('cerr') >= 0 || lower.indexOf('final') >= 0) cls = 'oc-estado-completa';
                        else if (lower.indexOf('canc') >= 0 || lower.indexOf('anul') >= 0) cls = 'oc-estado-cancelada';

                        return `<span class="oc-badge-estado ${cls}">${txt || '-'}</span>`;
                    }
                },

                // Compra (ojito)
                {
                    data: null,
                    title: 'Compra',
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    render: function (data, type, row) {

                        const cantCompras = row.cantCompras ?? row.CantCompras ?? 0;
                        const idCompraPrimera = row.idCompraPrimera ?? row.IdCompraPrimera ?? null;

                        if (cantCompras > 0 && idCompraPrimera) {
                            return `
<button class="btn btn-sm btn-link oc-btn-ojito"
        title="Ver compra asociada"
        onclick="window.location.href='/Compras/NuevoModif?id=${idCompraPrimera}'">
    <i class="fa fa-eye fa-lg"></i>
</button>`;
                        }
                        return '-';
                    }
                },

                // Costo Total con formato
                {
                    data: 'CostoTotal',
                    title: 'Costo Total',
                    render: d => `<span class="oc-monto">${fmtARS(d)}</span>`
                },

                // Nota Interna
                {
                    data: 'NotaInterna',
                    title: 'Nota Interna',
                    render: d => d || ''
                },
            ],



            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'excelHtml5',
                    text: 'Exportar Excel',
                    filename: 'OrdenesCompra',
                    title: '',
                    exportOptions: { columns: ':visible' },
                    className: 'btn-exportar-excel'
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'OrdenesCompra',
                    title: '',
                    exportOptions: { columns: ':visible' },
                    className: 'btn-exportar-pdf'
                },
                {
                    extend: 'print',
                    text: 'Imprimir',
                    title: '',
                    exportOptions: { columns: ':visible' },
                    className: 'btn-exportar-print'
                },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: false,

            initComplete: async function () {
                const api = this.api();

                await kyoBindColumnFilters(api, {
                    columns: columnConfig,
                    skipIndexes: [0]
                });

                configurarOpcionesColumnasOC();

                setTimeout(() => gridOrdenes.columns.adjust(), 10);

                $('#grd_OrdenesCompra tbody').on('dblclick', 'tr', function () {
                    const id = gridOrdenes.row(this).data()?.Id;
                    if (id) editarOrdenCompra(id);
                });

                // Reaplicar toggle ahora que existe thead.filters
                const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
                setFiltrosState(visible);
            },
        });

    } else {
        gridOrdenes.clear().rows.add(data).draw();
        renderKpis(data || []);
        const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
        setFiltrosState(visible);
    }
}

/* ================== CONFIGURAR OPCIONES COLUMNAS ================== */
function configurarOpcionesColumnasOC() {
    initGridColumnConfig({
        gridSelector: '#grd_OrdenesCompra',
        menuSelector: '#configColumnasMenuOC',
        storageKey: 'OrdenesCompras_Columnas',
        skipColumn: (_col, index) => index === 0,
    });
}

/* ================== LISTAS PARA COMBOS (selects de filtros y modal) ================== */
async function listaUnidadesNegocioFilter() {
    const data = await fetchJson(`/UnidadesNegocio/ListaUsuario`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaLocalesFilter(idUnidadNegocio = -1) {
    const mapLocal = (x) => ({
        Id: x.Id,
        Nombre: x.Nombre,
        IdUnidadNegocio: x.IdUnidadNegocio ?? x.IdCombo
    });

    // Sin UN: todos los locales. Con UN: solo los de esa unidad.
    if (!(Number(idUnidadNegocio) > 0)) {
        const data = await fetchJson(`/Locales/Lista`, { headers: authHeaders() });
        return (data || []).map(mapLocal);
    }

    try {
        const data = await fetchJson(`/Locales/ListaPorUnidad?IdUnidadNegocio=${idUnidadNegocio}`, { headers: authHeaders() });
        return (data || []).map(mapLocal);
    } catch {
        const data = await fetchJson(`/Locales/Lista`, { headers: authHeaders() });
        const arr = (data || []).map(mapLocal);
        return arr.filter(x => Number(x.IdUnidadNegocio ?? -999) === Number(idUnidadNegocio));
    }
}
async function listaProveedoresFilter() {
    const data = await fetchJson(`/Proveedores/Lista`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaOrdenesComprasEstadoFilter() {
    const data = await fetchJson(`/OrdenesComprasEstado/Lista`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}

/* ===== Combos MODAL (si los usás) ===== */
async function listaUnidadesNegocio() {
    const data = await listaUnidadesNegocioFilter();
    const select = document.getElementById("UnidadesNegocioOC");
    if (!select) return;
    select.innerHTML = '';
    data.forEach(d => {
        const option = document.createElement("option");
        option.value = d.Id; option.text = d.Nombre; select.appendChild(option);
    });
}
async function listaLocales() {
    const idUN = Number(document.getElementById('UnidadesNegocioOC')?.value ?? -1);
    const data = await listaLocalesFilter(idUN);
    const select = document.getElementById("LocalesOC");
    if (!select) return;
    select.innerHTML = '';
    data.forEach(d => {
        const option = document.createElement("option");
        option.value = d.Id; option.text = d.Nombre; select.appendChild(option);
    });
}
async function listaProveedores() {
    const data = await listaProveedoresFilter();
    const select = document.getElementById("ProveedoresOC");
    if (!select) return;
    select.innerHTML = '';
    data.forEach(d => {
        const option = document.createElement("option");
        option.value = d.Id; option.text = d.Nombre; select.appendChild(option);
    });
}
async function listaEstadosOC() {
    const data = await listaOrdenesComprasEstadoFilter();
    const select = document.getElementById("EstadosOC");
    if (!select) return;
    select.innerHTML = '';
    data.forEach(d => {
        const option = document.createElement("option");
        option.value = d.Id; option.text = d.Nombre; select.appendChild(option);
    });
}

/* ===== Filtros superiores (Top) ===== */
async function listaEstadosOCFiltro() {
    const data = await listaOrdenesComprasEstadoFilter();
    const select = document.getElementById("EstadoFiltro");
    if (!select) return;
    select.innerHTML = '';
    const opt = document.createElement("option");
    opt.value = ''; opt.text = "-";
    select.appendChild(opt);
    data.forEach(d => {
        const o = document.createElement("option");
        o.value = d.Id; o.text = d.Nombre; select.appendChild(o);
    });
}
async function listaUnidadesNegocioFiltro() {
    const data = await listaUnidadesNegocioFilter();
    const select = document.getElementById("UnidadNegocioFiltro");
    if (!select) return;
    select.innerHTML = '';
    const option = document.createElement("option");
    option.value = -1; option.text = "-"; select.appendChild(option);
    data.forEach(d => {
        const o = document.createElement("option");
        o.value = d.Id; o.text = d.Nombre; select.appendChild(o);
    });
}
async function listaProveedoresFiltro() {
    const data = await listaProveedoresFilter();
    const select = document.getElementById("ProveedorFiltro");
    if (!select) return;
    select.innerHTML = '';
    const opt = document.createElement('option'); opt.value = -1; opt.text = '-';
    select.appendChild(opt);
    data.forEach(d => {
        const o = document.createElement('option');
        o.value = d.Id; o.text = d.Nombre; select.appendChild(o);
    });
}

/* ===== Local (top) → VACÍO y DESHABILITADO hasta elegir UN ===== */
function prepararLocalTopInicial() {
    const select = document.getElementById("LocalFiltro");
    if (!select) return;
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.text = '— seleccione unidad —';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    select.disabled = true;
}
async function poblarLocalesTop(idUnidadNegocio = -1) {
    const select = document.getElementById("LocalFiltro");
    if (!select) return;

    if (!(idUnidadNegocio > 0)) {
        prepararLocalTopInicial();
        return;
    }

    select.disabled = false;
    select.innerHTML = '';
    const dash = document.createElement('option'); dash.value = -1; dash.text = '-';
    select.appendChild(dash);

    const data = await listaLocalesFilter(idUnidadNegocio);
    data.forEach(d => {
        const o = document.createElement('option');
        o.value = d.Id; o.text = d.Nombre;
        select.appendChild(o);
    });

    select.value = -1;
}

/* ===== Stub para el botón Guardar del modal rápido (para que no rompa) ===== */
function guardarCambiosOC() {
    return withBusy("#btnGuardarOC", () => {
        advertenciaModal('La edición rápida por este modal aún no está implementada. Usá el botón "Editar" en la grilla.');
    });
}
/********************  FIN OrdenesCompras.js  ********************/


function irACompra(idCompra) {
    if (!idCompra || idCompra <= 0) return;
    window.location.href = `/Compras/NuevoModif?id=${idCompra}`;
}
