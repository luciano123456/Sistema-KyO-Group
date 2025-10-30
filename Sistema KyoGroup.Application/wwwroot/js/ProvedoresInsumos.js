﻿/* ============================================================================
 * ProveedoresInsumos.js (FULL)
 * - Estructura de filtros y UX como "Insumos"
 * - Token en TODOS los fetch (Authorization: Bearer ...)
 * - DataTable con filtros por columna + persistencia de columnas
 * - CRUD + Importación desde Excel (comparar / importar)
 * ============================================================================ */

let gridInsumos;
let isEditing = false;

// ========= Config de filtros por columna (thead clonado) =========
const columnConfig = [
    { index: 1, filterType: 'text' }, // Codigo
    { index: 2, filterType: 'text' }, // Descripcion
    { index: 3, filterType: 'text' }, // Costo Unitario
    { index: 4, filterType: 'text' }, // Proveedor
    { index: 5, filterType: 'text' }, // Fecha Actualizacion
];

// ========= Claves de persistencia filtros top =========
const _KEY_PROV_FILTRO = 'ProvIns_Filtro_Proveedor';
const _KEY_BAR_VISIBLE = 'ProvIns_FiltroBar_Visible';

// ========= Helpers numéricos / formato =========
const _num = n => parseFloat(n) || 0;
function formatNumber(n) {
    try {
        const val = _num(n);
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 2,
        }).format(val);
    } catch {
        const v = Math.round(_num(n) * 100) / 100;
        return '$' + v.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    }
}

// ========= KPIs (opcionales: actualiza si existen en el DOM) =========
function actualizarKpisProveedorInsumos(data) {
    const cant = Array.isArray(data) ? data.length : 0;
    const el = document.getElementById('kpiCantItems');
    if (el) el.textContent = cant;
    
}

// ========= INIT principal =========
$(document).ready(() => {
    // Top filtro + primera carga
    bootstrapFiltroProveedor().then(() => aplicarFiltros());

    // Select2 para el select del modal
    $("#Proveedores")
        .select2({
            dropdownParent: $("#modalEdicion"),
            width: "100%",
            placeholder: "Selecciona una opción",
            allowClear: false
        })
        .on('change', function () { validarCampoIndividual(this); })
        .on('select2:close', function () { validarCampoIndividual(this); });

    // Validaciones en vivo
    document.querySelectorAll("#formInsumo input, #formInsumo select, #formInsumo textarea")
        .forEach(el => {
            el.setAttribute("autocomplete", "off");
            el.addEventListener("input", () => validarCampoIndividual(el));
            el.addEventListener("change", () => validarCampoIndividual(el));
            el.addEventListener("blur", () => validarCampoIndividual(el));
        });

    // Dropdown acciones: cerrar al click fuera
    $(document).on('click', (e) => {
        if (!$(e.target).closest('.acciones-menu').length) {
            $('.acciones-dropdown').hide();
        }
    });
});

// ========= Filtros TOP (persistentes y compatibles con tu HTML actual) =========
function ensureOpcionTodosProveedor() {
    const sel = document.getElementById('ProveedorFiltro');
    if (!sel) return;
    const hasTodos = Array.from(sel.options).some(o => String(o.value) === '-1');
    if (!hasTodos) {
        const opt = document.createElement('option');
        opt.value = '-1';
        opt.textContent = 'Todos';
        sel.insertBefore(opt, sel.firstChild);
    }
}

function setProveedorFiltro(value) {
    const sel = document.getElementById('ProveedorFiltro');
    if (!sel) return;
    ensureOpcionTodosProveedor();
    sel.value = String(value);
    if (window.jQuery && $.fn.select2 && $(sel).data('select2')) {
        $(sel).val(String(value)).trigger('change.select2');
    }
    try { localStorage.setItem(_KEY_PROV_FILTRO, String(value)); } catch { }
}

function getProveedorFiltro() {
    const sel = document.getElementById('ProveedorFiltro');
    if (!sel) return -1;
    const v = sel.value ?? '-1';
    const n = Number(v);
    return Number.isFinite(n) ? n : -1;
}

function initFiltroProveedorPersistente() {
    ensureOpcionTodosProveedor();

    // cargar valor guardado
    let saved = -1;
    try {
        const raw = localStorage.getItem(_KEY_PROV_FILTRO);
        if (raw != null && raw !== '') {
            const n = Number(raw);
            if (Number.isFinite(n)) saved = n;
        }
    } catch { }
    setProveedorFiltro(saved);

    // guardar ante cambios
    const sel = document.getElementById('ProveedorFiltro');
    if (sel) {
        sel.addEventListener('change', () => {
            try { localStorage.setItem(_KEY_PROV_FILTRO, String(sel.value ?? '-1')); } catch { }
        });
    }

    // toggle barra filtros (si existe botón/ícono con estos IDs)
    const btn = document.getElementById('btnToggleFiltrosPI');
    const icon = document.getElementById('iconFiltrosPI');

    // soporta #formFiltrosProv (si lo agregás) o el div actual #Filtros
    const bar = document.getElementById('formFiltrosProv') || document.getElementById('Filtros');

    if (btn && bar && icon) {
        let visible = true;
        try {
            const raw = localStorage.getItem(_KEY_BAR_VISIBLE);
            if (raw !== null) visible = raw === '1';
        } catch { }

        bar.classList.toggle('d-none', !visible);
        icon.classList.toggle('fa-arrow-down', visible);
        icon.classList.toggle('fa-arrow-up', !visible);

        btn.addEventListener('click', () => {
            const oculto = bar.classList.toggle('d-none');
            icon.classList.toggle('fa-arrow-down', !oculto);
            icon.classList.toggle('fa-arrow-up', oculto);
            try { localStorage.setItem(_KEY_BAR_VISIBLE, oculto ? '0' : '1'); } catch { }
        });
    }
}

