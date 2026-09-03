/********************  SubRecetaS.JS (COMPLETO)  ********************/
let gridSubRecetas;
let isEditing = false;

/* ================== AUTH / FETCH HELPERS ================== */
// Usa "token" global (mismo que tus otras pantallas)
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
const columnConfig = [
    { index: 2, filterType: 'text' },                                   // Descripción
    { index: 3, filterType: 'text' },                                   // SKU
    { index: 4, filterType: 'select', fetchDataFunc: listaUnidadesNegocioFilter }, // Unidad Negocio
    { index: 5, filterType: 'select', fetchDataFunc: listaUnidadesMedidaFilter },  // Unidad Medida
    { index: 6, filterType: 'select', fetchDataFunc: listaSubRecetasCategoriaFilter }, // CategorÍa
    { index: 7, filterType: 'text' },                                   // Costo SubRecetas
    { index: 8, filterType: 'text' },                                   // Costo Insumos
];

/* ================== FORMATOS / KPIs ================== */
const _num = v => Number(v ?? 0);
const fmtARS = v => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(_num(v));
const fmtDec = v => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(_num(v));
function formatNumber(v) { return fmtDec(v); }

// KPIs reducidos (Cantidad, Costo SubRecetas, Costo Insumos)
function renderKpis(rows) {
    try {
        const data = Array.isArray(rows) ? rows : [];
        const cant = data.length;
        const totSub = data.reduce((a, r) => a + _num(r.CostoSubRecetas), 0);
        const totIns = data.reduce((a, r) => a + _num(r.CostoInsumos), 0);
        const $ = id => document.getElementById(id);

        $('kpiCantidad').textContent = fmtDec(cant);
        $('kpiCostoSubRecetas').textContent = fmtARS(totSub);
        $('kpiCostoInsumos').textContent = fmtARS(totIns);
    } catch { /* si no existen los elementos, no rompe */ }
}

/* ================== TOGGLE FILTROS (panel + thead .filters) ================== */
// Misma lógica que Proveedores-Insumos: guarda estado y sincroniza icono.
const LS_FILTROS_VISIBLE = 'SubRecetas_FiltrosVisible';
function setFiltrosState(show) {
    const panel = document.getElementById('formFiltrosSubRec');
    const icon = document.getElementById('iconFiltrosI');
    if (panel) panel.style.display = show ? 'block' : 'none';
    // Los filtros por columna del thead siempre visibles
    const row = document.querySelector('#grd_SubRecetas thead tr.filters');
    if (row) row.style.display = '';
    if (icon) icon.className = show ? 'fa fa-arrow-up me-2' : 'fa fa-arrow-down me-2';
    localStorage.setItem(LS_FILTROS_VISIBLE, show ? '1' : '0');
    setTimeout(() => gridSubRecetas?.columns?.adjust(), 60);
}
function initToggleFiltrosI() {
    const btn = document.getElementById('btnToggleFiltrosI');
    if (!btn) return;
    const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
    setFiltrosState(visible);
    btn.addEventListener('click', () => {
        const now = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
        setFiltrosState(!now);
    });
}

/* ================== INIT ================== */
$(document).ready(() => {
    listaUnidadesNegocioFiltro();
    listaSubRecetas(-1);

    $('#txtDescripcion, #txtCostoUnitario, #txtSku').on('input', function () {
        validarCampos()
    });

    // Inicializar toggle (primer render, aunque todavía no exista thead.filters)
    initToggleFiltrosI();
});

