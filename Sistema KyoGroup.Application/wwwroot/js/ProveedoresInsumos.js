/* ============================================================================
 * ProveedoresInsumos.js — COMPLETO
 * - DataTable principal
 * - Validaciones y modal (Código NO requerido al crear)
 * - Importación Excel + vista previa editable + resumen
 * - Envío exacto al endpoint Importar (Codigo, Descripcion, CostoUnitario, Cantidad)
 * ============================================================================ */

/* ================== Estado global ================== */
let gridInsumos = null;
let listaInsumosArray = [];        // vista previa importación
const _PI_selected = new Set();    // selección múltiple grilla principal
let _PI_lastSelectedIndex = null;

const columnConfig = [
    { index: 1, filterType: 'text' }, // Codigo
    { index: 2, filterType: 'text' }, // Descripcion
    { index: 3, filterType: 'text' }, // Costo
    { index: 4, filterType: 'text' }, // Cantidad
    { index: 5, filterType: 'text' }, // Costo Unitario
    { index: 6, filterType: 'text' }, // Proveedor
    { index: 7, filterType: 'text' }, // Fecha Actualizacion
    { index: 8, filterType: 'text' }, // Fecha Actualizacion
];

/* ================== Helpers numérico/formatos ================== */
const _num = n => parseFloat(n) || 0;

function _parseNumberLoose(txt) {
    if (txt == null) return NaN;

    let s = String(txt).trim();
    if (s === '') return NaN;

    // Quitar símbolos/palabras de moneda y %
    // (se eliminan sin romper números con espacios p.ej. "R$ 1.234,56")
    s = s.replace(/\s+/g, '');
    s = s.replace(/(?:USD|ARS|MXN|COP|CLP|UYU|EUR|GBP|JPY|CNY|R\$|A\$|C\$|€|\$|£|¥|₱|₡|₫|₴|₪|₹|₩|₦|₭|₲|₺|₽|%)/gi, '');

    // Mantener solo dígitos, coma, punto y signo
    s = s.replace(/[^\d.,-]/g, '');

    // Casos triviales inválidos
    if (s === '' || s === '-' || s === ',' || s === '.') return NaN;

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    // Ambos presentes: el último es decimal; el otro es miles
    if (lastComma !== -1 && lastDot !== -1) {
        const decSep = (lastComma > lastDot) ? ',' : '.';
        const thouSep = (decSep === ',') ? '.' : ',';

        // Quitar todos los miles
        s = s.split(thouSep).join('');

        // Reemplazar TODAS las apariciones del decimal sep, dejando solo la última como '.'
        const esc = decSep === '.' ? '\\.' : decSep;
        s = s.replace(new RegExp(esc, 'g'), (m, i, str) => (str.lastIndexOf(decSep) === i ? '.' : ''));

        return parseFloat(s);
    }

    // Solo comas: coma como decimal, puntos (si hay) son miles
    if (lastComma !== -1) {
        // quitar posibles miles con punto
        s = s.split('.').join('');
        // convertir SOLO la última coma a decimal
        s = s.replace(/,([^,]*)$/, '.$1');
        return parseFloat(s);
    }

    // Solo puntos: punto como decimal; si hubiera múltiples, dejar solo el último como decimal
    s = s.replace(/\.(?=.*\.)/g, ''); // elimina todos los puntos salvo el último
    return parseFloat(s);
}

function parsearPrecio(precioTexto) {
    return _parseNumberLoose(precioTexto);
}

function parsearPorcentaje(txt) {
    if (typeof txt === 'number' && isFinite(txt)) {
        // Excel guarda 30% como 0.30 → convertir a 30
        return (txt > 0 && txt <= 1) ? (txt * 100) : txt;
    }
    if (txt == null) return 0;
    let s = String(txt).trim().replace(/\u00A0/g, '').replace('%', '').trim();
    const n = _parseNumberLoose(s);
    if (!isFinite(n)) return 0;
    return (n > 0 && n <= 1) ? (n * 100) : n;
}