async function bootstrapFiltroProveedor() {
    // Si querés Select2 en el filtro TOP
    if (window.jQuery && $.fn.select2) {
        $('#ProveedorFiltro').select2({ placeholder: 'Proveedor', allowClear: false, width: '100%' });
    }
    await listaProveedoresFiltro(); // llena el select del filtro
    initFiltroProveedorPersistente();
}

// Botón "Aplicar" del filtro top
async function aplicarFiltros() {
    const idProv = getProveedorFiltro(); // -1 = todos
    await listaInsumos(idProv);
}

// Botón "Limpiar" (si luego agregás uno, ya queda listo)
async function limpiarFiltrosPI() {
    setProveedorFiltro(-1);
    await aplicarFiltros();
}

// ========= CRUD =========
function toggleAcciones(id) {
    const $dropdown = $(`.acciones-menu[data-id="${id}"] .acciones-dropdown`);
    if ($dropdown.is(":visible")) $dropdown.hide();
    else {
        $('.acciones-dropdown').hide();
        $dropdown.show();
    }
}

function guardarCambios() {
    if (!validarCampos()) return;

    const idInsumo = $("#txtId").val();
    const nuevoModelo = {
        Id: idInsumo !== "" ? parseInt(idInsumo) : 0,
        Codigo: $("#txtCodigo").val(),
        Descripcion: $("#txtDescripcion").val(),
        CostoUnitario: $("#txtCostoUnitario").val(),
        IdProveedor: parseInt($("#Proveedores").val()),
    };

    const url = idInsumo === "" ? "ProveedoresInsumos/Insertar" : "ProveedoresInsumos/Actualizar";
    const method = idInsumo === "" ? "POST" : "PUT";

    fetch(url, {
        method,
        headers: {
            'Authorization': 'Bearer ' + (token || ''),
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(nuevoModelo)
    })
        .then(async response => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.mensaje || response.statusText || 'Error inesperado');

            $('#modalEdicion').modal('hide');
            exitoModal(data.mensaje || (idInsumo === "" ? "Insumo registrado correctamente" : "Insumo modificado correctamente"));
            aplicarFiltros();
        })
        .catch(error => {
            console.error('Error:', error);
            errorModal(error.message || 'Error inesperado');
        });
}

function nuevoInsumo() {
    const el = document.getElementById('lblUltimaModif');
    if (el) el.textContent = "";
    limpiarModal();
    listaProveedores().then(() => {
        $('#modalEdicion').modal('show');
        $("#btnGuardar").text("Registrar");
        $("#modalEdicionLabel").text("Nuevo Insumo");
    });
}

async function mostrarModal(modelo) {
    limpiarModal();

    setInfoAuditoria(modelo);

    await listaProveedores();

    const campos = ["Id", "Codigo", "Descripcion", "CostoUnitario"];
    campos.forEach(campo => { $(`#txt${campo}`).val(modelo[campo]); });
    $("#Proveedores").val(modelo.IdProveedor).trigger("change.select2");

    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Guardar");
    $("#modalEdicionLabel").text("Editar Insumo");
}

async function eliminarInsumo(id) {
    let resultado = window.confirm("¿Desea eliminar el Insumo?");
    if (!resultado) return;

    try {
        const response = await fetch("ProveedoresInsumos/Eliminar?id=" + id, {
            method: "DELETE",
            headers: {
                'Authorization': 'Bearer ' + (token || '')
            }
        });

        if (!response.ok) throw new Error("Error al eliminar el Insumo.");

        const dataJson = await response.json();
        if (dataJson.valor) {
            aplicarFiltros();
            exitoModal("Insumo eliminado correctamente");
        } else {
            throw new Error(dataJson.mensaje || "No se pudo eliminar.");
        }
    } catch (error) {
        console.error("Ha ocurrido un error:", error);
        errorModal(error.message || "Ha ocurrido un error");
    }
}