/* ================== CRUD ================== */
function guardarCambios() {
    if (!validarCampos()) {
        errorModal('Debes completar los campos requeridos');
        return;
    }

    return withBusy("#btnGuardar", () => {
        const idSubReceta = $("#txtId").val();
        const nuevoModelo = {
            "Id": idSubReceta !== "" ? idSubReceta : 0,
            "Descripcion": $("#txtDescripcion").val(),
            "IdUnidadMedida": $("#UnidadesMedida").val(),
            "IdUnidadNegocio": $("#UnidadesNegocio").val(),
            "IdCategoria": $("#Categorias").val(),
            "Sku": $("#txtSku").val(),
            "CostoUnitario": $("#txtCostoUnitario").val(),
        };

        const url = idSubReceta === "" ? "SubRecetas/Insertar" : "SubRecetas/Actualizar";
        const method = idSubReceta === "" ? "POST" : "PUT";

        return fetch(url, {
            method: method,
            headers: authHeaders({ 'Content-Type': 'application/json;charset=utf-8' }),
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(_ => {
                const mensaje = idSubReceta === "" ? "SubReceta registrado correctamente" : "SubReceta modificado correctamente";
                $('#modalEdicion').modal('hide');
                exitoModal(mensaje);
                aplicarFiltros();
            })
            .catch(error => console.error('Error:', error));
    });
}

function validarCampos() {
    const descripcion = $("#txtDescripcion").val();
    const sku = $("#txtSku").val();
    const costoUnitario = $("#txtCostoUnitario").val();
    const okDesc = descripcion !== "";
    const okSku = sku !== "";
    const okCosto = costoUnitario !== "";

    $("#lblDescripcion").css("color", okDesc ? "" : "red");
    $("#txtDescripcion").css("border-color", okDesc ? "" : "red");
    $("#lblSku").css("color", okSku ? "" : "red");
    $("#txtSku").css("border-color", okSku ? "" : "red");
    $("#lblCostoUnitario").css("color", okCosto ? "" : "red");
    $("#txtCostoUnitario").css("border-color", okCosto ? "" : "red");

    return okDesc && okSku && okCosto;
}

async function nuevoSubReceta() {
    window.location.href = "/SubRecetas/NuevoModif";
}

async function mostrarModal(modelo) {
    const campos = ["Id", "Sku", "CostoUnitario", "Descripcion"];
    campos.forEach(campo => { $(`#txt${campo}`).val(modelo[campo]); });

    listaUnidadesNegocio();
    listaUnidadesMedida();
    listaSubRecetasCategoria();

    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Guardar");
    $("#modalEdicionLabel").text("Editar SubReceta");

    $('#lblDescripcion, #txtDescripcion').css('color', '').css('border-color', '');
    $('#lblSku, #txtSku').css('color', '').css('border-color', '');
    $('#lblCostoUnitario, #txtCostoUnitario').css('color', '').css('border-color', '');
}

function limpiarModal() {
    const campos = ["Id", "Sku", "CostoUnitario", "Descripcion"];
    campos.forEach(campo => { $(`#txt${campo}`).val(""); });

    $('#lblDescripcion, #txtDescripcion').css('color', '').css('border-color', '');
    $('#lblSku, #txtSku').css('color', '').css('border-color', '');
    $('#lblCostoUnitario, #txtCostoUnitario').css('color', '').css('border-color', '');
}

/* ================== FILTRO SUPERIOR ================== */
async function aplicarFiltros() {
    const und = document.getElementById("UnidadNegocioFiltro").value;
    listaSubRecetas(und);
}

/* ================== LISTADO (carga + DT) ================== */
async function listaSubRecetas(IdUnidadNegocio) {
    const url = `/SubRecetas/Lista?IdUnidadNegocio=${IdUnidadNegocio}`;
    const data = await fetchJson(url, { headers: authHeaders() });
    renderKpis(data || []);
    await configurarDataTable(data || []);
}

function editarSubReceta(id) { window.location.href = '/SubRecetas/NuevoModif/' + id; }
function duplicarSubReceta(id) { window.location.href = '/SubRecetas/NuevoModif?duplicar=' + id; }

async function verHistorialSubReceta(id) {
    try {
        const data = await fetchJson(`/SubRecetas/Historial?id=${id}`, { headers: authHeaders() });
        renderHistorialModal(data || [], `Historial SubReceta #${id}`);
    } catch (e) {
        console.error(e);
        errorModal('No se pudo cargar el historial.');
    }
}

async function eliminarSubReceta(id) {
    return eliminarConCascada({
        url: '/SubRecetas/Eliminar',
        id,
        confirmMsg: '¿Desea eliminar la SubReceta?',
        headers: () => authHeaders(),
        onSuccess: async (j) => {
            aplicarFiltros();
            exitoModal(j.mensaje || 'SubReceta eliminada correctamente');
        }
    });
}

async function configurarDataTable(data) {
    if (window.ensureKyoExportLibs) await window.ensureKyoExportLibs();
    if (!gridSubRecetas) {
        // Clonar fila de filtros por columna
        $('#grd_SubRecetas thead tr').clone(true).addClass('filters').appendTo('#grd_SubRecetas thead');

        gridSubRecetas = $('#grd_SubRecetas').DataTable({
            data: data,
            language: {
                sLengthMenu: "Mostrar MENU registros",
                lengthMenu: "Anzeigen von _MENU_ Einträge",
                url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json"
            },
            scrollX: false,
            scrollCollapse: true,
            columns: [
                columnaGridAcciones({ editar: 'editarSubReceta', duplicar: 'duplicarSubReceta', historial: 'verHistorialSubReceta', eliminar: 'eliminarSubReceta' }),
                columnaGridId(),
                { data: 'Descripcion', title: 'Descripción' },
                { data: 'Sku', title: 'SKU' },
                { data: 'UnidadNegocio', title: 'Unidad Negocio' },
                { data: 'UnidadMedida', title: 'Unidad Medida' },
                { data: 'Categoria', title: 'Categoría' },
                { data: 'CostoSubRecetas', title: 'Costo SubRecetas' },
                { data: 'CostoInsumos', title: 'Costo Insumos' },
                {
                    data: 'FechaRegistra', title: 'Creado',
                    render: (d, t, row) => t === 'display'
                        ? `${row.UsuarioRegistra || '—'}<br><small class="text-muted">${d ? new Date(d).toLocaleString('es-AR') : '—'}</small>`
                        : d
                },
                {
                    data: 'FechaModifica', title: 'Últ. modificación',
                    render: (d, t, row) => t === 'display'
                        ? `${row.UsuarioModifica || '—'}<br><small class="text-muted">${d ? new Date(d).toLocaleString('es-AR') : '—'}</small>`
                        : d
                },
            ],

            dom: 'Bfrtip',
            buttons: [
                { extend: 'excelHtml5', text: 'Exportar Excel', filename: 'Reporte SubRecetas', title: '', exportOptions: { columns: ':visible' }, className: 'btn-exportar-excel' },
                { extend: 'pdfHtml5', text: 'Exportar PDF', filename: 'Reporte SubRecetas', title: '', exportOptions: { columns: ':visible' }, className: 'btn-exportar-pdf' },
                { extend: 'print', text: 'Imprimir', title: '', exportOptions: { columns: ':visible' }, className: 'btn-exportar-print' },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: false,
            columnDefs: [
                { targets: [7, 8], render: function (d) { return fmtARS(d); } },
            ],

            initComplete: async function () {
                var api = this.api();

                await kyoBindColumnFilters(api, {
                    columns: columnConfig,
                    skipIndexes: [0]
                });

                configurarOpcionesColumnas();

                setTimeout(() => gridSubRecetas.columns.adjust(), 10);

                $('#grd_SubRecetas tbody').on('dblclick', 'tr', function () {
                    var id = gridSubRecetas.row(this).data()?.Id;
                    if (id) editarSubReceta(id);
                });

                // Reaplicar toggle ahora que existe thead.filters
                const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
                setFiltrosState(visible);
            },
        });

    } else {
        gridSubRecetas.clear().rows.add(data).draw();
        renderKpis(data || []);
        // asegurar que la visibilidad de filtros quede aplicada también en refresh
        const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '1') === '1';
        setFiltrosState(visible);
    }
}

/* ================== CONFIGURAR OPCIONES COLUMNAS ================== */
function configurarOpcionesColumnas() {
    initGridColumnConfig({
        gridSelector: '#grd_SubRecetas',
        menuSelector: '#configColumnasMenu',
        storageKey: 'SubRecetas_Columnas',
    });
}

/* ================== LISTAS PARA COMBOS ================== */
async function listaUnidadesNegocioFilter() {
    const url = `/UnidadesNegocio/ListaUsuario`;
    const data = await fetchJson(url, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaUnidadesMedidaFilter() {
    const url = `/UnidadesMedida/Lista`;
    const data = await fetchJson(url, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaSubRecetasCategoriaFilter() {
    const url = `/SubRecetasCategoria/Lista`;
    const data = await fetchJson(url, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}

async function listaUnidadesNegocio() {
    const data = await listaUnidadesNegocioFilter();
    $('#UnidadesNegocio').empty();
    const select = document.getElementById("UnidadesNegocio");
    data.forEach(d => {
        const option = document.createElement("option");
        option.value = d.Id; option.text = d.Nombre; select.appendChild(option);
    });
}
async function listaUnidadesMedida() {
    const data = await listaUnidadesMedidaFilter();
    $('#UnidadesMedida').empty();
    const select = document.getElementById("UnidadesMedida");
    data.forEach(d => {
        const option = document.createElement("option");
        option.value = d.Id; option.text = d.Nombre; select.appendChild(option);
    });
}
async function listaSubRecetasCategoria() {
    const data = await listaSubRecetasCategoriaFilter();
    $('#Categorias').empty();
    const select = document.getElementById("Categorias");
    data.forEach(d => {
        const option = document.createElement("option");
        option.value = d.Id; option.text = d.Nombre; select.appendChild(option);
    });
}
async function listaUnidadesNegocioFiltro() {
    const data = await listaUnidadesNegocioFilter();
    $('#UnidadNegocioFiltro').empty();
    const select = document.getElementById("UnidadNegocioFiltro");
    const option = document.createElement("option");
    option.value = -1; option.text = "-"; select.appendChild(option);
    data.forEach(d => {
        const o = document.createElement("option");
        o.value = d.Id; o.text = d.Nombre; select.appendChild(o);
    });
}

/********************  FIN SubRecetaS.JS  ********************/