function formatearPrecio(numero) {
    if (!isFinite(numero)) return '-';
    return '$ ' + Number(numero)
        .toFixed(2)
        .replace('.', ',')
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function normalizarClave(s) {
    return String(s ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim();
}

/* ================== KPIs ================== */
function actualizarKpisProveedorInsumos(data) {
    const cant = Array.isArray(data) ? data.length : 0;
    const el = document.getElementById('kpiCantItems');
    if (el) el.textContent = cant;
}

/* ================== Filtros top (Proveedor) ================== */
const _KEY_PROV_FILTRO = 'ProvIns_Filtro_Proveedor';
const _KEY_BAR_VISIBLE = 'ProvIns_FiltroBar_Visible';

function ensureOpcionTodosProveedor() {
    const sel = document.getElementById('ProveedorFiltro');
    if (!sel) return;
    if (!Array.from(sel.options).some(o => String(o.value) === '-1')) {
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

async function listaProveedoresFilter() {
    const resp = await fetch('/Proveedores/Lista', {
        headers: { 'Authorization': 'Bearer ' + (token || '') }
    });
    return await resp.json();
}

async function listaProveedoresFiltro() {
    const data = await listaProveedoresFilter();
    const sel = document.getElementById('ProveedorFiltro');
    if (!sel) return;
    sel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = -1; optAll.text = 'Todos';
    sel.appendChild(optAll);
    data.forEach(p => {
        const op = document.createElement('option');
        op.value = p.Id; op.text = p.Nombre;
        sel.appendChild(op);
    });
    if (window.jQuery && $.fn.select2) {
        $('#ProveedorFiltro').select2({ placeholder: 'Proveedor', allowClear: false, width: '100%' });
    }
}

function initFiltroProveedorPersistente() {
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

    const btn = document.getElementById('btnToggleFiltrosPI');
    const icon = document.getElementById('iconFiltrosP');
    const bar = document.getElementById('formFiltrosProvIns');

    if (btn && icon && bar) {
        let visible = true;
        try {
            const raw = localStorage.getItem(_KEY_BAR_VISIBLE);
            if (raw !== null) visible = raw === '1';
        } catch { }

        bar.classList.toggle('d-none', !visible);
        icon.classList.toggle('fa-arrow-down', !visible);
        icon.classList.toggle('fa-arrow-up', visible);

        btn.addEventListener('click', () => {
            const oculto = bar.classList.toggle('d-none');
            icon.classList.toggle('fa-arrow-down', oculto);
            icon.classList.toggle('fa-arrow-up', !oculto);
            try { localStorage.setItem(_KEY_BAR_VISIBLE, oculto ? '0' : '1'); } catch { }
        });
    }
}

async function bootstrapFiltroProveedor() {
    await listaProveedoresFiltro();
    initFiltroProveedorPersistente();
}

async function aplicarFiltros() {
    const idProv = getProveedorFiltro();
    await listaInsumos(idProv);
}

async function limpiarFiltrosPI() {
    setProveedorFiltro(-1);
    await aplicarFiltros();
}

/* ================== CRUD principal ================== */
function toggleAcciones(id) {
    const $dropdown = $(`.acciones-menu[data-id="${id}"] .acciones-dropdown`);
    if ($dropdown.is(":visible")) $dropdown.hide();
    else { $('.acciones-dropdown').hide(); $dropdown.show(); }
}

/**
 * Validación del modal.
 * - Código: NO requerido si es ALTA (txtId vacío). Si editás, podés exigirlo como quieras.
 */
function validarCampos() {
    const idVal = (document.querySelector('#txtId')?.value || '').trim();
    const esAlta = (idVal === '');

    const campos = [
        // esAlta ? null : "#txtCodigo",  // si quisieras exigirlo sólo en edición
        "#txtDescripcion",
        "#Proveedores",
        "#txtCosto",
        "#txtCantidad"
    ].filter(Boolean);

    let ok = true;
    const mark = (el, valid, msg) => {
        const isSelect = el.classList.contains('select2-hidden-accessible');
        const fb = el.nextElementSibling;
        if (fb && fb.classList.contains('invalid-feedback')) {
            if (msg) fb.textContent = msg;
            fb.classList.toggle('d-none', valid);
        }
        if (isSelect) {
            const sel = $(el).next('.select2-container').find('.select2-selection');
            sel.toggleClass('is-invalid', !valid);
            sel.toggleClass('is-valid', valid);
        } else {
            el.classList.toggle('is-invalid', !valid);
            el.classList.toggle('is-valid', valid);
        }
    };

    campos.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) { ok = false; return; }
        const v = (el.value ?? '').trim();
        const empty = !v || v === 'Seleccionar' || v === '-1';
        if (empty) { mark(el, false, 'Campo obligatorio'); ok = false; return; }
        if (sel === '#txtCosto' || sel === '#txtCantidad') {
            const num = _parseNumberLoose(v);
            if (isNaN(num) || (sel === '#txtCantidad' && num === 0)) {
                mark(el, false, sel === '#txtCantidad' ? 'Debe ser distinto de 0' : 'Valor erróneo');
                ok = false;
            } else mark(el, true);
        } else { mark(el, true); }
    });

    const banner = document.getElementById('errorCampos');
    if (banner) banner.classList.toggle('d-none', ok);
    return ok;
}

function recalcularCostoUnitario() {
    const costoUnit = _parseNumberLoose(document.getElementById('txtCosto')?.value);   // unitario
    let cant = _parseNumberLoose(document.getElementById('txtCantidad')?.value);
    let desc = parsearPorcentaje(document.getElementById('txtPorcDesc')?.value);

    if (isNaN(cant) || cant <= 0) cant = 1;
    if (isNaN(desc) || desc < 0) desc = 0;
    if (desc > 100) desc = 100;

    const out = document.getElementById('txtCostoUnitario');
    if (!out) return;

    if (isNaN(costoUnit)) { out.value = ''; return; }

    const factor = 1 - (desc / 100);
    const resultado = (costoUnit * cant) * factor; // << clave: multiplicar por cantidad
    out.value = isNaN(resultado) ? '' : resultado.toFixed(2);
}

function formatearSinMiles(txt) { return _parseNumberLoose(txt); }

function limpiarModal() {
    const f = document.querySelector("#formInsumo");
    if (!f) return;
    f.querySelectorAll("input, select, textarea").forEach(el => {
        if (el.tagName === "SELECT") el.selectedIndex = 0; else el.value = "";
        el.classList.remove("is-invalid", "is-valid");
    });
    const Proveedores = document.getElementById("Proveedores");
    if (Proveedores && $(Proveedores).data('select2')) {
        $(Proveedores).val("").trigger("change.select2");
        $(Proveedores).next(".select2-container").removeClass("is-valid is-invalid");
    }
    document.getElementById("errorCampos")?.classList.add("d-none");
}

function setInfoAuditoria(modelo) {
    const el = document.getElementById('lblUltimaModif');
    if (!el) return;
    if (modelo?.FechaActualizacion) {
        const d = new Date(modelo.FechaActualizacion);
        el.textContent = `Última modif.: ${moment(d).format('DD/MM/YYYY HH:mm')}`;
    } else el.textContent = '';
}

async function listaProveedores() {
    const data = await listaProveedoresFilter();
    const sel = document.getElementById('Proveedores');
    if (!sel) return;
    sel.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = -1; opt.text = 'Seleccionar';
    sel.appendChild(opt);
    data.forEach(p => {
        const o = document.createElement('option');
        o.value = p.Id; o.text = p.Nombre;
        sel.appendChild(o);
    });
    if (window.jQuery && $.fn.select2) {
        $('#Proveedores').select2({ dropdownParent: $("#modalEdicion"), width: "100%", placeholder: "Seleccionar", allowClear: false });
    }
}

function nuevoInsumo() {
    setInfoAuditoria(null);
    limpiarModal();
    listaProveedores().then(() => {
        $('#modalEdicion').modal('show');
        $("#btnGuardar").text("Registrar");
        $("#modalEdicionLabel").text("Nuevo Insumo");
        // Código NO requerido → no lo marcamos
    });
    $("#txtCantidad").val(1);
    $("#txtPorcDesc").val(0);
}

async function mostrarModal(m) {
    limpiarModal();
    setInfoAuditoria(m);
    await listaProveedores();

    const costo = (m.Costo ?? 0);
    const cantidad = (m.Cantidad ?? 1);
    const porcDesc = (m.PorcDesc ?? 0);
    const unitario = (m.CostoUnitario ?? ((cantidad ? (costo / cantidad) : 0) * (1 - (porcDesc / 100))));

    $("#txtId").val(m.Id);
    $("#txtCodigo").val(m.Codigo);
    $("#txtDescripcion").val(m.Descripcion);
    $("#txtCosto").val(isNaN(costo) ? '' : (+costo).toFixed(2));
    $("#txtCantidad").val(isNaN(cantidad) ? '' : cantidad.toString());
    $("#txtPorcDesc").val(isNaN(porcDesc) ? '0' : (+porcDesc).toFixed(2));
    $("#txtCostoUnitario").val(isNaN(unitario) ? '' : (+unitario).toFixed(2));
    $("#Proveedores").val(m.IdProveedor).trigger("change.select2");

    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Guardar");
    $("#modalEdicionLabel").text("Editar Insumo");
}

async function guardarCambios() {
    if (!validarCampos()) return;

    const idInsumo = $("#txtId").val();
    const costo = formatearSinMiles($("#txtCosto").val());
    const cantidad = _parseNumberLoose($("#txtCantidad").val());
    const porcDesc = _parseNumberLoose($("#txtPorcDesc").val());
    const porc = isNaN(porcDesc) ? 0 : Math.max(0, porcDesc);
    const cantOk = (isNaN(cantidad) || cantidad <= 0) ? 1 : cantidad;

    const unitarioBase = (!isNaN(costo) && !isNaN(cantOk) && cantOk !== 0) ? (costo / cantOk) : NaN;
    const unitario = isNaN(unitarioBase) ? NaN : (unitarioBase * (1 - (porc / 100)));

    const modelo = {
        Id: idInsumo !== "" ? parseInt(idInsumo) : 0,
        Codigo: $("#txtCodigo").val(), // NO requerido si es alta
        Descripcion: $("#txtDescripcion").val(),
        Costo: isNaN(costo) ? 0 : +costo.toFixed(2),
        Cantidad: +cantOk.toFixed(4),
        PorcDesc: +porc.toFixed(2),
        CostoUnitario: isNaN(unitario) ? 0 : +unitario.toFixed(4),
        IdProveedor: parseInt($("#Proveedores").val())
    };

    const url = idInsumo === "" ? "ProveedoresInsumos/Insertar" : "ProveedoresInsumos/Actualizar";
    const method = idInsumo === "" ? "POST" : "PUT";

    try {
        const r = await fetch(url, {
            method,
            headers: { 'Authorization': 'Bearer ' + (token || ''), 'Content-Type': 'application/json;charset=utf-8' },
            body: JSON.stringify(modelo)
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.mensaje || r.statusText || 'Error inesperado');
        $('#modalEdicion').modal('hide');
        exitoModal(data.mensaje || (idInsumo === "" ? "Insumo registrado correctamente" : "Insumo modificado correctamente"));
        aplicarFiltros();
    } catch (err) {
        console.error(err);
        errorModal(err.message || "Error inesperado");
    }
}

async function eliminarInsumo(id) {
    const ok = window.confirm("¿Desea eliminar el Insumo?");
    if (!ok) return;
    try {
        const r = await fetch("ProveedoresInsumos/Eliminar?id=" + id, {
            method: "DELETE",
            headers: { 'Authorization': 'Bearer ' + (token || '') }
        });
        if (!r.ok) throw new Error("Error al eliminar el Insumo.");
        const j = await r.json();
        if (j.valor) { aplicarFiltros(); exitoModal("Insumo eliminado correctamente"); }
        else throw new Error(j.mensaje || "No se pudo eliminar.");
    } catch (e) {
        console.error(e); errorModal(e.message || "Ha ocurrido un error");
    }
}

const editarInsumo = (id) => {
    $('.acciones-dropdown').hide();
    fetch("/ProveedoresInsumos/EditarInfo?id=" + encodeURIComponent(id), {
        headers: { 'Authorization': 'Bearer ' + (token || ''), 'Content-Type': 'application/json' }
    })
        .then(r => { if (!r.ok) throw new Error("Ha ocurrido un error."); return r.json(); })
        .then(data => { if (data) mostrarModal(data); else throw new Error("Ha ocurrido un error."); })
        .catch(() => errorModal("Ha ocurrido un error."));
};

/* ================== DataTable principal ================== */
async function listaInsumos(IdProveedor) {
    const url = `/ProveedoresInsumos/Lista?IdProveedor=${IdProveedor}`;
    const response = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + (token || ''), 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    await configurarDataTable(data);
}

async function configurarDataTable(data) {
    // ==== agregado: estado + helpers ====
    window._PI_selected = window._PI_selected || new Set();

    // (a) oculto forzado al entrar (evita que se vea en 0)
    $('#fabEliminarPI').removeClass('show-fab').hide();

    const _piUpdateFAB = () => {
        const $fab = $('#fabEliminarPI');
        const total = _PI_selected.size;
        $fab.find('.count-badge').text(String(`(${total})` || 0));
        if (total > 0) $fab.addClass('show-fab').show();
        else $fab.removeClass('show-fab').hide();
    };

    const _piIsActionClick = (e) =>
        $(e.target).closest('button,a,input,select,label,.icon-btn,.acciones-menu,.acciones-dropdown').length > 0;

    if (!gridInsumos) {
        $('#grd_InsumosProveedor thead tr').clone(true).addClass('filters').appendTo('#grd_InsumosProveedor thead');

        gridInsumos = $('#grd_InsumosProveedor').DataTable({
            rowId: 'Id',
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
        <button class='btn btn-sm btnacciones' type='button' title='Acciones'>
          <i class='fa fa-ellipsis-v fa-lg text-white' aria-hidden='true'></i>
        </button>
        <div class="acciones-dropdown" style="display:none">
          <button class='btn btn-sm btneditar'  type='button' onclick='editarInsumo(${data})'   title='Editar'>
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
                { data: 'Costo' },
                { data: 'Cantidad' },
                { data: 'PorcDesc' },
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
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7] },
                    className: 'btn-exportar-excel',
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Reporte Proveedores-Insumos',
                    title: '',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7] },
                    className: 'btn-exportar-pdf',
                },
                {
                    extend: 'print',
                    text: 'Imprimir',
                    title: '',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7] },
                    className: 'btn-exportar-print'
                },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: true,
            columnDefs: [
                { // Costo y CostoUnitario
                    render: function (data) {
                        const n = parseFloat(data);
                        if (isNaN(n)) return '';
                        try {
                            return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);
                        } catch {
                            return '$ ' + n.toFixed(2);
                        }
                    },
                    targets: [3, 6]
                },
                { // Cantidad
                    render: function (data) {
                        const n = parseFloat(data);
                        if (isNaN(n)) return '';
                        return (Math.round(n * 10000) / 10000).toString();
                    },
                    targets: [4]
                },
                { // Fecha
                    render: function (data) {
                        if (data) {
                            const date = new Date(data);
                            return moment(date, 'YYYY-MM-DD hh:mm').format('DD/MM/YYYY HH:mm');
                        }
                        return '';
                    },
                    targets: [8]
                }
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

            createdRow: function (row, rowData) {
                const idStr = String(rowData?.Id ?? '');
                if (idStr && _PI_selected.has(idStr)) {
                    row.classList.add('row-selected');
                }
            },

            initComplete: async function () {
                const api = this.api();

                // Filtros por columna
                columnConfig.forEach(async (config) => {
                    const cell = $('.filters th').eq(config.index);

                    if (config.filterType === 'text') {
                        $('<input type="text" placeholder="Buscar..." />')
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

                // KPIs
                actualizarKpisProveedorInsumos(data);

                // Selección por fila
                // ==================== Selección avanzada ====================
                let _PI_lastSelectedIndex = null;

                $('#grd_InsumosProveedor tbody')
                    .off('click.pi-select')
                    .on('click.pi-select', 'tr', function (e) {
                        if (_piIsActionClick(e)) return; // evita conflicto con botones internos

                        const row = gridInsumos.row(this);
                        const id = String(row?.data()?.Id ?? '');
                        if (!id) return;

                        const allRows = gridInsumos.rows({ order: 'applied', search: 'applied' }).nodes();
                        const currentIndex = Array.from(allRows).indexOf(this);

                        // SHIFT → seleccionar rango desde última fila seleccionada
                        if (e.shiftKey && _PI_lastSelectedIndex != null) {
                            const start = Math.min(_PI_lastSelectedIndex, currentIndex);
                            const end = Math.max(_PI_lastSelectedIndex, currentIndex);

                            _PI_selected.clear();
                            for (let i = start; i <= end; i++) {
                                const data = gridInsumos.row(allRows[i]).data();
                                if (data?.Id) _PI_selected.add(String(data.Id));
                            }
                        }
                        // CTRL → toggle individual sin limpiar
                        else if (e.ctrlKey || e.metaKey) {
                            if (_PI_selected.has(id)) _PI_selected.delete(id);
                            else _PI_selected.add(id);
                            _PI_lastSelectedIndex = currentIndex;
                        }
                        // CLICK normal → limpiar y seleccionar solo esta
                        else {
                            _PI_selected.clear();
                            _PI_selected.add(id);
                            _PI_lastSelectedIndex = currentIndex;
                        }

                        // Actualizar clases visuales
                        $(allRows).removeClass('row-selected');
                        for (const rid of _PI_selected) {
                            const rowNode = Array.from(allRows).find(r => gridInsumos.row(r).data()?.Id == rid);
                            if (rowNode) rowNode.classList.add('row-selected');
                        }

                        _piUpdateFAB();
                    });

                gridInsumos.on('draw', function () {
                    gridInsumos.rows().every(function () {
                        const id = String(this.data()?.Id ?? '');
                        const tr = this.node();
                        if (id && _PI_selected.has(id)) tr.classList.add('row-selected');
                        else tr.classList.remove('row-selected');
                    });
                    _piUpdateFAB();
                });

                $('#fabEliminarPI').off('click.pi-del').on('click.pi-del', async function () {
                    const ids = Array.from(_PI_selected).map(Number).filter(x => !isNaN(x));
                    if (ids.length === 0) return;

                    const ok = (typeof confirmarModal === 'function')
                        ? await confirmarModal(`¿Eliminar ${ids.length} insumo(s) seleccionados?`)
                        : window.confirm(`¿Eliminar ${ids.length} insumo(s) seleccionados?`);
                    if (!ok) return;

                   
                    const res = await fetch('/ProveedoresInsumos/EliminarMasivo', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': 'Bearer ' + token } : {})
                        },
                        body: JSON.stringify({ ids })
                    });

                    if (!res.ok) {
                        if (typeof errorModal === 'function') errorModal('No se pudo eliminar.');
                        return;
                    }
                    const j = await res.json();
                    if (j?.valor === true) {
                        _PI_selected.clear();
                        _piUpdateFAB();
                        if (typeof exitoModal === 'function') exitoModal('Eliminados correctamente.');
                        aplicarFiltros();
                    } else {
                        if (typeof errorModal === 'function') errorModal(j?.mensaje || 'La operación no pudo completarse.');
                    }
                });
            },
        });

    } else {
        gridInsumos.clear().rows.add(data).draw();
        actualizarKpisProveedorInsumos(data);

        gridInsumos.rows().every(function () {
            const id = String(this.data()?.Id ?? '');
            const tr = this.node();
            if (id && _PI_selected.has(id)) tr.classList.add('row-selected');
            else tr.classList.remove('row-selected');
        });
        _piUpdateFAB();
    }
}