// ========= Data (fetch) =========
async function listaInsumos(IdProveedor) {
    const url = `/ProveedoresInsumos/Lista?IdProveedor=${IdProveedor}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + (token || ''),
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    await configurarDataTable(data);
}

// ========= DataTable =========
async function configurarDataTable(data) {
    if (!gridInsumos) {
        $('#grd_InsumosProveedor thead tr').clone(true).addClass('filters').appendTo('#grd_InsumosProveedor thead');

        gridInsumos = $('#grd_InsumosProveedor').DataTable({
            data,
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
                <button class='btn btn-sm btnacciones' type='button' onclick='toggleAcciones(${data})' title='Acciones'>
                  <i class='fa fa-ellipsis-v fa-lg text-white' aria-hidden='true'></i>
                </button>
                <div class="acciones-dropdown" style="display: none;">
                  <button class='btn btn-sm btneditar' type='button' onclick='editarInsumo(${data})' title='Editar'>
                    <i class='fa fa-pencil-square-o fa-lg text-success' aria-hidden='true'></i> Editar
                  </button>
                  <button class='btn btn-sm btneliminar' type='button' onclick='eliminarInsumo(${data})' title='Eliminar'>
                    <i class='fa fa-trash-o fa-lg text-danger' aria-hidden='true'></i> Eliminar
                  </button>
                </div>
              </div>`;
                    },
                    orderable: false,
                    searchable: false,
                },
                { data: 'Codigo' },
                { data: 'Descripcion' },
                { data: 'CostoUnitario' },
                { data: 'Proveedor' },
                { data: 'FechaActualizacion' },
            ],
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'excelHtml5',
                    text: 'Exportar Excel',
                    filename: 'Reporte Proveedores-Insumos',
                    title: '',
                    exportOptions: { columns: [1, 2, 3, 4, 5] },
                    className: 'btn-exportar-excel',
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Reporte Proveedores-Insumos',
                    title: '',
                    exportOptions: { columns: [1, 2, 3, 4, 5] },
                    className: 'btn-exportar-pdf',
                },
                {
                    extend: 'print',
                    text: 'Imprimir',
                    title: '',
                    exportOptions: { columns: [1, 2, 3, 4, 5] },
                    className: 'btn-exportar-print'
                },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: true,
            columnDefs: [
                {
                    render: function (data) {
                        if (data) {
                            const date = new Date(data);
                            return moment(date, 'YYYY-MM-DD hh:mm').format('DD/MM/YYYY HH:mm');
                        }
                        return '';
                    },
                    targets: [5] // Fecha
                },
                {
                    render: function (data) { return formatNumber(data); },
                    targets: [3] // Costo Unitario
                }
            ],
            initComplete: async function () {
                const api = this.api();

                // Filtros por columna
                columnConfig.forEach(async (config) => {
                    const cell = $('.filters th').eq(config.index);

                    if (config.filterType === 'text') {
                        const input = $('<input type="text" placeholder="Buscar..." />')
                            .appendTo(cell.empty())
                            .off('keyup change')
                            .on('keyup change', function (e) {
                                e.stopPropagation();
                                const regexr = '({search})';
                                const cursorPosition = this.selectionStart;
                                api.column(config.index)
                                    .search(this.value !== '' ? regexr.replace('{search}', '(((' + this.value + ')))') : '', this.value !== '', this.value === '')
                                    .draw();
                                $(this).focus()[0].setSelectionRange(cursorPosition, cursorPosition);
                            });
                    } else if (config.filterType === 'select') {
                        // (Dejar preparado por si en un futuro agregás selects por columna)
                        const select = $('<select><option value="">Seleccionar</option></select>')
                            .appendTo(cell.empty())
                            .on('change', function () {
                                const selectedText = $(this).find('option:selected').text();
                                api.column(config.index).search(this.value ? '^' + selectedText + '$' : '', true, false).draw();
                            });
                    }
                });

                // La primera columna (acciones) no lleva filtro
                $('.filters th').eq(0).html('');

                configurarOpcionesColumnas();

                setTimeout(() => { gridInsumos.columns.adjust(); }, 10);

                // KPIs con los datos actuales de la tabla (si existen KPIs en el DOM)
                actualizarKpisProveedorInsumos(data);
            },
        });

    } else {
        gridInsumos.clear().rows.add(data).draw();
        actualizarKpisProveedorInsumos(data);
    }
}

// ========= Configuración columnas (persistencia localStorage) =========
function configurarOpcionesColumnas() {
    const grid = $('#grd_InsumosProveedor').DataTable();
    const columnas = grid.settings().init().columns;
    const container = $('#configColumnasMenu');

    const storageKey = `ProveedoresInsumos_Columnas`;
    const savedConfig = JSON.parse(localStorage.getItem(storageKey)) || {};

    container.empty();

    columnas.forEach((col, index) => {
        // Evitar la columna de acciones (index 0) y campos sin data binding
        if (!col.data || col.data === "Id" || index === 0) return;

        const isChecked = savedConfig[`col_${index}`] !== undefined ? savedConfig[`col_${index}`] : true;

        grid.column(index).visible(isChecked);
        const columnName = col.data;

        container.append(`
      <li>
        <label class="dropdown-item">
          <input type="checkbox" class="toggle-column" data-column="${index}" ${isChecked ? 'checked' : ''}>
          ${columnName}
        </label>
      </li>
    `);
    });

    $('.toggle-column').on('change', function () {
        const columnIdx = parseInt($(this).data('column'), 10);
        const isChecked = $(this).is(':checked');
        savedConfig[`col_${columnIdx}`] = isChecked;
        localStorage.setItem(storageKey, JSON.stringify(savedConfig));
        grid.column(columnIdx).visible(isChecked);
    });
}

