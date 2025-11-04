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
    { index: 1, filterType: 'text' },                                   // Descripción
    { index: 2, filterType: 'text' },                                   // SKU
    { index: 3, filterType: 'select', fetchDataFunc: listaUnidadesNegocioFilter }, // Unidad Negocio
    { index: 4, filterType: 'select', fetchDataFunc: listaUnidadesMedidaFilter },  // Unidad Medida
    { index: 5, filterType: 'select', fetchDataFunc: listaSubRecetasCategoriaFilter }, // Categoría
    { index: 6, filterType: 'text' },                                   // Costo SubRecetas
    { index: 7, filterType: 'text' },                                   // Costo Insumos
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
    const row = document.querySelector('#grd_SubRecetas thead tr.filters');
    if (row) row.style.display = show ? '' : 'none';
    if (icon) icon.className = show ? 'fa fa-arrow-up me-2' : 'fa fa-arrow-down me-2';
    localStorage.setItem(LS_FILTROS_VISIBLE, show ? '1' : '0');
    setTimeout(() => gridSubRecetas?.columns?.adjust(), 60);
}
function initToggleFiltrosI() {
    const btn = document.getElementById('btnToggleFiltrosI');
    if (!btn) return;
    const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '0') === '1';
    setFiltrosState(visible);
    btn.addEventListener('click', () => {
        const now = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '0') === '1';
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
    if (validarCampos()) {
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

        fetch(url, {
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
    } else {
        errorModal('Debes completar los campos requeridos');
    }
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

async function eliminarSubReceta(id) {
    let resultado = window.confirm("¿Desea eliminar la SubReceta?");
    if (!resultado) return;

    try {
        const response = await fetch("/SubRecetas/Eliminar?id=" + id, { method: "DELETE", headers: authHeaders() });
        if (!response.ok) throw new Error("Error al eliminar la SubReceta.");
        const dataJson = await response.json();
        if (dataJson.valor) { aplicarFiltros(); exitoModal(dataJson.mensaje); }
        else { advertenciaModal(dataJson.mensaje); }
    } catch (error) { console.error("Ha ocurrido un error:", error); }
}

async function configurarDataTable(data) {
    if (!gridSubRecetas) {
        // Clonar fila de filtros por columna
        $('#grd_SubRecetas thead tr').clone(true).addClass('filters').appendTo('#grd_SubRecetas thead');

        gridSubRecetas = $('#grd_SubRecetas').DataTable({
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
          <button class='btn btn-sm btneditar' type='button' onclick='editarSubReceta(${data})'>
            <i class='fa fa-pencil-square-o text-success'></i> Editar
          </button>
          <button class='btn btn-sm btneliminar' type='button' onclick='eliminarSubReceta(${data})'>
            <i class='fa fa-trash-o text-danger'></i> Eliminar
          </button>
        </div>
      </div>`;
                    },
                    orderable: false,
                    searchable: false,
                },
                { data: 'Descripcion', title: 'Descripción' },
                { data: 'Sku', title: 'SKU' },
                { data: 'UnidadNegocio', title: 'Unidad Negocio' },
                { data: 'UnidadMedida', title: 'Unidad Medida' },
                { data: 'Categoria', title: 'Categoría' },
                { data: 'CostoSubRecetas', title: 'Costo SubRecetas' },
                { data: 'CostoInsumos', title: 'Costo Insumos' },
            ],

            dom: 'Bfrtip',
            buttons: [
                { extend: 'excelHtml5', text: 'Exportar Excel', filename: 'Reporte SubRecetas', title: '', exportOptions: { columns: ':visible' }, className: 'btn-exportar-excel' },
                { extend: 'pdfHtml5', text: 'Exportar PDF', filename: 'Reporte SubRecetas', title: '', exportOptions: { columns: ':visible' }, className: 'btn-exportar-pdf' },
                { extend: 'print', text: 'Imprimir', title: '', exportOptions: { columns: ':visible' }, className: 'btn-exportar-print' },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: true,
            columnDefs: [
                { targets: [6, 7], render: function (d) { return fmtARS(d); } },
            ],

            initComplete: async function () {
                var api = this.api();

                // Filtros por columna
                columnConfig.forEach(async (config) => {
                    var cell = $('.filters th').eq(config.index);

                    if (config.filterType === 'select') {
                        var select = $('<select id="filter' + config.index + '"><option value="">Seleccionar</option></select>')
                            .appendTo(cell.empty())
                            .on('change', async function () {
                                var selectedText = $(this).find('option:selected').text();
                                await api.column(config.index).search(this.value ? '^' + selectedText + '$' : '', true, false).draw();
                            });

                        var lst = await config.fetchDataFunc();
                        lst.forEach(function (item) {
                            select.append('<option value="' + item.Id + '">' + item.Nombre + '</option>')
                        });

                    } else if (config.filterType === 'text') {
                        var input = $('<input type="text" placeholder="Buscar..." />')
                            .appendTo(cell.empty())
                            .off('keyup change')
                            .on('keyup change', function (e) {
                                e.stopPropagation();
                                var regexr = '({search})';
                                var cursorPosition = this.selectionStart;
                                api.column(config.index)
                                    .search(this.value !== '' ? regexr.replace('{search}', '(((' + this.value + ')))') : '', this.value !== '', this.value === '')
                                    .draw();
                                $(this).focus()[0].setSelectionRange(cursorPosition, cursorPosition);
                            });
                    }
                });

                // sin filtro en columna de acciones
                $('.filters th').eq(0).html('');

                configurarOpcionesColumnas();

                setTimeout(() => gridSubRecetas.columns.adjust(), 10);

                // UX
                $('#grd_SubRecetas tbody').on('mouseenter', 'tr', function () { $(this).css('cursor', 'pointer'); });

                $('#grd_SubRecetas tbody').on('dblclick', 'tr', function () {
                    var id = gridSubRecetas.row(this).data()?.Id;
                    if (id) editarSubReceta(id);
                });

                let filaSeleccionada = null;
                $('#grd_SubRecetas tbody').on('click', 'tr', function () {
                    if (filaSeleccionada) { $(filaSeleccionada).removeClass('seleccionada'); $('td', filaSeleccionada).removeClass('seleccionada'); }
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
        gridSubRecetas.clear().rows.add(data).draw();
        renderKpis(data || []);
        // asegurar que la visibilidad de filtros quede aplicada también en refresh
        const visible = (localStorage.getItem(LS_FILTROS_VISIBLE) ?? '0') === '1';
        setFiltrosState(visible);
    }
}

/* ================== CONFIGURAR OPCIONES COLUMNAS ================== */
function configurarOpcionesColumnas() {
    const grid = $('#grd_SubRecetas').DataTable();
    const columnas = grid.settings().init().columns;
    const container = $('#configColumnasMenu');

    const storageKey = `SubRecetas_Columnas`;
    const savedConfig = JSON.parse(localStorage.getItem(storageKey)) || {};

    container.empty();

    columnas.forEach((col, index) => {
        if (col.data && col.data !== "Id") {
            const isChecked = savedConfig && savedConfig[`col_${index}`] !== undefined ? savedConfig[`col_${index}`] : true;
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
