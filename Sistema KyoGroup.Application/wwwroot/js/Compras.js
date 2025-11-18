/********************  Compras.js (INDEX — patrón OrdenesCompras)  ********************/
let gridCompras;
let isEditing = false;

/* ================== AUTH / FETCH HELPERS ================== */
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
/* 0 Acciones | 1 Nº | 2 Fecha | 3 UN | 4 Local | 5 Proveedor | 6 O.C. | 7 Subtotal | 8 SubtotalFinal | 9 Nota */
const columnConfig = [
    { index: 1, filterType: 'text' },                                          // Nº
    { index: 2, filterType: 'text' },                                          // Fecha
    { index: 3, filterType: 'select', fetchDataFunc: listaUnidadesNegocioFilter }, // UN
    {
        index: 4,
        filterType: 'select',
        fetchDataFunc: () => listaLocalesFilter(Number(document.getElementById('UnidadNegocioFiltro')?.value ?? -1))
    },
    { index: 5, filterType: 'select', fetchDataFunc: listaProveedoresFilter }, // Proveedor
    { index: 6, filterType: 'text' },                                          // O.C.
    { index: 7, filterType: 'text' },                                          // Subtotal
    { index: 8, filterType: 'text' },                                          // Subtotal Final
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
        const totFinal = data.reduce((a, r) => a + _num(r.SubtotalFinal), 0);

        const $ = id => document.getElementById(id);
        $('kpiCantidadCompras') && ($('kpiCantidadCompras').textContent = fmtDec(cant));
        $('kpiSubtotalFinalCompras') && ($('kpiSubtotalFinalCompras').textContent = fmtARS(totFinal));
        $('kpiPendientesCompras') && ($('kpiPendientesCompras').textContent = '—');
    } catch { /* noop */ }
}

/* ================== TOGGLE FILTROS (panel + thead .filters) ================== */
const LS_FILTROS_VISIBLE = 'Compras_FiltrosVisible';
function setFiltrosState(show) {
    const panel = document.getElementById('formFiltrosCompras');
    const icon = document.getElementById('iconFiltrosCompras');

    if (panel) panel.style.display = show ? 'block' : 'none';
    if (icon) icon.className = show ? 'fa fa-arrow-up me-2' : 'fa fa-arrow-down me-2';

    localStorage.setItem(LS_FILTROS_VISIBLE, show ? '1' : '0');
}
function initToggleFiltrosCompras() {
    const btn = document.getElementById('btnToggleFiltrosCompras');
    if (!btn) return;

    const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
    setFiltrosState(visible);

    btn.addEventListener('click', () => {
        const now = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
        setFiltrosState(!now);
    });
}

/* ================== INIT ================== */
$(document).ready(async () => {

    // Fechas default: últimos 7 días
    try {
        const fd = document.getElementById('FechaDesdeFiltro');
        const fh = document.getElementById('FechaHastaFiltro');
        if (fd && fh && typeof moment !== 'undefined') {
            fd.value = moment().subtract(7, 'days').format('YYYY-MM-DD');
            fh.value = moment().format('YYYY-MM-DD');
        }
    } catch { }

    // Filtros superiores
    await listaUnidadesNegocioFiltro();
    await listaProveedoresFiltro();
    prepararLocalTopInicial();

    document.getElementById('UnidadNegocioFiltro')?.addEventListener('change', async (e) => {
        const idUN = Number(e.target.value ?? -1);
        await poblarLocalesTop(idUN);
    });

    // Primer listado
    await aplicarFiltrosCompras();

    // Toggle filtros
    initToggleFiltrosCompras();
});

/* ================== CRUD ================== */
function nuevaCompra() {
    window.location.href = "/Compras/NuevoModif";
}
function editarCompra(id) {
    window.location.href = '/Compras/NuevoModif/' + id;
}

async function eliminarCompra(id) {
    const ok = window.confirm("¿Desea eliminar la Compra?");
    if (!ok) return;
    try {
        const r = await fetch("/Compras/Eliminar?id=" + id, {
            method: "DELETE",
            headers: authHeaders()
        });
        if (!r.ok) throw new Error("Error al eliminar la compra.");
        const j = await r.json();
        if (j.valor) {
            await aplicarFiltrosCompras();
            exitoModal(j.mensaje || "Compra eliminada correctamente");
        } else {
            advertenciaModal(j.mensaje || "No se pudo eliminar");
        }
    } catch (e) {
        console.error(e);
    }
}

/* ================== VER ORDEN DE COMPRA ================== */
function verOrdenCompra(idOC) {
    if (!idOC) return;
    window.location.href = `/OrdenesCompras/NuevoModif/${idOC}`;
}

/* ================== FILTRO SUPERIOR ================== */
async function aplicarFiltrosCompras() {
    const und = Number(document.getElementById("UnidadNegocioFiltro")?.value ?? -1);

    const locSel = document.getElementById("LocalFiltro");
    let loc = -1;
    if (locSel && !locSel.disabled) {
        const val = locSel.value;
        loc = (val === '' || val === '-1') ? -1 : Number(val);
    }

    const prvSel = document.getElementById("ProveedorFiltro");
    let prv = -1;
    if (prvSel) {
        const val = prvSel.value;
        prv = (val === '' || val === '-1') ? -1 : Number(val);
    }

    const fD = document.getElementById("FechaDesdeFiltro")?.value || '';
    const fH = document.getElementById("FechaHastaFiltro")?.value || '';

    await listaCompras({
        IdUnidadNegocio: und,
        IdLocal: loc,
        IdProveedor: prv,
        FechaDesde: fD,
        FechaHasta: fH
    });
}