function configurarOpcionesColumnas() {
    const grid = $('#grd_InsumosProveedor').DataTable();
    const columnas = grid.settings().init().columns;
    const container = $('#configColumnasMenu');
    const storageKey = `ProveedoresInsumos_Columnas`;
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    container.empty();

    columnas.forEach((col, i) => {
        if (!col.data || col.data === "Id" || i === 0) return;
        const isChecked = saved[`col_${i}`] !== undefined ? saved[`col_${i}`] : true;
        grid.column(i).visible(isChecked);
        container.append(`
            <li>
                <label class="dropdown-item">
                    <input type="checkbox" class="toggle-column" data-column="${i}" ${isChecked ? 'checked' : ''}>
                    ${col.data}
                </label>
            </li>`);
    });

    $('.toggle-column').on('change', function () {
        const idx = parseInt(this.dataset.column, 10);
        const show = this.checked;
        saved[`col_${idx}`] = show;
        localStorage.setItem(storageKey, JSON.stringify(saved));
        grid.column(idx).visible(show);
    });
}

/* ================== Importación Excel ================== */
function limpiarModalImportar() {
    document.getElementById('bloqueTabla').classList.add('d-none');
    document.getElementById('bloqueBuscador').classList.add('d-none');
    document.getElementById('resumenImportacion').classList.remove('mostrar');
    document.getElementById('resumenImportacion').classList.add('d-none');
    document.getElementById('resumenContainer').classList.add('d-none');
    document.querySelector('#vistaPrevia tbody').innerHTML = '';
    document.getElementById('errorImportar').classList.add('d-none');
    document.getElementById('buscadorVistaPrevia').value = '';
    listaInsumosArray = [];
}

async function cargarProveedores() {
    const data = await listaProveedoresFilter();
    const sel = document.getElementById('ProveedorImportar');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccione proveedor...</option>';
    data.forEach(p => {
        const o = document.createElement('option');
        o.value = p.Id; o.text = p.Nombre;
        sel.appendChild(o);
    });
}

function procesarArchivoSiCompleto() {
    const archivo = document.getElementById('archivoExcel').files[0];
    const idProv = document.getElementById('ProveedorImportar').value;
    limpiarModalImportar();
    if (archivo && idProv) procesarArchivo();
}