// ========= Listas (con token) =========
async function listaProveedoresFilter() {
    const url = `/Proveedores/Lista`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + (token || ''),
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}

async function listaProveedores() {
    const data = await listaProveedoresFilter();
    const select = document.getElementById("Proveedores");
    if (!select) return;

    $('#Proveedores option').remove();

    const optionDefault = document.createElement("option");
    optionDefault.value = "";
    optionDefault.text = "Seleccionar";
    optionDefault.disabled = true;
    optionDefault.selected = true;
    select.appendChild(optionDefault);

    data.forEach(d => {
        const op = document.createElement("option");
        op.value = d.Id;
        op.text = d.Nombre;
        select.appendChild(op);
    });
}

async function listaProveedoresFiltro() {
    const data = await listaProveedoresFilter();
    const select = document.getElementById("ProveedorFiltro");
    if (!select) return;

    $('#ProveedorFiltro option').remove();

    const optionTodos = document.createElement("option");
    optionTodos.value = -1;
    optionTodos.text = "Todos";
    select.appendChild(optionTodos);

    data.forEach(d => {
        const op = document.createElement("option");
        op.value = d.Id;
        op.text = d.Nombre;
        select.appendChild(op);
    });

    // Si usás Select2 en el filtro TOP, refrescar
    if (window.jQuery && $.fn.select2 && $(select).data('select2')) {
        $(select).trigger('change.select2');
    }
}

// ========= Modal / Form helpers =========
function limpiarModal() {
    const formulario = document.querySelector("#formInsumo");
    if (!formulario) return;

    formulario.querySelectorAll("input, select, textarea").forEach(el => {
        if (el.tagName === "SELECT") el.selectedIndex = 0;
        else el.value = "";
        el.classList.remove("is-invalid", "is-valid");
    });

    const proveedores = document.getElementById("Proveedores");
    if (proveedores && $(proveedores).data('select2')) {
        $(proveedores).val("").trigger("change.select2");
        $(proveedores).next(".select2-container").removeClass("is-valid is-invalid");
    }

    const errorMsg = document.getElementById("errorCampos");
    if (errorMsg) errorMsg.classList.add("d-none");
}

function validarCampoIndividual(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id;
    const valor = el.value ? el.value.trim() : "";
    const feedback = el.nextElementSibling;

    const camposNumericos = ["txtCostoUnitario"];
    const esNumero = camposNumericos.includes(id);

    if (tag === "input" || tag === "select" || tag === "textarea") {
        if (feedback && feedback.classList.contains("invalid-feedback")) {
            feedback.textContent = "Campo obligatorio";
        }

        if (valor === "" || valor === "Seleccionar") {
            el.classList.remove("is-valid");
            el.classList.add("is-invalid");
        } else if (esNumero) {
            const sinFormato = valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
            if (isNaN(parseFloat(sinFormato))) {
                el.classList.remove("is-valid");
                el.classList.add("is-invalid");
                if (feedback) feedback.textContent = "Valor erróneo";
            } else {
                el.classList.remove("is-invalid");
                el.classList.add("is-valid");
            }
        } else {
            el.classList.remove("is-invalid");
            el.classList.add("is-valid");
        }
    }

    // select2 visual
    if ($(el).hasClass("select2-hidden-accessible")) {
        const container = $(el).next(".select2-container");
        container.removeClass("is-valid is-invalid");

        if (!valor || valor === "Seleccionar") container.addClass("is-invalid");
        else container.addClass("is-valid");

        $(el).removeClass("is-valid is-invalid");
    }

    verificarErroresGenerales();
}

function verificarErroresGenerales() {
    const errorMsg = document.getElementById("errorCampos");
    const hayInvalidos = document.querySelectorAll("#formInsumo .is-invalid").length > 0;
    if (!errorMsg) return;
    if (!hayInvalidos) errorMsg.classList.add("d-none");
}

function validarCampos() {
    const campos = ["#txtCodigo", "#txtDescripcion", "#Proveedores", "#txtCostoUnitario"];
    const camposNumericos = ["#txtCostoUnitario"];
    let valido = true;

    campos.forEach(selector => {
        const campo = document.querySelector(selector);
        const valor = campo?.value?.trim();
        const feedback = campo?.nextElementSibling;
        const esNumero = camposNumericos.includes(selector);
        const isSelect2 = campo?.classList.contains("select2-hidden-accessible");

        if (isSelect2) $(campo).next(".select2-container").removeClass("is-valid is-invalid");

        if (!campo || !valor || valor === "Seleccionar") {
            if (isSelect2) $(campo).next(".select2-container").addClass("is-invalid");
            else {
                campo.classList.add("is-invalid");
                campo.classList.remove("is-valid");
            }
            if (feedback?.classList.contains("invalid-feedback")) feedback.textContent = "Campo obligatorio";
            valido = false;
        } else if (esNumero) {
            const sinFormato = valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
            if (isNaN(parseFloat(sinFormato))) {
                if (isSelect2) $(campo).next(".select2-container").addClass("is-invalid");
                else {
                    campo.classList.remove("is-valid");
                    campo.classList.add("is-invalid");
                }
                if (feedback?.classList.contains("invalid-feedback")) feedback.textContent = "Valor erróneo";
                valido = false;
            } else {
                if (isSelect2) $(campo).next(".select2-container").addClass("is-valid");
                else {
                    campo.classList.remove("is-invalid");
                    campo.classList.add("is-valid");
                }
            }
        } else {
            if (isSelect2) $(campo).next(".select2-container").addClass("is-valid");
            else {
                campo.classList.remove("is-invalid");
                campo.classList.add("is-valid");
            }
        }
    });

    document.getElementById("errorCampos").classList.toggle("d-none", valido);
    return valido;
}