function limpiarFiltrosCompras() {
    const UN = document.getElementById("UnidadNegocioFiltro");
    const PRV = document.getElementById("ProveedorFiltro");
    const FD = document.getElementById("FechaDesdeFiltro");
    const FH = document.getElementById("FechaHastaFiltro");

    if (UN) UN.value = -1;
    prepararLocalTopInicial();
    if (PRV) PRV.value = -1;

    if (FD && FH && typeof moment !== 'undefined') {
        FD.value = moment().subtract(7, 'days').format('YYYY-MM-DD');
        FH.value = moment().format('YYYY-MM-DD');
    }

    aplicarFiltrosCompras();
}

/* ================== LISTADO (usa ComprasController.Lista) ================== */
async function listaCompras(f) {
    const qs = new URLSearchParams();
    if (typeof f?.IdUnidadNegocio !== 'undefined') qs.append('IdUnidadNegocio', String(f.IdUnidadNegocio));
    if (f?.IdLocal && f.IdLocal > 0) qs.append('IdLocal', String(f.IdLocal));
    if (f?.IdProveedor && f.IdProveedor > 0) qs.append('IdProveedor', String(f.IdProveedor));
    if (f?.FechaDesde) qs.append('FechaDesde', f.FechaDesde);
    if (f?.FechaHasta) qs.append('FechaHasta', f.FechaHasta);

    let data = [];
    try {
        data = await fetchJson(`/Compras/Lista?${qs.toString()}`, { headers: authHeaders() });
    } catch (e) {
        console.error(e);
    }

    renderKpis(data || []);
    await configurarDataTableCompras(data || []);
}

/* ================== DATATABLE ================== */
async function configurarDataTableCompras(data) {
    if (!gridCompras) {
        $('#grd_Compras thead tr').clone(true).addClass('filters').appendTo('#grd_Compras thead');

        gridCompras = $('#grd_Compras').DataTable({
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
          <button class='btn btn-sm btneditar' type='button' onclick='editarCompra(${data})'>
            <i class='fa fa-pencil-square-o text-success'></i> Editar
          </button>
          <button class='btn btn-sm btneliminar' type='button' onclick='eliminarCompra(${data})'>
            <i class='fa fa-trash-o text-danger'></i> Eliminar
          </button>
        </div>
      </div>`;
                    },
                    orderable: false,
                    searchable: false,
                },
                { data: null, title: 'N°', render: r => r.Id ?? r.Numero ?? '' },
                { data: null, title: 'Fecha', render: r => fmtDate(r.Fecha) },
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
                {
                    data: 'OrdenCompra',
                    title: 'O.C.',
                    render: function (val) {
                        if (val && val > 0) {
                            return `
        <button class="btn btn-sm btn-link"
                title="Ver Orden de Compra"
                onclick="verOrdenCompra(${val})">
          <i class="fa fa-eye text-info fa-lg"></i>
        </button>`;
                        }
                        return "<span class='text-muted'>—</span>";
                    },
                    orderable: false,
                    searchable: false
                },
                {
                    data: null,
                    title: 'Subtotal',
                    render: r => fmtARS(r.Subtotal ?? r.SubtotalFinal ?? 0)
                },
                {
                    data: 'SubtotalFinal',
                    title: 'Subtotal Final',
                    render: d => fmtARS(d)
                },
                { data: 'NotaInterna', title: 'Nota Interna', render: d => d || '' },
            ],

            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'excelHtml5',
                    text: 'Exportar Excel',
                    filename: 'Compras',
                    title: '',
                    exportOptions: { columns: ':visible' },
                    className: 'btn-exportar-excel'
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Compras',
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

                // Filtros por columna
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

                configurarOpcionesColumnasCompras();

                setTimeout(() => gridCompras.columns.adjust(), 10);

                // UX (hover + doble click + selección)
                $('#grd_Compras tbody').on('mouseenter', 'tr', function () {
                    $(this).css('cursor', 'pointer');
                });
                $('#grd_Compras tbody').on('dblclick', 'tr', function () {
                    const id = gridCompras.row(this).data()?.Id;
                    if (id) editarCompra(id);
                });

                let filaSeleccionada = null;
                $('#grd_Compras tbody').on('click', 'tr', function () {
                    if (filaSeleccionada) {
                        $(filaSeleccionada).removeClass('seleccionada');
                        $('td', filaSeleccionada).removeClass('seleccionada');
                    }
                    filaSeleccionada = $(this);
                    $(filaSeleccionada).addClass('seleccionada');
                    $('td', filaSeleccionada).addClass('seleccionada');
                });

                const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '0') === '1';
                setFiltrosState(visible);
            },
        });

    } else {
        gridCompras.clear().rows.add(data).draw();
        renderKpis(data || []);
        const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '0') === '1';
        setFiltrosState(visible);
    }
}

/* ================== CONFIGURAR OPCIONES COLUMNAS ================== */
function configurarOpcionesColumnasCompras() {
    const grid = $('#grd_Compras').DataTable();
    const columnas = grid.settings().init().columns;
    const container = $('#configColumnasMenuCompras');

    const storageKey = `Compras_Columnas`;
    const savedConfig = JSON.parse(localStorage.getItem(storageKey)) || {};

    container.empty();

    columnas.forEach((col, index) => {
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



/* ================== LISTAS PARA COMBOS (selects de filtros) ================== */
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

/* ===== Filtros superiores (Top) ===== */
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