document.getElementById('modalImportar')?.addEventListener('shown.bs.modal', () => {
    document.getElementById('archivoExcel').value = '';
    document.getElementById('ProveedorImportar').value = '';
    document.querySelector('#vistaPrevia tbody').innerHTML = '';
    document.getElementById('comparandoLoader').classList.add('d-none');
    document.getElementById('errorImportar').classList.add('d-none');
    document.getElementById('btnImportar').disabled = false;
    document.getElementById('btnDescargarMaqueta').classList.remove('d-none');
    document.getElementById('archivoExcel').addEventListener('change', procesarArchivoSiCompleto, { once: false });
    document.getElementById('ProveedorImportar').addEventListener('change', procesarArchivoSiCompleto, { once: false });
    listaInsumosArray = [];
    cargarProveedores();
});

function descargarMaqueta() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([], { header: ["Código", "Descripción", "Precio Total", "% Desc", "Cantidad"] });
    XLSX.utils.book_append_sheet(wb, ws, "Insumos");
    XLSX.writeFile(wb, "maqueta-insumos.xlsx");
}

/** Lee hoja Excel: tolera cabeceras horizontales y “bloques” desplazados */
function extraerBloquesDesdeMatriz(hoja) {
    const A = XLSX.utils.sheet_to_json(hoja, {
        header: 1,
        blankrows: false,
        defval: '',
        raw: true
    });
    if (!Array.isArray(A) || A.length === 0) return [];

    const norm = s => String(s ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/\u00A0/g, ' ').trim();

    // -------- 1) Intento por NOMBRE --------
    let hdrRow = -1;
    let idx = { codigo: -1, descripcion: -1, precio: -1, porc: -1, cant: -1 };

    for (let r = 0; r < Math.min(A.length, 100); r++) {
        const row = A[r] || [];
        const names = row.map(norm);

        const iCod = names.findIndex(x => /\bcodigo\b/.test(x));
        const iDesc = names.findIndex(x => /\bdescripcion\b/.test(x));
        const iPrec = names.findIndex(x => /\bprecio(\s*total)?\b/.test(x));
        const iPorc = names.findIndex(x => /(%\s*desc|descuento|porc.*desc)/.test(x));
        const iCant = names.findIndex(x => /\bcantidad\b/.test(x));

        if (iDesc !== -1 && iPrec !== -1) {
            hdrRow = r;
            idx = { codigo: iCod, descripcion: iDesc, precio: iPrec, porc: iPorc, cant: iCant };
            break;
        }
    }

    // -------- 2) Si no encontró todo, plan B por TIPO --------
    if (hdrRow === -1) {
        // buscar primera fila con 3–6 celdas de texto (posible encabezado)
        for (let r = 0; r < Math.min(A.length, 8); r++) {
            const row = A[r] || [];
            const nonEmpty = row.filter(x => String(x ?? '').trim() !== '').length;
            if (nonEmpty >= 3) { hdrRow = r; break; }
        }
    }

    // inferir columnas por tipo en las 10 filas siguientes
    if (hdrRow !== -1 && (idx.precio < 0 || idx.porc < 0 || idx.cant < 0)) {
        const sample = A.slice(hdrRow + 1, hdrRow + 11).filter(r => Array.isArray(r));
        const cols = (A[hdrRow] || []).length;

        const score = { precio: new Array(cols).fill(0), porc: new Array(cols).fill(0), cant: new Array(cols).fill(0) };

        for (let c = 0; c < cols; c++) {
            for (const r of sample) {
                const v = r[c];
                const n = _parseNumberLoose(v);
                if (!isFinite(n)) continue;
                if (n >= 50) score.precio[c] += 2;     // precios grandes
                if (n >= 0 && n <= 100) score.porc[c] += 1; // porcentajes plausibles
                if (Number.isInteger(n)) score.cant[c] += 1; // cantidades enteras
            }
        }

        const argmax = arr => arr.reduce((bi, x, i, a) => x > a[bi] ? i : bi, 0);
        if (idx.precio < 0) idx.precio = argmax(score.precio);
        if (idx.porc < 0) idx.porc = argmax(score.porc);
        if (idx.cant < 0) idx.cant = argmax(score.cant);

        // intentar “Código” y “Descripción” como las dos primeras columnas con más texto
        if (idx.descripcion < 0 || idx.codigo < 0) {
            const textScore = new Array(cols).fill(0);
            for (let c = 0; c < cols; c++) {
                for (const r of sample) {
                    const s = String(r[c] ?? '').trim();
                    if (s && isNaN(Number(s))) textScore[c] += Math.min(s.length, 30);
                }
            }
            const top = [...textScore].map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => x[1]).sort((a, b) => a - b);
            if (idx.descripcion < 0) idx.descripcion = top[1] ?? top[0] ?? 1;
            if (idx.codigo < 0) idx.codigo = top[0] ?? 0;
        }
        if (hdrRow === -1) hdrRow = 0;
    }

    // lector tolerante: si “precio” es símbolo en una celda y número en la siguiente
    const leerPrecio = (row, i) => {
        if (i < 0) return NaN;
        const v1 = row[i];
        let n = parsearPrecio(v1);
        if (!Number.isFinite(n) && (i + 1) < row.length) {
            n = parsearPrecio(row[i + 1]);
        }
        return n;
    };

    const out = [];

    if (hdrRow !== -1) {
        for (let r = hdrRow + 1; r < A.length; r++) {
            const row = A[r] || [];

            const codigo = (idx.codigo >= 0 ? String(row[idx.codigo] ?? '').trim() : '');
            const desc = (idx.descripcion >= 0 ? String(row[idx.descripcion] ?? '').trim() : '');
            const precioTotal = leerPrecio(row, idx.precio);

            let porc = (idx.porc >= 0) ? parsearPorcentaje(row[idx.porc]) : 0;
            let cant = (idx.cant != null) ? _parseNumberLoose(row[idx.cant]) : 1;

            if (!Number.isFinite(porc) || porc < 0) porc = 0;
            if (!Number.isFinite(cant) || cant <= 0) cant = 1;

            const unitBruto = Number.isFinite(precioTotal) ? (precioTotal * cant) : NaN
            const unitNeto = Number.isFinite(unitBruto) ? (unitBruto * (1 - (porc / 100))) : NaN;

            // si la fila está vacía del todo, salteamos
            if (!codigo && !desc && !Number.isFinite(precioTotal)) continue;

            out.push({
                Codigo: codigo,
                Descripcion: desc,
                PrecioTotal: Number.isFinite(precioTotal) ? +precioTotal.toFixed(2) : NaN,
                PorcDesc: +porc.toFixed(2),
                Cantidad: +cant.toFixed(4),
                CostoUnitario: Number.isFinite(unitNeto) ? +unitNeto.toFixed(4) : 0
            });
        }
    }
    return out;
}


// ========================= Helpers nuevos =========================
/** Comparación robusta: tolerancia absoluta y relativa (por defecto 0.1% o 1e-4) */
function eqRelAbs(a, b, absTol = 1e-4, relTol = 0.001) {
    const na = Number(a), nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
    const diff = Math.abs(na - nb);
    const scale = Math.max(Math.abs(na), Math.abs(nb), 1); // evita dividir por 0
    return diff <= Math.max(absTol, relTol * scale);
}

/** Indexa la lista del backend (existentes) por código, descripción y combinación */
function buildIndexBackend(items) {
    const norm = s => normalizarClave(s ?? '').replace(/\s+/g, ' ').trim();
    const normCode = s => norm(s).replace(/[^a-z0-9]/gi, ''); // solo [a-z0-9]

    const byBoth = new Map();  // code||desc -> item
    const byCode = new Map();  // code -> item
    const byDesc = new Map();  // desc -> item

    (items || []).forEach(it => {
        const c = normCode(it.Codigo);
        const d = norm(it.Descripcion);
        if (c) byCode.set(c, it);
        if (d) byDesc.set(d, it);
        if (c || d) byBoth.set(`${c}||${d}`, it);
    });

    // estrategia de match
    const find = (codigo, desc) => {
        const c = normCode(codigo);
        const d = norm(desc);
        if (byBoth.has(`${c}||${d}`)) return byBoth.get(`${c}||${d}`);
        if (c && byCode.has(c)) return byCode.get(c);
        if (d && byDesc.has(d)) return byDesc.get(d);
        return null;
    };

    return { find };
}

// ========================= Reemplazar COMPLETO =========================
// ============ IMPORTAR Y COMPARAR (campo por campo) ============
// Reemplazá COMPLETO tu función por ésta.
// - Compara por (Código+Descripción) -> Descripción -> Código
// - No hace “cálculos lógicos” para decidir estado: compara campo a campo
// - Si difiere el unitario => cambio; si difiere %desc => cambio; si difiere cantidad => cambio;
//   si difiere el total (Costo) => cambio. Si todo igual => sin cambios. Si no hay match => nuevo.
// - “P. Anterior” muestra SIEMPRE el Total/Costo anterior del backend.
// - Tolerancias para evitar falsos positivos por redondeos.