// ========= Importación Excel =========
let listaInsumosArray = [];

async function cargarProveedores() {
    const resp = await fetch('/Proveedores/Lista', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + (token || ''),
            'Content-Type': 'application/json'
        }
    });
    const data = await resp.json();
    const select = document.getElementById('ProveedorImportar');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccione proveedor...</option>';
    data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.Id;
        opt.text = p.Nombre;
        select.add(opt);
    });
}

function procesarArchivoSiCompleto() {
    const archivo = document.getElementById('archivoExcel').files[0];
    const idProveedor = document.getElementById('ProveedorImportar').value;

    limpiarModalImportar();

    if (archivo && idProveedor) {
        procesarArchivo();
    }
}

document.getElementById('modalImportar')?.addEventListener('shown.bs.modal', () => {
    // Reset
    document.getElementById('bloqueTabla').classList.add('d-none');
    document.getElementById('bloqueBuscador').classList.add('d-none');
    document.getElementById('resumenImportacion').classList.add('d-none');
    document.getElementById('resumenContainer').classList.add('d-none');

    document.getElementById('archivoExcel').value = '';
    document.getElementById('ProveedorImportar').value = '';
    document.querySelector('#vistaPrevia tbody').innerHTML = '';
    document.getElementById('comparandoLoader').classList.add('d-none');
    document.getElementById('errorImportar').classList.add('d-none');
    document.getElementById('btnImportar').disabled = false;
    document.getElementById('btnDescargarMaqueta').classList.remove('d-none');
    document.getElementById('archivoExcel').addEventListener('change', procesarArchivoSiCompleto);
    document.getElementById('ProveedorImportar').addEventListener('change', procesarArchivoSiCompleto);
    listaInsumosArray = [];
    cargarProveedores();
});

