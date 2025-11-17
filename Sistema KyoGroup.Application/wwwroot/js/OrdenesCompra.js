/********************  OrdenesCompras.js (INDEX — patrón SubRecetas)  ********************/
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
/* 0 Acciones | 1 Nº | 2 F.Emisión | 3 UN | 4 Local | 5 Proveedor | 6 F.Entrega | 7 Estado | 8 Total | 9 Nota */
const columnConfig = [
    { index: 1, filterType: 'text' },                                          // Nº
    { index: 2, filterType: 'text' },                                          // Fecha Emisión
    { index: 3, filterType: 'select', fetchDataFunc: listaUnidadesNegocioFilter }, // UN
    {
        index: 4,
        filterType: 'select',
        // Local por columna: usa UN del filtro superior, si no hay → todos
        fetchDataFunc: () => listaLocalesFilter(Number(document.getElementById('UnidadNegocioFiltro')?.value ?? -1))
    },
    { index: 5, filterType: 'select', fetchDataFunc: listaProveedoresFilter },     // Proveedor
    { index: 6, filterType: 'text' },                                          // Fecha Entrega
    { index: 7, filterType: 'select', fetchDataFunc: listaOrdenesComprasEstadoFilter }, // Estado
    { index: 8, filterType: 'text' },                                          // Costo Total
    { index: 9, filterType: 'text' },                                          // Nota
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
    if (panel) panel.style.display = show ? 'block' : 'none';

    const row = document.querySelector('#grd_OrdenesCompra thead tr.filters');
    if (row) row.style.display = show ? '' : 'none';

    if (icon) icon.className = show ? 'fa fa-arrow-up me-2' : 'fa fa-arrow-down me-2';

    localStorage.setItem(LS_FILTROS_VISIBLE, show ? '1' : '0');
    setTimeout(() => gridOrdenes?.columns?.adjust(), 60);
}
function initToggleFiltrosOC() {
    const btn = document.getElementById('btnToggleFiltrosOC');
    if (!btn) return;
    const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '0') === '1';
    setFiltrosState(visible);
    btn.addEventListener('click', () => {
        const now = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '0') === '1';
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
    document.getElementById('UnidadNegocioFiltro')?.addEventListener('change', async (e) => {
        const idUN = Number(e.target.value ?? -1);
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

async function eliminarOrdenCompra(id) {
    const ok = window.confirm("¿Desea eliminar la Orden de Compra?");
    if (!ok) return;
    try {
        const r = await fetch("/OrdenesCompras/Eliminar?id=" + id, {
            method: "DELETE",
            headers: authHeaders()
        });
        if (!r.ok) throw new Error("Error al eliminar la orden de compra.");
        const j = await r.json();
        if (j.valor) {
            await aplicarFiltrosOC();
            exitoModal(j.mensaje || "Orden eliminada correctamente");
        } else {
            advertenciaModal(j.mensaje || "No se pudo eliminar");
        }
    } catch (e) {
        console.error(e);
    }
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
    if (!gridOrdenes) {
        // Clonar fila del thead para filtros por columna (igual que SubRecetas)
        $('#grd_OrdenesCompra thead tr').clone(true).addClass('filters').appendTo('#grd_OrdenesCompra thead');

        gridOrdenes = $('#grd_OrdenesCompra').DataTable({
            data: data,
            language: {
                sLengthMenu: "Mostrar MENU registros",
                lengthMenu: "Anzeigen von _MENU_ Einträgen",
                url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json"
            },
            scrollX: "100px",
            scrollCollapse: true,
            columns: [
                {
                    data: "Id",
                    title: '',
                    width: "1%",
                    render: function (data) {
                        return `
      <div class="acciones-menu" data-id="${data}">
        <button class='btn btn-sm btnacciones' type='button' title='Acciones'>
          <i class='fa fa-ellipsis-v fa-lg text-white'></i>
        </button>
        <div class="acciones-dropdown" style="display:none">
          <button class='btn btn-sm btneditar' type='button' onclick='editarOrdenCompra(${data})'>
            <i class='fa fa-pencil-square-o text-success'></i> Editar
          </button>
          <button class='btn btn-sm btneliminar' type='button' onclick='eliminarOrdenCompra(${data})'>
            <i class='fa fa-trash-o text-danger'></i> Eliminar
          </button>
        </div>
      </div>`;
                    },
                    orderable: false,
                    searchable: false,
                },
                { data: null, title: 'N°', render: r => r.Id ?? r.Numero ?? '' },
                { data: null, title: 'Fecha Emisión', render: r => fmtDate(r.FechaEmision) },
                {
                    data: null,
                    title: 'Unidad Negocio',
                    render: r => r.UnidadNegocio || r.UnidadNegocioNombre || r.NombreUnidadNegocio || r.IdUnidadNegocio || ''
                },
                {
                    data: null,
                    title: 'Local',
                    render: r => r.Local || r.LocalNombre || r.NombreLocal || r.IdLocal || ''
                },
                {
                    data: null,
                    title: 'Proveedor',
                    render: r => r.Proveedor || r.ProveedorNombre || r.NombreProveedor || r.IdProveedor || ''
                },
                { data: null, title: 'Fecha Entrega', render: r => fmtDate(r.FechaEntrega) },
                {
                    data: null,
                    title: 'Estado',
                    render: r => r.Estado || r.EstadoNombre || r.IdEstado || ''
                },
                { data: 'CostoTotal', title: 'Costo Total', render: d => fmtARS(d) },
                { data: 'NotaInterna', title: 'Nota Interna', render: d => d || '' },
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
            fixedHeader: true,

            initComplete: async function () {
                const api = this.api();

                // Filtros por columna (igual que SubRecetas, usando columnConfig)
                columnConfig.forEach(async (config) => {
                    const cell = $('.filters th').eq(config.index);

                    if (config.filterType === 'select') {
                        const select = $('<select id="filter' + config.index + '"><option value="">Seleccionar</option></select>')
                            .appendTo(cell.empty())
                            .on('change', async function () {
                                const selectedText = $(this).find('option:selected').text();
                                await api.column(config.index)
                                    .search(this.value ? '^' + selectedText + '$' : '', true, false)
                                    .draw();
                            });

                        const lst = await config.fetchDataFunc();
                        lst.forEach(function (item) {
                            select.append(
                                '<option value="' + (item.Id ?? item.id) + '">'
                                + (item.Nombre ?? item.nombre ?? item.text) +
                                '</option>'
                            );
                        });

                    } else if (config.filterType === 'text') {
                        const input = $('<input type="text" placeholder="Buscar..." />')
                            .appendTo(cell.empty())
                            .off('keyup change')
                            .on('keyup change', function (e) {
                                e.stopPropagation();
                                const regexr = '({search})';
                                const cursorPosition = this.selectionStart;
                                api.column(config.index)
                                    .search(
                                        this.value !== ''
                                            ? regexr.replace('{search}', '(((' + this.value + ')))')
                                            : '',
                                        this.value !== '',
                                        this.value === ''
                                    )
                                    .draw();
                                $(this).focus()[0].setSelectionRange(cursorPosition, cursorPosition);
                            });
                    }
                });

                // sin filtro en columna de acciones
                $('.filters th').eq(0).html('');

                configurarOpcionesColumnasOC();

                setTimeout(() => gridOrdenes.columns.adjust(), 10);

                // UX (hover + doble click + selección)
                $('#grd_OrdenesCompra tbody').on('mouseenter', 'tr', function () {
                    $(this).css('cursor', 'pointer');
                });
                $('#grd_OrdenesCompra tbody').on('dblclick', 'tr', function () {
                    const id = gridOrdenes.row(this).data()?.Id;
                    if (id) editarOrdenCompra(id);
                });

                let filaSeleccionada = null;
                $('#grd_OrdenesCompra tbody').on('click', 'tr', function () {
                    if (filaSeleccionada) {
                        $(filaSeleccionada).removeClass('seleccionada');
                        $('td', filaSeleccionada).removeClass('seleccionada');
                    }
                    filaSeleccionada = $(this);
                    $(filaSeleccionada).addClass('seleccionada');
                    $('td', filaSeleccionada).addClass('seleccionada');
                });

                // Reaplicar toggle ahora que existe thead.filters
                const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '0') === '1';
                setFiltrosState(visible);
            },
        });

    } else {
        gridOrdenes.clear().rows.add(data).draw();
        renderKpis(data || []);
        const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '0') === '1';
        setFiltrosState(visible);
    }
}

/* ================== CONFIGURAR OPCIONES COLUMNAS ================== */
function configurarOpcionesColumnasOC() {
    const grid = $('#grd_OrdenesCompra').DataTable();
    const columnas = grid.settings().init().columns;
    const container = $('#configColumnasMenuOC');

    const storageKey = `OrdenesCompras_Columnas`;
    const savedConfig = JSON.parse(localStorage.getItem(storageKey)) || {};

    container.empty();

    columnas.forEach((col, index) => {
        // Ocultamos la primera (acciones) del menú, igual que hacés en SubRecetas
        if (index > 0) {
            const isChecked = savedConfig && savedConfig[`col_${index}`] !== undefined
                ? savedConfig[`col_${index}`]
                : true;
            grid.column(index).visible(isChecked);

            const columnName = col.title || col.data || `Col ${index}`;
            container.append(`
                <li>
                    <label class="dropdown-item">
                        <input type="checkbox" class="toggle-column" data-column="${index}" ${isChecked ? 'checked' : ''}>
                        ${columnName}
                    </label>
                </li>
            `);
        }
    });

    $('.toggle-column').on('change', function () {
        const columnIdx = parseInt($(this).data('column'), 10);
        const isChecked = $(this).is(':checked');
        savedConfig[`col_${columnIdx}`] = isChecked;
        localStorage.setItem(storageKey, JSON.stringify(savedConfig));
        grid.column(columnIdx).visible(isChecked);
        setTimeout(() => grid.columns.adjust(), 40);
    });
}

/* ================== DROPDOWN ACCIONES ================== */
function toggleAcciones(id) {
    const $menu = $(`.acciones-menu[data-id="${id}"] .acciones-dropdown`);
    $('.acciones-dropdown').not($menu).hide();
    $menu.toggle();
}
$(document).on('click', function (e) {
    if (!$(e.target).closest('.acciones-menu').length) $('.acciones-dropdown').hide();
});

/* ================== LISTAS PARA COMBOS (selects de filtros y modal) ================== */
async function listaUnidadesNegocioFilter() {
    const data = await fetchJson(`/UnidadesNegocio/ListaUsuario`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaLocalesFilter(idUnidadNegocio = -1) {
    try {
        const data = await fetchJson(`/Locales/ListaPorUnidad?IdUnidadNegocio=${idUnidadNegocio}`, { headers: authHeaders() });
        return data.map(x => ({ Id: x.Id, Nombre: x.Nombre, IdUnidadNegocio: x.IdUnidadNegocio }));
    } catch {
        const data = await fetchJson(`/Locales/Lista`, { headers: authHeaders() });
        const arr = data.map(x => ({ Id: x.Id, Nombre: x.Nombre, IdUnidadNegocio: x.IdUnidadNegocio }));
        return idUnidadNegocio > 0 ? arr.filter(x => (x.IdUnidadNegocio ?? -999) === idUnidadNegocio) : arr;
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

/* ===== Local (top) — VACÍO y DESHABILITADO hasta elegir UN ===== */
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
    if (typeof advertenciaModal === 'function') {
        advertenciaModal('La edición rápida por este modal aún no está implementada. Usá el botón "Editar" en la grilla.');
    } else {
        alert('La edición rápida aún no está implementada.');
    }
}
/********************  FIN OrdenesCompras.js  ********************/