// ============ IMPORTAR Y COMPARAR (campo por campo, robusto) ============
async function procesarArchivo() {
    const archivo = document.getElementById('archivoExcel').files[0];
    const idProveedor = document.getElementById('ProveedorImportar').value;

    // UI
    const loader = document.getElementById('comparandoLoader');
    const btnImportar = document.getElementById('btnImportar');
    const btnDescargar = document.getElementById('btnDescargarMaqueta');
    const errorBox = document.getElementById('errorImportar');
    const tbody = document.querySelector('#vistaPrevia tbody');
    const resumenDiv = document.getElementById('resumenImportacion');

    // ---------- Helpers ----------
    const epsTotal = 0.01;  // $0,01
    const epsUnit = 0.01;  // $0,01 (comparación “visible” a 2 decimales)
    const epsPorc = 0.00;  // 0,01%
    const epsCant = 1e-4;  // 0,0001

    const eq = (a, b, eps) => {
        const na = Number(a), nb = Number(b);
        if (!Number.isFinite(na) && !Number.isFinite(nb)) return true;     // ambos vacíos
        if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;    // uno vacío, otro no
        return Math.abs(na - nb) <= eps;
    };

    function _parseNumberLoose(v) {
        if (typeof v === 'number') return v;
        if (typeof v !== 'string') return NaN;
        let s = v.trim().replace(/\s+/g, '');
        s = s.replace('%', '');
        s = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); // miles/decimales
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : NaN;
    }
    const parsearPrecio = v => { const n = _parseNumberLoose(v); return Number.isFinite(n) ? n : NaN; };
    const parsearPorcentaje = v => { const n = _parseNumberLoose(v); return Number.isFinite(n) ? n : NaN; };
    const normBasic = s => (s ?? '').toString().trim().toLowerCase();
    const normCode = s => normBasic(s).replace(/[^a-z0-9]/g, '');
    const normDescKey = s => normBasic(s).replace(/\s+/g, ' ');
    function bagKey(s) {
        const t = normBasic(s).replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/).filter(Boolean).sort();
        return t.join('|');
    }
    function formatearPrecio(n) {
        try {
            return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);
        } catch { return '$ ' + (Number(n).toFixed(2)); }
    }

    if (!archivo || !idProveedor) {
        errorBox.textContent = "Seleccioná proveedor y archivo.";
        errorBox.classList.remove('d-none');
        return;
    }

    // Reset UI
    errorBox.classList.add('d-none');
    loader.classList.remove('d-none');
    btnImportar.disabled = true;
    btnDescargar.classList.add('d-none');
    tbody.innerHTML = '';
    listaInsumosArray = [];

    try {
        // 1) Excel (fuente de “nuevo”)
        const data = await archivo.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'buffer', cellNF: true, cellDates: true });
        const hoja = workbook.Sheets[workbook.SheetNames[0]];

        const desdeExcel = extraerBloquesDesdeMatriz(hoja); // {Codigo, Descripcion, PrecioTotal, PorcDesc, Cantidad, CostoUnitario?}
        if (!Array.isArray(desdeExcel) || desdeExcel.length === 0) {
            throw new Error("No se reconocieron columnas válidas (Código, Descripción, Precio, % Desc, Cantidad).");
        }

        // 2) Backend: traer LISTA EXISTENTE completa del proveedor (sin comparar)
        let existentes = [];
        try {
            const resp = await fetch('/ProveedoresInsumos/Comparar', {   // <- si tenés otro endpoint, cambialo acá
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + (token || ''), 'Content-Type': 'application/json' },
                body: JSON.stringify({ IdProveedor: parseInt(idProveedor), Lista: [] })
            });
            if (resp.ok) existentes = await resp.json();
        } catch { existentes = []; }

        // 3) Índices para matcheo
        const byCode = new Map(), byDesc = new Map(), byBag = new Map(), byBoth = new Map();
        for (const it of (existentes || [])) {
            const c = normCode(it.Codigo ?? '');
            const dk = normDescKey(it.Descripcion ?? '');
            const bk = bagKey(it.Descripcion ?? '');
            if (c) byCode.set(c, it);
            if (dk) byDesc.set(dk, it);
            if (bk) byBag.set(bk, it);
            byBoth.set(`${c}||${dk}`, it);
        }
        const findMatch = (x) => {
            const c = normCode(x.Codigo ?? '');
            const dk = normDescKey(x.Descripcion ?? '');
            const bk = bagKey(x.Descripcion ?? '');
            if (byBoth.has(`${c}||${dk}`)) return byBoth.get(`${c}||${dk}`);
            if (c && byCode.has(c)) return byCode.get(c);
            if (dk && byDesc.has(dk)) return byDesc.get(dk);
            if (bk && byBag.has(bk)) return byBag.get(bk);
            return null;
        };

        // 4) Comparación CAMPO POR CAMPO (sin deducir lógica con unitario derivado)
        const enr = desdeExcel.map(x => {
            // Nuevos (Excel)
            const nuevoTotal = parsearPrecio(x.PrecioTotal);
            const nuevoPorc = parsearPorcentaje(x.PorcDesc);
            const nuevaCant = _parseNumberLoose(x.Cantidad);
            let nuevoUnit = _parseNumberLoose(x.CostoUnitario);
            const unitNuevoFueProvisto = Number.isFinite(nuevoUnit);
            // Si no vino unitario, lo calculamos SOLO para mostrar y diferencias, NO para decidir cambios:
            if (!unitNuevoFueProvisto && Number.isFinite(nuevoTotal)) {
                const cOk = (Number.isFinite(nuevaCant) && nuevaCant > 0) ? nuevaCant : 1;
                const pOk = Number.isFinite(nuevoPorc) ? nuevoPorc : 0;
                nuevoUnit = (nuevoTotal / cOk) * (1 - (pOk / 100));
            }
            if (Number.isFinite(nuevoUnit)) nuevoUnit = Number(nuevoUnit.toFixed(2)); // comparar a 2 decimales

            // Anteriores (backend)
            const m = findMatch(x);
            const antTotal = m ? parsearPrecio(m.Costo ?? m.Precio ?? m.PrecioTotal) : NaN;
            let antUnit = m ? parsearPrecio(m.CostoUnitario) : NaN;
            const antPorc = m ? parsearPorcentaje(m.PorcDesc ?? m.Descuento) : 0;
            const antCant = m ? _parseNumberLoose(m.Cantidad) : NaN;
            if (Number.isFinite(antUnit)) antUnit = Number(antUnit.toFixed(2));

            // Igualdades (tratando vacíos como iguales a vacíos)
            const igualTot = eq(nuevoTotal, antTotal, epsTotal);
            const igualPorc = eq(nuevoPorc, antPorc, epsPorc);
            const igualCant = eq(nuevaCant, antCant, epsCant);

            let igualUnit = true; // por defecto NO rompe la igualdad si el Excel no lo trajo
            if (unitNuevoFueProvisto) {
                igualUnit = eq(nuevoUnit, antUnit, epsUnit);
            }

            const hayMatch = !!m;
            const hayCambio = hayMatch ? (!(igualTot && igualPorc && igualCant && igualUnit)) : false;
            let claseFila = 'fila-nueva-insumo';
            let difVal = NaN;
            let difPor = NaN;
            let claseDelta = '';

            if (hayMatch) {
                if (!hayCambio) {
                    claseFila = 'fila-sin-cambios';
                    difVal = 0; difPor = 0;
                } else {
                    claseFila = 'fila-modificada';
                    if (Number.isFinite(nuevoUnit) && Number.isFinite(antUnit)) {
                        difVal = +(nuevoUnit - antUnit);
                        difPor = (antUnit === 0 ? 0 : (difVal / antUnit) * 100);
                        claseDelta = difVal > 0 ? 'text-danger fw-bold' : (difVal < 0 ? 'text-success fw-bold' : '');
                    }
                }
            }

            return {
                Codigo: x.Codigo ?? '',
                Descripcion: x.Descripcion ?? '',

                _TotalAnterior: Number.isFinite(antTotal) ? +antTotal.toFixed(2) : NaN,

                _PrecioTotalExcel: Number.isFinite(nuevoTotal) ? +nuevoTotal.toFixed(2) : NaN,
                _PorcDescExcel: Number.isFinite(nuevoPorc) ? +nuevoPorc.toFixed(2) : NaN,
                _CantidadExcel: Number.isFinite(nuevaCant) ? +nuevaCant.toFixed(4) : NaN,

                _UnitAnterior: Number.isFinite(antUnit) ? +antUnit : NaN,
                _UnitNetoNuevo: Number.isFinite(nuevoUnit) ? +nuevoUnit : NaN,

                __difValor: Number.isFinite(difVal) ? difVal : NaN,
                __difPorc: Number.isFinite(difPor) ? difPor : NaN,
                __claseFila: hayMatch ? claseFila : 'fila-nueva-insumo',
                __claseCambio: claseDelta,

                // espejo para Importar()
                Costo: Number.isFinite(nuevoTotal) ? +nuevoTotal.toFixed(2) : NaN,
                PorcDesc: Number.isFinite(nuevoPorc) ? +nuevoPorc.toFixed(2) : NaN,
                Cantidad: Number.isFinite(nuevaCant) ? +nuevaCant.toFixed(4) : NaN,
                CostoUnitario: Number.isFinite(nuevoUnit) ? +nuevoUnit : NaN
            };
        });

        // 5) Render
        listaInsumosArray = enr;
        tbody.innerHTML = '';

        enr.forEach((item, idx) => {
            const tr = document.createElement('tr');
            tr.className = item.__claseFila;
            tr.dataset.idx = String(idx);

            const difTxt = Number.isFinite(item.__difValor) ? ((item.__difValor > 0 ? '+' : (item.__difValor < 0 ? '-' : '')) + formatearPrecio(Math.abs(item.__difValor))) : '-';
            const porcTxt = Number.isFinite(item.__difPorc) ? ((item.__difPorc > 0 ? '+' : (item.__difPorc < 0 ? '-' : '')) + Math.abs(item.__difPorc).toFixed(1) + '%') : '-';

            tr.innerHTML = `
        <td>
          <button class="btn btn-sm text-danger" onclick="eliminarFilaImportacion(this)" title="Eliminar insumo">
            <i class="fa fa-trash"></i>
          </button>
        </td>
        <td>${item.Codigo ?? ''}</td>
        <td><span title="${item.Descripcion ?? ''}">${item.Descripcion ?? ''}</span></td>

        <td>${Number.isFinite(item._TotalAnterior) ? formatearPrecio(item._TotalAnterior) : '-'}</td>

        <td>${vp_cellHTML('money', item._PrecioTotalExcel, Number.isFinite(item._PrecioTotalExcel) ? formatearPrecio(item._PrecioTotalExcel) : '-')}</td>
        <td>${vp_cellHTML('percent', item._PorcDescExcel, Number.isFinite(item._PorcDescExcel) ? `${item._PorcDescExcel.toFixed(2)}%` : '-')}</td>
        <td>${vp_cellHTML('qty', item._CantidadExcel, Number.isFinite(item._CantidadExcel) ? `${item._CantidadExcel}` : '')}</td>

        <td>${Number.isFinite(item._UnitNetoNuevo) ? formatearPrecio(item._UnitNetoNuevo) : '-'}</td>
        <td class="${item.__claseCambio}">${difTxt}</td>
        <td class="${item.__claseCambio}">${porcTxt}</td>
      `;
            tbody.appendChild(tr);
        });

        // 6) UI final
        document.getElementById('bloqueTabla').classList.remove('d-none');
        document.getElementById('bloqueBuscador').classList.remove('d-none');
        const resumenContainer = document.getElementById('resumenContainer');
        resumenContainer.classList.remove('d-none');
        resumenDiv.classList.remove('d-none');
        resumenDiv.style.display = 'block';

        if (typeof vistaPrevia_inicializarEdicion === 'function') {
            // deja editables: P.Total (Excel), %Desc, Cantidad
            vistaPrevia_inicializarEdicion();
        }
        if (typeof _vp_recalcResumen === 'function') _vp_recalcResumen();

    } catch (err) {
        console.error(err);
        errorBox.textContent = err?.message || "Error durante la comparación.";
        errorBox.classList.remove('d-none');
    }

    loader.classList.add('d-none');
    btnImportar.disabled = false;
    btnDescargar.classList.remove('d-none');
}