async function procesarArchivo() {
    const archivo = document.getElementById('archivoExcel').files[0];
    const idProveedor = document.getElementById('ProveedorImportar').value;
    const loader = document.getElementById('comparandoLoader');
    const btnImportar = document.getElementById('btnImportar');
    const btnDescargar = document.getElementById('btnDescargarMaqueta');
    const errorBox = document.getElementById('errorImportar');
    const tbody = document.querySelector('#vistaPrevia tbody');
    const resumenDiv = document.getElementById('resumenImportacion');

    if (!archivo || !idProveedor) {
        errorBox.textContent = "Seleccioná proveedor y archivo.";
        errorBox.classList.remove('d-none');
        return;
    }

    errorBox.classList.add('d-none');
    loader.classList.remove('d-none');
    btnImportar.disabled = true;
    btnDescargar.classList.add('d-none');
    tbody.innerHTML = '';
    listaInsumosArray = [];

    try {
        const data = await archivo.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'buffer' });
        const hoja = workbook.Sheets[workbook.SheetNames[0]];

        const lista = extraerBloquesDesdeMatriz(hoja);
        if (lista.length === 0) throw new Error("Ninguna hoja contiene columnas reconocidas de Código, Descripción y Precio.");

        const payload = {
            IdProveedor: parseInt(idProveedor),
            Lista: lista
        };

        const resp = await fetch('/ProveedoresInsumos/Comparar', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + (token || ''),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error(await resp.text());
        const comparacion = await resp.json();
        listaInsumosArray = comparacion;

        let subas = 0, bajas = 0, nuevos = 0;

        comparacion.forEach(item => {
            const tr = document.createElement('tr');

            const precioNuevo = parsearPrecio(item.precioNuevo ?? item.PrecioNuevo ?? item.CostoUnitario);
            const precioAnterior = parsearPrecio(item.precioAnterior ?? item.PrecioAnterior);

            const EPSILON = 1;
            const sonIguales = Math.abs((precioAnterior || 0) - (precioNuevo || 0)) < EPSILON;

            const diferenciaValor = (item.nuevo || sonIguales) ? 0 : (precioNuevo - precioAnterior);
            const porcentajeValor = (precioAnterior === 0 || diferenciaValor === 0) ? 0 : (diferenciaValor / precioAnterior) * 100;

            let claseFila = '', claseCambio = '', simbolo = '', diferenciaTexto = '-', porcentajeTexto = '-';

            if (item.nuevo) {
                claseFila = 'fila-nueva-insumo';
                nuevos++;
            } else if (diferenciaValor !== 0) {
                claseFila = 'fila-modificada';
                simbolo = diferenciaValor > 0 ? '+' : '-';
                diferenciaTexto = simbolo + formatearPrecio(Math.abs(diferenciaValor));
                porcentajeTexto = simbolo + Math.abs(porcentajeValor).toFixed(1) + '%';
                claseCambio = diferenciaValor > 0 ? 'text-danger fw-bold' : 'text-success fw-bold';

                if (diferenciaValor > 0) subas++;
                else bajas++;
            } else {
                claseFila = 'fila-sin-cambios';
                diferenciaTexto = '$ 0,00';
                porcentajeTexto = '0,0%';
            }

            tr.className = claseFila;
            tr.innerHTML = `
        <td>${item.codigo ?? item.Codigo ?? ''}</td>
        <td>
          <button class="btn btn-sm text-danger me-2" onclick="eliminarFilaImportacion(this)" title="Eliminar insumo">
            <i class="fa fa-trash"></i>
          </button>
          <span title="${item.descripcion ?? item.Descripcion ?? ''}">${item.descripcion ?? item.Descripcion ?? ''}</span>
        </td>
        <td>${(precioAnterior != null && !isNaN(precioAnterior)) ? formatearPrecio(precioAnterior) : '-'}</td>
        <td>${(precioNuevo != null && !isNaN(precioNuevo)) ? formatearPrecio(precioNuevo) : '-'}</td>
        <td class="${claseCambio}">${diferenciaTexto}</td>
        <td class="${claseCambio}">${porcentajeTexto}</td>
      `;

            tbody.appendChild(tr);
        });

        document.getElementById('bloqueTabla').classList.remove('d-none');
        document.getElementById('bloqueBuscador').classList.remove('d-none');

        // Resumen de promedios
        if (subas + bajas + nuevos > 0) {
            const soloSubas = comparacion.filter(i => !i.nuevo && parsearPrecio(i.precioNuevo ?? i.PrecioNuevo ?? i.CostoUnitario) > parsearPrecio(i.precioAnterior ?? i.PrecioAnterior));
            const soloBajas = comparacion.filter(i => !i.nuevo && parsearPrecio(i.precioNuevo ?? i.PrecioNuevo ?? i.CostoUnitario) < parsearPrecio(i.precioAnterior ?? i.PrecioAnterior));

            const promedioSuba = soloSubas.length
                ? soloSubas.reduce((acc, i) => {
                    const n = parsearPrecio(i.precioNuevo ?? i.PrecioNuevo ?? i.CostoUnitario);
                    const a = parsearPrecio(i.precioAnterior ?? i.PrecioAnterior);
                    return acc + ((n - a) / a);
                }, 0) / soloSubas.length
                : 0;

            const promedioBaja = soloBajas.length
                ? soloBajas.reduce((acc, i) => {
                    const n = parsearPrecio(i.precioNuevo ?? i.PrecioNuevo ?? i.CostoUnitario);
                    const a = parsearPrecio(i.precioAnterior ?? i.PrecioAnterior);
                    return acc + ((a - n) / a);
                }, 0) / soloBajas.length
                : 0;

            const resumenContainer = document.getElementById('resumenContainer');
            const resumenDiv = document.getElementById('resumenImportacion');
            resumenContainer.classList.remove('d-none');
            resumenDiv.classList.remove('d-none');

            let resumenTexto = `
        Se han registrado <strong>${nuevos}</strong> <span class="text-primary fw-bold">nuevos insumos</span>.<br>
        Se han registrado <strong>${soloSubas.length}</strong> insumos con <span class="text-danger fw-bold">aumento de precio</span>.<br>
        Se han registrado <strong>${soloBajas.length}</strong> insumos con <span class="text-success fw-bold">baja de precio</span>.<br>
        <hr class="my-1">
        Promedio de aumento: <strong class="text-danger">${(promedioSuba * 100).toFixed(1)}%</strong><br>
        Promedio de baja: <strong class="text-success">${(promedioBaja * 100).toFixed(1)}%</strong><br>
      `;

            resumenTexto += promedioBaja > promedioSuba
                ? `<div class="mt-2"><i class="fa fa-arrow-down text-success"></i> La baja promedio supera al aumento promedio.</div>`
                : promedioSuba > promedioBaja
                    ? `<div class="mt-2"><i class="fa fa-arrow-up text-danger"></i> El aumento promedio supera a la baja promedio.</div>`
                    : `<div class="mt-2"><i class="fa fa-balance-scale text-secondary"></i> Las subas y bajas se equilibran.</div>`;

            resumenDiv.innerHTML = resumenTexto;

            document.getElementById('btnToggleResumen').innerHTML =
                `<i class="fa fa-chevron-down me-1" id="iconoResumen"></i> Ver promedios`;
        }

    } catch (err) {
        console.error(err);
        errorBox.textContent = err.message || "Ocurrió un error durante la comparación.";
        errorBox.classList.remove('d-none');
    }

    loader.classList.add('d-none');
    btnImportar.disabled = false;
    btnDescargar.classList.remove('d-none');
}

function descargarMaqueta() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([], { header: ["Código", "Descripción", "Precio"] });
    XLSX.utils.book_append_sheet(wb, ws, "Insumos");
    XLSX.writeFile(wb, "maqueta-insumos.xlsx");
}