function _vp_recalcResumen() {
    const enr = Array.isArray(listaInsumosArray) ? listaInsumosArray : [];
    const subas = enr.filter(x => Number.isFinite(x._UnitAnterior) && x.CostoUnitario > x._UnitAnterior + 1e-6);
    const bajas = enr.filter(x => Number.isFinite(x._UnitAnterior) && x.CostoUnitario < x._UnitAnterior - 1e-6);
    const nuevos = enr.filter(x => !Number.isFinite(x._UnitAnterior)).length;

    const promSuba = subas.length
        ? subas.reduce((a, i) => a + ((i.CostoUnitario - i._UnitAnterior) / (i._UnitAnterior || 1)), 0) / subas.length
        : 0;

    const promBaja = bajas.length
        ? bajas.reduce((a, i) => a + ((i._UnitAnterior - i.CostoUnitario) / (i._UnitAnterior || 1)), 0) / bajas.length
        : 0;

    const r = document.getElementById('resumenImportacion');
    if (!r) return;

    let html = `
        Se han registrado <strong>${nuevos}</strong> <span class="text-primary fw-bold">nuevos insumos</span>.<br>
        Se han registrado <strong>${subas.length}</strong> insumos con <span class="text-danger fw-bold">aumento de precio unitario</span>.<br>
        Se han registrado <strong>${bajas.length}</strong> insumos con <span class="text-success fw-bold">baja de precio unitario</span>.<br>
        <hr class="my-1">
        Promedio de aumento: <strong class="text-danger">${(promSuba * 100).toFixed(1)}%</strong><br>
        Promedio de baja: <strong class="text-success">${(promBaja * 100).toFixed(1)}%</strong><br>`;
    html += promBaja > promSuba
        ? `<div class="mt-2"><i class="fa fa-arrow-down text-success"></i> La baja promedio supera al aumento promedio.</div>`
        : promSuba > promBaja
            ? `<div class="mt-2"><i class="fa fa-arrow-up text-danger"></i> El aumento promedio supera a la baja promedio.</div>`
            : `<div class="mt-2"><i class="fa fa-balance-scale text-secondary"></i> Las subas y bajas se equilibran.</div>`;

    r.innerHTML = html;
}

function pintarVistaPrevia(list) {
    const tbody = document.querySelector('#vistaPrevia tbody');
    tbody.innerHTML = '';
    list.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.idx = String(idx);
        tr.className = item.__claseFila;

        const unitAnt = item._UnitAnterior;
        const total = item.PrecioTotal;
        const porcOK = item.PorcDesc;
        const cantOK = item.Cantidad;
        const unitNuevo = item.CostoUnitario;

        let difTxt = '-', porcTxt = '-';
        if (Number.isFinite(item.__difValor)) {
            const sign = item.__difValor > 0 ? '+' : '-';
            difTxt = sign + formatearPrecio(Math.abs(item.__difValor));
            porcTxt = sign + Math.abs(item.__difPorc).toFixed(1) + '%';
        }

        tr.innerHTML = `
            <td>${item.Codigo ?? ''}</td>
            <td>
              <button class="btn btn-sm text-danger me-2" onclick="eliminarFilaImportacion(this)" title="Eliminar insumo">
                <i class="fa fa-trash"></i>
              </button>
              <span title="${item.Descripcion ?? ''}">${item.Descripcion ?? ''}</span>
            </td>
            <td>${Number.isFinite(unitAnt) ? formatearPrecio(unitAnt) : '-'}</td>
            <td>${vp_cellHTML('money', Number.isFinite(total) ? total : NaN, Number.isFinite(total) ? formatearPrecio(total) : '-')}</td>
            <td>${vp_cellHTML('percent', Number.isFinite(porcOK) ? porcOK : 0, `${Number.isFinite(porcOK) ? porcOK.toFixed(2) : '0.00'}%`)}</td>
            <td>${vp_cellHTML('qty', Number.isFinite(cantOK) ? cantOK : 1, `${Number.isFinite(cantOK) ? cantOK : 1}`)}</td>
            <td>${Number.isFinite(unitNuevo) ? formatearPrecio(unitNuevo) : '-'}</td>
            <td class="${item.__claseCambio}">${difTxt}</td>
            <td class="${item.__claseCambio}">${porcTxt}</td>
        `;
        tbody.appendChild(tr);
    });

    vistaPrevia_inicializarEdicion();
}

function eliminarFilaImportacion(btn) {
    const tr = btn.closest('tr');
    const idx = parseInt(tr?.dataset?.idx || '-1', 10);
    if (idx >= 0) {
        listaInsumosArray.splice(idx, 1);
        tr.remove();
        Array.from(document.querySelectorAll('#vistaPrevia tbody tr')).forEach((row, i) => row.dataset.idx = String(i));
        _vp_recalcResumen();
    }
}

/* ===== Edición inline (lápiz) en Total / %Desc / Cantidad ===== */
function vistaPrevia_inicializarEdicion() {
    const tbody = document.querySelector('#vistaPrevia tbody');
    if (!tbody) return;

    // Reindexar
    Array.from(tbody.querySelectorAll('tr')).forEach((tr, i) => tr.dataset.idx = String(i));

    // Evitar enlazar 2 veces
    if (tbody._vpBound) return;
    tbody._vpBound = true;

    // Doble click en la celda -> entrar en edición (solo col 4,5,6)
    tbody.addEventListener('dblclick', (e) => {
        const td = e.target.closest('td'); const tr = e.target.closest('tr');
        if (!td || !tr) return;
        const col = Array.from(tr.children).indexOf(td);
        if (![4, 5, 6].includes(col)) return;     // columnas editables correctas
        vp_enterEdit(td);
    });

    // Click en iconos (lápiz / check / X)
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-ico');
        if (!btn) return;
        const td = e.target.closest('td'); const tr = e.target.closest('tr');
        if (!td || !tr) return;
        const idx = parseInt(tr.dataset.idx || '-1', 10);
        const col = Array.from(tr.children).indexOf(td);

        if (btn.classList.contains('vp-edit')) {
            vp_enterEdit(td);
        } else if (btn.classList.contains('vp-accept')) {
            const input = td.querySelector('.vp-input');
            _vp_commitUI(td, tr, idx, col, input ? input.value : '');
        } else if (btn.classList.contains('vp-cancel')) {
            vp_leaveEdit(td);
        }
    });

    // Enter / Escape dentro del input
    tbody.addEventListener('keydown', (e) => {
        if (!e.target.classList.contains('vp-input')) return;
        const td = e.target.closest('td'); const tr = e.target.closest('tr');
        const idx = parseInt(tr?.dataset?.idx || '-1', 10);
        const col = Array.from(tr.children).indexOf(td);
        if (e.key === 'Enter') { e.preventDefault(); _vp_commitUI(td, tr, idx, col, e.target.value); }
        if (e.key === 'Escape') { e.preventDefault(); vp_leaveEdit(td); }
    });
}
function vp_cellHTML(type, raw, txt) {
    return `
    <div class="vp-cell" data-type="${type}">
      <span class="vp-val">${txt}</span>
      <input class="vp-input d-none" type="text" value="${Number.isFinite(raw) ? String(raw) : ''}">
      <span class="vp-ctrl">
        <button type="button" class="btn-ico vp-edit" title="Editar"><i class="fa fa-pencil"></i></button>
        <button type="button" class="btn-ico vp-accept d-none" title="Guardar"><i class="fa fa-check"></i></button>
        <button type="button" class="btn-ico vp-cancel d-none" title="Cancelar"><i class="fa fa-times"></i></button>
      </span>
    </div>`;
}

function vp_cellHTML(type, raw, txt) {
    // data-type solo por si querés formatear distinto según type
    return `
    <div class="vp-cell" data-type="${type}">
      <span class="vp-val">${txt}</span>
      <input class="vp-input d-none" type="text" value="${Number.isFinite(raw) ? String(raw) : ''}">
      <span class="vp-ctrl">
        <button type="button" class="btn-ico vp-edit" title="Editar"><i class="fa fa-pencil"></i></button>
        <button type="button" class="btn-ico vp-accept d-none" title="Guardar"><i class="fa fa-check"></i></button>
        <button type="button" class="btn-ico vp-cancel d-none" title="Cancelar"><i class="fa fa-times"></i></button>
      </span>
    </div>`;
}

function vp_enterEdit(td) {
    const cell = td.querySelector('.vp-cell'); if (!cell) return;
    const val = cell.querySelector('.vp-val');
    const input = cell.querySelector('.vp-input');
    const bEdit = cell.querySelector('.vp-edit');
    const bOk = cell.querySelector('.vp-accept');
    const bNo = cell.querySelector('.vp-cancel');

    val.classList.add('d-none');
    input.classList.remove('d-none');
    bEdit.classList.add('d-none');
    bOk.classList.remove('d-none');
    bNo.classList.remove('d-none');

    input.focus(); input.select();
}

function vp_leaveEdit(td) {
    const cell = td.querySelector('.vp-cell'); if (!cell) return;
    const val = cell.querySelector('.vp-val');
    const input = cell.querySelector('.vp-input');
    const bEdit = cell.querySelector('.vp-edit');
    const bOk = cell.querySelector('.vp-accept');
    const bNo = cell.querySelector('.vp-cancel');

    input.classList.add('d-none');
    val.classList.remove('d-none');
    bOk.classList.add('d-none');
    bNo.classList.add('d-none');
    bEdit.classList.remove('d-none');
}

function _vp_commitUI(td, tr, idx, col, rawVal) {
    const item = listaInsumosArray[idx];
    if (!item) { vp_leaveEdit(td); return; }

    // Las columnas editables son 4 (Total), 5 (%Desc) y 6 (Cantidad)
    if (col === 4) {                 // P.Total
        const n = parsearPrecio(rawVal);
        if (!Number.isFinite(n) || n < 0) { vp_leaveEdit(td); return; }
        item.PrecioTotal = +n.toFixed(2);
        item._PrecioTotalExcel = item.PrecioTotal;   // mantener espejado
    } else if (col === 5) {          // % Desc
        let p = parsearPorcentaje(rawVal);
        if (!Number.isFinite(p) || p < 0) p = 0;
        item.PorcDesc = +p.toFixed(2);
        item._PorcDescExcel = item.PorcDesc;
    } else if (col === 6) {          // Cantidad
        let c = _parseNumberLoose(rawVal);
        if (!Number.isFinite(c) || c <= 0) c = 1;
        item.Cantidad = +c.toFixed(4);
        item._CantidadExcel = item.Cantidad;
    }

    // Recalcular unitario neto y difs
    const cant = (Number(item.Cantidad) > 0) ? Number(item.Cantidad) : 1;
    const total = Number(item.PrecioTotal) || 0;
    const porc = Number(item.PorcDesc) || 0;

    const unitBruto = total / cant;
    item.CostoUnitario = +(unitBruto * (1 - (porc / 100))).toFixed(4);
    item._UnitNetoNuevo = item.CostoUnitario; // espejo

    if (Number.isFinite(item._UnitAnterior)) {
        const dif = item.CostoUnitario - item._UnitAnterior;
        item.__difValor = dif;
        item.__difPorc = (item._UnitAnterior === 0 ? 0 : (dif / item._UnitAnterior) * 100);
    } else {
        item.__difValor = NaN;
        item.__difPorc = NaN;
    }

    _vp_renderRow(tr, item);
    _vp_recalcResumen();
}

function _vp_renderRow(tr, item) {
    const tds = tr.children;

    const unitAnt = Number.isFinite(item._UnitAnterior) ? item._UnitAnterior : NaN;
    const total = Number.isFinite(item.PrecioTotal) ? item.PrecioTotal : NaN;
    const porcOK = Number.isFinite(item.PorcDesc) ? item.PorcDesc : 0;
    const cant = _parseNumberLoose(item.Cantidad);
    const cantOK = (Number.isFinite(cant) && cant > 0) ? cant : 1;
    const unitNew = Number.isFinite(item.CostoUnitario) ? item.CostoUnitario : NaN;
    const dif = Number.isFinite(item.__difValor) ? item.__difValor : NaN;
    const difPorc = Number.isFinite(item.__difPorc) ? item.__difPorc : NaN;

    tr.classList.remove('fila-modificada', 'fila-sin-cambios', 'fila-nueva-insumo');
    let claseCambio = '';
    if (!Number.isFinite(unitAnt)) {
        tr.classList.add('fila-nueva-insumo');
    } else if (Math.abs(dif) < 1e-6) {
        tr.classList.add('fila-sin-cambios');
    } else {
        tr.classList.add('fila-modificada');
        claseCambio = dif > 0 ? 'text-danger fw-bold' : 'text-success fw-bold';
    }

    // IMPORTANTE: escribir en los índices correctos
    tds[3].textContent = Number.isFinite(unitAnt) ? formatearPrecio(unitAnt) : '-'; // P.Anterior
    tds[4].innerHTML = vp_cellHTML('money', total, Number.isFinite(total) ? formatearPrecio(total) : '-'); // Total
    tds[5].innerHTML = vp_cellHTML('percent', porcOK, `${porcOK.toFixed(2)}%`);                                 // %Desc
    tds[6].innerHTML = vp_cellHTML('qty', cantOK, `${cantOK}`);                                             // Cantidad
    tds[7].textContent = Number.isFinite(unitNew) ? formatearPrecio(unitNew) : '-';                               // Unit Neto

    const difTxt = Number.isFinite(dif) ? ((dif > 0 ? '+' : '-') + formatearPrecio(Math.abs(dif))) : '-';
    const porcTxt = Number.isFinite(difPorc) ? ((difPorc > 0 ? '+' : '-') + Math.abs(difPorc).toFixed(1) + '%') : '-';

    tds[8].className = ' ' + (claseCambio || '');
    tds[8].textContent = difTxt;

    tds[9].className = ' ' + (claseCambio || '');
    tds[9].textContent = porcTxt;
}