async function enviarDatos() {
    const idProveedor = document.getElementById('ProveedorImportar').value;
    const errorBox = document.getElementById('errorImportar');

    if (!idProveedor || listaInsumosArray.length === 0) {
        errorBox.textContent = "Debe seleccionar un proveedor y cargar al menos un insumo.";
        errorBox.classList.remove('d-none');
        return;
    }

    const payload = {
        IdProveedor: parseInt(idProveedor),
        Lista: listaInsumosArray.map(x => ({
            Codigo: x.Codigo ?? x.codigo ?? '',
            Descripcion: x.Descripcion ?? x.descripcion ?? '',
            CostoUnitario: x.CostoUnitario ?? x.costoUnitario ?? x.precioNuevo ?? x.PrecioNuevo ?? 0
        }))
    };

    if (!payload.Lista.every(x => x.Descripcion && !isNaN(parseFloat(x.CostoUnitario)))) {
        errorBox.textContent = "Algunos insumos tienen datos incompletos o inválidos.";
        errorBox.classList.remove('d-none');
        return;
    }

    errorBox.classList.add('d-none');

    try {
        const resp = await fetch('/ProveedoresInsumos/Importar', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + (token || ''),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const texto = await resp.text();
            throw new Error(texto || "Error en la solicitud.");
        }

        const result = await resp.json();
        if (result.valor) {
            exitoModal("Insumos importados correctamente");
            aplicarFiltros();
            $('#modalImportar').modal('hide');
        } else {
            errorBox.textContent = result.mensaje || "Error al importar los insumos.";
            errorBox.classList.remove('d-none');
        }
    } catch (error) {
        errorBox.textContent = error.message || "Error inesperado al importar.";
        errorBox.classList.remove('d-none');
        console.error(error);
    }
}

// ========= Utilidades Import =========
function filtrarVistaPrevia() {
    const input = document.getElementById('buscadorVistaPrevia');
    const filter = (input?.value || '').toLowerCase();
    const rows = document.querySelectorAll("#vistaPrevia tbody tr");
    rows.forEach(row => {
        const textoFila = row.textContent.toLowerCase();
        row.style.display = textoFila.includes(filter) ? "" : "none";
    });
}

function toggleResumen() {
    const resumen = document.getElementById('resumenImportacion');
    const icono = document.getElementById('iconoResumen');
    const boton = document.getElementById('btnToggleResumen');

    const visible = resumen.classList.contains('mostrar');
    if (visible) {
        resumen.classList.remove('mostrar');
        icono.classList.remove('fa-chevron-up');
        icono.classList.add('fa-chevron-down');
        boton.innerHTML = `<i class="fa fa-chevron-down me-1" id="iconoResumen"></i> Ver promedios`;
    } else {
        resumen.classList.add('mostrar');
        icono.classList.remove('fa-chevron-down');
        icono.classList.add('fa-chevron-up');
        boton.innerHTML = `<i class="fa fa-chevron-up me-1" id="iconoResumen"></i> Ocultar promedios`;
    }
}

function limpiarModalImportar() {
    document.getElementById('bloqueTabla').classList.add('d-none');
    document.getElementById('bloqueBuscador').classList.add('d-none');
    document.getElementById('resumenImportacion').classList.remove('mostrar');
    document.getElementById('resumenImportacion').classList.add('d-none');
    document.getElementById('resumenContainer').classList.add('d-none');
    document.getElementById('vistaPrevia').querySelector('tbody').innerHTML = '';
    document.getElementById('errorImportar').classList.add('d-none');
    document.getElementById('buscadorVistaPrevia').value = '';
    listaInsumosArray = [];
}

function eliminarFilaImportacion(btn) {
    const fila = btn.closest('tr');
    const index = [...fila.parentElement.children].indexOf(fila);
    if (index >= 0) {
        listaInsumosArray.splice(index, 1);
        fila.remove();
    }
}

// ========= Parsers / helpers Excel =========
function parsearPrecio(precioTexto) {
    if (precioTexto == null || precioTexto === '') return NaN;
    const texto = precioTexto.toString().trim();
    const limpio = texto.replace(/[^0-9.,-]/g, '');

    if (/,/.test(limpio) && /\.\d{3}/.test(limpio)) {
        return parseFloat(limpio.replace(/\./g, '').replace(',', '.'));
    }
    if (/\.\d{2}$/.test(limpio) && /,\d{3}/.test(limpio)) {
        return parseFloat(limpio.replace(/,/g, ''));
    }
    if (/,/.test(limpio)) return parseFloat(limpio.replace(',', '.'));
    return parseFloat(limpio);
}