function filtrarVistaPrevia() {
    const q = (document.getElementById('buscadorVistaPrevia')?.value || '').toLowerCase();
    document.querySelectorAll('#vistaPrevia tbody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

function toggleResumen() {
    const r = document.getElementById('resumenImportacion');
    const icon = document.getElementById('iconoResumen');
    const btn = document.getElementById('btnToggleResumen');
    const vis = r.classList.contains('mostrar');
    if (vis) {
        r.classList.remove('mostrar'); icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down');
        btn.innerHTML = `<i class="fa fa-chevron-down me-1" id="iconoResumen"></i> Ver promedios`;
    } else {
        r.classList.add('mostrar'); icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up');
        btn.innerHTML = `<i class="fa fa-chevron-up me-1" id="iconoResumen"></i> Ocultar promedios`;
    }
}

async function enviarDatos() {
    const idProveedor = document.getElementById('ProveedorImportar').value;
    const errorBox = document.getElementById('errorImportar');

    if (!idProveedor || !Array.isArray(listaInsumosArray) || listaInsumosArray.length === 0) {
        errorBox.textContent = "Debe seleccionar un proveedor y cargar al menos un insumo.";
        errorBox.classList.remove('d-none');
        return;
    }

    const lista = listaInsumosArray.map(x => {
        // Parseos robustos (aceptan "0.5" y "0,5")
        const cantRaw = _parseNumberLoose(x.Cantidad);
        const cant = (Number.isFinite(cantRaw) && cantRaw > 0) ? cantRaw : 1;

        const descRaw = _parseNumberLoose(x.PorcDesc);
        const porcDesc = (Number.isFinite(descRaw) && descRaw >= 0) ? descRaw : 0;

        const costoRaw = _parseNumberLoose(x.Costo);
        const costo = (Number.isFinite(costoRaw) && costoRaw > 0) ? costoRaw : 1;

        let unit = _parseNumberLoose(x.CostoUnitario);

        // Si no vino unitario válido, lo calculo desde total y %desc
        if (!Number.isFinite(unit)) {
            const totalRaw = _parseNumberLoose(x.PrecioTotal);
            const total = Number.isFinite(totalRaw) ? totalRaw : 0;
            const factor = 1 - ((Number.isFinite(descRaw) ? descRaw : 0) / 100);
            const unitBruto = (cant > 0) ? (total / cant) : NaN;
            unit = unitBruto * factor;
        }

        return {
            Codigo: x.Codigo ?? '',
            Descripcion: x.Descripcion ?? '',
            CostoUnitario: Number.isFinite(unit) ? +unit.toFixed(4) : 0,
            Costo: Number.isFinite(costo) ? +costo.toFixed(4) : 0,
            Cantidad: Number.isFinite(cant) ? +cant.toFixed(4) : 1,
            PorcDesc: Number.isFinite(porcDesc) ? +porcDesc.toFixed(4) : 0
        };
    }).filter(it => it.Descripcion && Number.isFinite(it.CostoUnitario));

    if (lista.length === 0) {
        errorBox.textContent = "Los datos a importar no son válidos (verificá precios / cantidades).";
        errorBox.classList.remove('d-none');
        return;
    }

    const payload = { IdProveedor: parseInt(idProveedor), Lista: lista };

    try {
        const resp = await fetch('/ProveedoresInsumos/Importar', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + (token || ''),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error(await resp.text() || "Error en la solicitud.");
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

/* ================== Boot ================== */
$(document).ready(() => {
    // recalcular en vivo el unitario del modal
    ['txtCosto', 'txtCantidad', 'txtPorcDesc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) ['input', 'change', 'blur'].forEach(evt => el.addEventListener(evt, recalcularCostoUnitario));
    });

    bootstrapFiltroProveedor().then(aplicarFiltros);
});


/* ================== Selección múltiple en grilla principal ================== */
// Estado global ya lo tenés:
/// const _PI_selected = new Set();
/// let _PI_lastSelectedIndex = null;

function _piRowKey(row) { return Number(row?.Id); }

function _piUpdateHeaderCheckbox() {
    const th = document.querySelector('#grd_InsumosProveedor thead th .pi-check-all');
    if (!th) return;
    const dt = $('#grd_InsumosProveedor').DataTable();
    const ids = dt.rows({ search: 'applied' }).data().toArray().map(r => r.Id);
    if (ids.length === 0) { th.indeterminate = false; th.checked = false; return; }
    const selectedOnPage = ids.filter(id => _PI_selected.has(id)).length;
    th.checked = selectedOnPage === ids.length;
    th.indeterminate = selectedOnPage > 0 && selectedOnPage < ids.length;
}

function _piSyncRowCheckboxes() {
    $('#grd_InsumosProveedor tbody tr').each(function () {
        const id = Number($(this).attr('id')); // rowId = 'Id'
        const chk = this.querySelector('.pi-check-row');
        if (chk) chk.checked = _PI_selected.has(id);
        this.classList.toggle('row-selected', _PI_selected.has(id));
    });
    _piUpdateHeaderCheckbox();

    // actualizar FAB/botón si existiera
    const b = document.getElementById('fabEliminarPI');
    if (b) {
        const c = _PI_selected.size;
        b.disabled = c === 0;
        const badge = b.querySelector('.count-badge');
        if (badge) badge.textContent = String(c);
    }
}

function _piToggleRow(id, checked) {
    if (checked) _PI_selected.add(id); else _PI_selected.delete(id);
    _piSyncRowCheckboxes();
}

function _piToggleAll(checked) {
    const dt = $('#grd_InsumosProveedor').DataTable();
    dt.rows({ search: 'applied' }).every(function () {
        const r = this.data(); if (!r) return;
        if (checked) _PI_selected.add(r.Id); else _PI_selected.delete(r.Id);
    });
    _piSyncRowCheckboxes();
}

async function piDeleteSelected() {
    if (_PI_selected.size === 0) return;
    const ok = confirm(`¿Eliminar ${_PI_selected.size} insumo(s) seleccionados?`);
    if (!ok) return;

    const ids = Array.from(_PI_selected);

    // Intentar endpoint masivo; si no existe, caer en DELETE por id
    try {
        const resp = await fetch('/ProveedoresInsumos/EliminarVarios', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + (token || ''), 'Content-Type': 'application/json' },
            body: JSON.stringify({ Ids: ids })
        });
        if (!resp.ok) throw new Error('fallback');
        const j = await resp.json();
        if (!j?.valor) throw new Error(j?.mensaje || 'No se pudieron eliminar.');
    } catch {
        // fallback uno a uno
        for (const id of ids) {
            try {
                const r = await fetch('ProveedoresInsumos/Eliminar?id=' + id, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + (token || '') }
                });
                if (!r.ok) console.warn('No se pudo eliminar id', id);
            } catch (e) { console.warn(e); }
        }
    }

    _PI_selected.clear();
    await aplicarFiltros();
    exitoModal('Eliminación completada.');
}

function piClearSelection() {
    _PI_selected.clear();
    _piSyncRowCheckboxes();
}


// --- Normalización fuerte para matching por descripción ---
function _normBasic(s) {
    return String(s ?? '')
        .normalize('NFKD')                          // más agresivo que NFD
        .replace(/[\u0300-\u036f]/g, '')            // quita tildes
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')          // deja letras/números/espacios
        .replace(/\s+/g, ' ')                       // colapsa espacios
        .trim()
        .toLowerCase();
}

// Clave "compacta" para descripciones: sin puntuación, sin espacios, unificación de unidades
function normDescKey(s) {
    let t = _normBasic(s);
    // Unificar formatos de unidades, comas/puntos
    t = t.replace(/[,]+/g, '.')       // 2,25L → 2.25L
        .replace(/\b(litros?|lts?)\b/g, 'l')
        .replace(/\b(mililitros?|mls?)\b/g, 'ml')
        .replace(/\s+/g, '')
        .trim();
    return t;
}
// Clave "bolsa de tokens" para segundas chances (ordena palabras)
function bagKey(s) {
    let t = _normBasic(s);
    const stop = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'por', 'x', 'pack']);
    return t.split(/\s+/)
        .filter(w => w && !stop.has(w))
        .sort()
        .join('|');
}