function formatearPrecio(numero) {
    if (isNaN(numero)) return '-';
    return '$ ' + Number(numero)
        .toFixed(2)
        .replace('.', ',')
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function extraerBloquesDesdeMatriz(hoja) {
    const jsonMatriz = XLSX.utils.sheet_to_json(hoja, { header: 1 });
    const errores = [];
    const resultados = [];

    for (let fila = 0; fila < jsonMatriz.length; fila++) {
        const row = jsonMatriz[fila];
        if (!row || row.length === 0) continue;

        for (let col = 0; col < row.length - 2; col++) {
            const celdaCodigo = normalizarClave(row[col]);
            const celdaDescripcion = normalizarClave(row[col + 1]);
            const celdaPrecio = normalizarClave(row[col + 2]);

            // Detecta encabezado "codigo/descripcion/precio"
            if (celdaCodigo.includes("codigo") && celdaDescripcion.includes("descripcion") && celdaPrecio.includes("precio")) {

                let f = fila + 1;

                while (f < jsonMatriz.length) {
                    const datos = Array.isArray(jsonMatriz[f]) ? jsonMatriz[f] : []; // <= nunca null

                    const codigo = datos[col]?.toString().trim() ?? '';
                    const descripcion = datos[col + 1]?.toString().trim() ?? '';
                    const precioRaw = datos[col + 2]?.toString().trim() ?? '';
                    const precioParsed = parsearPrecio(precioRaw);
                    const precio = isNaN(precioParsed) ? NaN : +precioParsed.toFixed(2);

                    const esEncabezado =
                        normalizarClave(codigo).includes('codigo') &&
                        normalizarClave(descripcion).includes('descripcion') &&
                        normalizarClave(precioRaw).includes('precio');

                    const vacio = !codigo && !descripcion && !precioRaw;
                    const esTitulo = (!codigo && descripcion && descripcion.startsWith('-') && descripcion.endsWith('-'));

                    // --- reglas de corte / avance ---
                    if (esEncabezado || esTitulo) break;     // corta solo por nuevo bloque/título
                    if (vacio) { f++; continue; }             // fila vacía: saltar y seguir

                    // --- validación y push ---
                    if (!descripcion || isNaN(precio)) {
                        errores.push(`- Fila ${f + 1}: "${codigo}" "${descripcion}" "${precioRaw}"`);
                    } else {
                        resultados.push({
                            Codigo: codigo,
                            Descripcion: descripcion,
                            CostoUnitario: precio
                        });
                    }

                    f++;
                }

                // salteo las 2 columnas del bloque detectado
                col += 2;
            }
        }
    }

    window.errores = errores;
    return resultados;
}

function normalizarClave(clave) {
    if (typeof clave !== 'string') return '';
    return clave.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizarTexto(txt) {
    return txt?.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() || '';
}


const editarInsumo = (id) => {
    $('.acciones-dropdown').hide();

    fetch("/ProveedoresInsumos/EditarInfo?id=" + encodeURIComponent(id), {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
        .then(r => {
            if (!r.ok) throw new Error("Ha ocurrido un error.");
            return r.json();
        })
        .then(data => {
            if (data) {
                mostrarModal(data);
            } else {
                throw new Error("Ha ocurrido un error.");
            }
        })
        .catch(() => errorModal("Ha ocurrido un error."));
};




// === Toggle Filtros PROV: tolerante a IDs P / PI ===
const _KEY_BAR_VISIBLE_PI = 'ProvIns_FiltroBar_Visible';

function _pickByIds(ids) {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return el;
    }
    return null;
}

function initFiltroProveedorPersistente() {
    // Asegura opción "Todos" y restaura valor del select
    ensureOpcionTodosProveedor();

    let saved = -1;
    try {
        const raw = localStorage.getItem(_KEY_PROV_FILTRO);
        if (raw != null && raw !== '') {
            const n = Number(raw);
            if (Number.isFinite(n)) saved = n;
        }
    } catch { }
    setProveedorFiltro(saved);

    const sel = document.getElementById('ProveedorFiltro');
    if (sel) {
        sel.addEventListener('change', () => {
            try { localStorage.setItem(_KEY_PROV_FILTRO, String(sel.value ?? '-1')); } catch { }
        });
    }

    // === IDs aceptados (ambas variantes)
    const btn = _pickByIds(['btnToggleFiltrosPI', 'btnToggleFiltrosP']);
    const icon = _pickByIds(['iconFiltrosPI', 'iconFiltrosP']);
    const bar = _pickByIds(['formFiltrosProvIns', 'Filtros', 'ProveedorFiltro']);

    if (!btn || !icon || !bar) return;

    // Evita submit si el botón está dentro de un form
    btn.setAttribute('type', 'button');

    // Estado inicial persistido
    let visible = true;
    try {
        const raw = localStorage.getItem(_KEY_BAR_VISIBLE_PI);
        if (raw !== null) visible = raw === '1';
    } catch { }

    bar.classList.toggle('d-none', !visible);
    icon.classList.toggle('fa-arrow-up', visible);
    icon.classList.toggle('fa-arrow-down', !visible);

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const oculto = bar.classList.toggle('d-none'); // true si queda oculto
        icon.classList.toggle('fa-arrow-down', oculto);
        icon.classList.toggle('fa-arrow-up', !oculto);
        try { localStorage.setItem(_KEY_BAR_VISIBLE_PI, oculto ? '0' : '1'); } catch { }
    });
}

// Reintento por si el HTML se inyecta más tarde
document.addEventListener('DOMContentLoaded', () => {
    initFiltroProveedorPersistente();
    setTimeout(initFiltroProveedorPersistente, 300);
});
