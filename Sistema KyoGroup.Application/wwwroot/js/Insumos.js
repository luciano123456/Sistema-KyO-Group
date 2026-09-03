/* =============================================================
 * Insumos.js (FULL) ? adaptado a header KPI + filtros
 * Sin remover nada. Agrega KPIs + filtros top + token en fetch.
 * ============================================================= */

let gridInsumos;
let isEditing = false;

const columnConfig = [
    { index: 2, filterType: 'text' },
    { index: 3, filterType: 'text' },
    { index: 4, filterType: 'text' },
    { index: 5, filterType: 'select', fetchDataFunc: listaUnidadesMedidaFilter },
    { index: 6, filterType: 'select', fetchDataFunc: listaInsumosCategoriaFilter },
    { index: 7, filterType: 'text' },
    { index: 8, filterType: 'text' },
    { index: 9, filterType: 'text' },
];

let unidadesNegocioSeleccionados = [];
let ProveedoresAsignados = [];

/* ==========================
 * Helpers formateo / num
 * ========================== */
function _num(n) { return parseFloat(n) || 0; }
function formatNumber(n) {
    try {
        const val = _num(n);
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(val);
    } catch {
        const v = Math.round(_num(n) * 100) / 100;
        return '$' + v.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    }
}

/* ==========================
 * KPIs (NUEVO)
 * ========================== */
function actualizarKpisInsumos(data) {
    const arr = Array.isArray(data) ? data : [];
    const total = arr.length;
    let conProv = 0, sinProv = 0;
    let sumaCosto = 0, countCosto = 0;

    for (const r of arr) {
        const cantProv = _num(r.CantidadProveedores);
        if (cantProv > 0) conProv++; else sinProv++;

        const cu = _num(r.CostoUnitario);
        if (cu > 0) { sumaCosto += cu; countCosto++; }
    }

    const promedio = countCosto > 0 ? (sumaCosto / countCosto) : 0;

    const elTot = document.getElementById('kpiCantInsumos');
    const elSin = document.getElementById('kpiSinProveedor');

    if (elTot) elTot.textContent = total;
    if (elSin) elSin.textContent = sinProv;
}

/* ==========================
 * READY
 * ========================== */
$(document).ready(() => {

    // Cargar opciones del filtro top y luego grilla server-side
    _cargarFiltrosInsumos().then(() => {
        initInsumosGrid();
        cargarKpisInsumos();
    });

    // Inicializar combos, validaciones del form de edición
    document.querySelectorAll("#formInsumo input, #formInsumo select, #formInsumo textarea, #btnUnidadesNegocio").forEach(el => {
        el.setAttribute("autocomplete", "off");
        el.addEventListener("input", () => validarCampoIndividual(el));
        el.addEventListener("change", () => validarCampoIndividual(el));
        el.addEventListener("blur", () => validarCampoIndividual(el));
    });

    document.querySelectorAll(".unidades-check").forEach(cb => {
        cb.addEventListener("change", function () {
            actualizarTextoUnidadesNegocio();
            validarCampoIndividual(document.getElementById("btnUnidadesNegocio"));
        });
    });

    document.getElementById("btnUnidadesNegocio")?.addEventListener("blur", function () {
        validarCampoIndividual(this);
    });


    // Carga de listas para el modal (cuando corresponda)
    listaUnidadesNegocio();
});

/* ============================================================
 * CRUD / Guardado
 * ============================================================ */
function guardarCambios() {
    if (!validarCampos()) return;

    return withBusy("#btnGuardar", () => {
        const idInsumo = $("#txtId").val();

        const esNuevo = !idInsumo || idInsumo === "0";
        const nuevoModelo = {
            Id: esNuevo ? 0 : parseInt(idInsumo),
            Descripcion: $("#txtDescripcion").val(),
            Sku: $("#txtSku").val(),
            IdUnidadMedida: parseInt($("#UnidadesMedida").val()),
            IdCategoria: parseInt($("#Categorias").val()),
            InsumosUnidadesNegocios: unidadesNegocioSeleccionados.map(id => ({ IdUnidadNegocio: id })),
            InsumosProveedores: ProveedoresAsignados.map(p => ({
                IdProveedor: p.IdProveedor,
                IdListaProveedor: p.IdListaProveedor
            }))
        };

        const url = esNuevo ? "/Insumos/Insertar" : "/Insumos/Actualizar";
        const method = esNuevo ? "POST" : "PUT";

        return fetch(url, {
            method,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(async response => {
                const data = await response.json();

                if (data.valor == false && data.mensaje != null) {
                    errorModal(data.mensaje);
                    return;
                } else if (data.valor == false) {
                    errorModal("El insumo no se ha podido guardar correctamente");
                    return;
                }

                if (!esNuevo) {
                    if (typeof bsHide === 'function') bsHide('#modalEdicion');
                    else $('#modalEdicion').modal('hide');
                } else {
                    limpiarModal();
                    seleccionarTodasUN();
                }

                exitoModal(data.mensaje || "Insumo guardado correctamente");

                if (typeof aplicarFiltros === 'function') aplicarFiltros();
                else aplicarFiltrosInsumos();

            })
            .catch(error => {
                errorModal(error.message);
                console.error('Error:', error);
            });
    });
}

async function nuevoInsumo() {
    try {
        limpiarModal();
        await listaUnidadesNegocio(true);
        await listaUnidadesMedida();
        await listaInsumosCategoria();

        if (typeof bsShow === 'function') bsShow('#modalEdicion');
        else $('#modalEdicion').modal('show');

        $("#btnGuardar").text("Registrar");
        $("#modalEdicionLabel").text("Nuevo Insumo");
    } catch (err) {
        console.error(err);
        errorModal(err?.message || "No se pudo abrir el alta de insumo.");
    }
}

function seleccionarTodasUN() {
    const master = document.getElementById('checkTodosUnidades');
    if (master) {
        master.checked = true;
        master.dispatchEvent(new Event('change', { bubbles: true }));
    }
}




async function mostrarModal(modelo) {
    try {
        limpiarModal();

        const idVal = modelo?.Id && Number(modelo.Id) > 0 ? modelo.Id : "";
        $("#txtId").val(idVal);
        $("#txtSku").val(modelo?.Sku ?? "");
        $("#txtDescripcion").val(modelo?.Descripcion ?? "");

        await listaUnidadesNegocio();
        await listaUnidadesMedida();
        await listaInsumosCategoria();
        setInfoAuditoria(modelo);

        const idCat = modelo?.IdCategoria ?? "";
        const idUm = modelo?.IdUnidadMedida ?? "";
        if (window.KyoSelect2?.setValue) {
            KyoSelect2.setValue(document.getElementById('Categorias'), idCat);
            KyoSelect2.setValue(document.getElementById('UnidadesMedida'), idUm);
        } else {
            const cat = document.getElementById("Categorias");
            const um = document.getElementById("UnidadesMedida");
            if (cat) cat.value = String(idCat);
            if (um) um.value = String(idUm);
            $("#Categorias").trigger('change');
            $("#UnidadesMedida").trigger('change');
        }

        const unidades = unwrapJsonList(modelo?.InsumosUnidadesNegocios || modelo?.insumosUnidadesNegocios);
        const idsUnidades = unidades.map(x => parseInt(x.IdUnidadNegocio ?? x.idUnidadNegocio)).filter(n => Number.isFinite(n));
        unidadesNegocioSeleccionados = [];

        document.querySelectorAll(".unidades-check").forEach(cb => {
            const id = parseInt(cb.value);
            const seleccionado = idsUnidades.includes(id);
            cb.checked = seleccionado;
            if (seleccionado) unidadesNegocioSeleccionados.push(id);
        });

        actualizarTextoUnidadesNegocio();

        const proveedores = unwrapJsonList(modelo?.InsumosProveedores || modelo?.insumosProveedores);
        ProveedoresAsignados = proveedores.map(x => ({
            IdInsumo: x.IdInsumo ?? x.idInsumo,
            IdProveedor: x.IdProveedor ?? x.idProveedor,
            IdListaProveedor: x.IdListaProveedor ?? x.idListaProveedor
        }));
        actualizarBadgeProveedoresAsignados();

        if (typeof bsShow === 'function') bsShow('#modalEdicion');
        else $('#modalEdicion').modal('show');
        $("#btnGuardar").text(idVal ? "Guardar" : "Registrar");
        $("#modalEdicionLabel").text(idVal ? "Editar Insumo" : "Duplicar Insumo");
    } catch (err) {
        console.error(err);
        errorModal(err?.message || "No se pudo abrir el insumo.");
    }
}

function unwrapJsonList(data) {
    if (data == null) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.$values)) return data.$values;
    if (Array.isArray(data.values)) return data.values;
    return [];
}

/* ============================================================
 * Filtros Top (NUEVO) + compatibilidad con tu aplicarFiltros()
 * ============================================================ */
function _defaultUnidadNegocio() { return '-1'; }

async function _cargarFiltrosInsumos() {
    const data = await listaUnidadesNegocioFilter();
    const sel = document.getElementById("UnidadNegocioFiltro");
    if (!sel) return;

    sel.innerHTML = "";
    const opAll = document.createElement("option");
    opAll.value = "-1";
    opAll.textContent = "Todos";
    sel.appendChild(opAll);

    data.forEach(x => {
        const op = document.createElement("option");
        op.value = x.Id;
        op.textContent = x.Nombre;
        sel.appendChild(op);
    });

    // Si tenés Select2 disponible
    if (window.$ && typeof $().select2 === 'function') {
        $("#UnidadNegocioFiltro").select2({ placeholder: "Todos", allowClear: false, width: "100%" });
    }
}

async function aplicarFiltrosInsumos() {
    if (gridInsumos) {
        kyoGridReload(gridInsumos);
    } else {
        await initInsumosGrid();
    }
    await cargarKpisInsumos();
}

// Wrapper para no romper llamadas existentes
async function aplicarFiltros() {
    await aplicarFiltrosInsumos();
}

async function limpiarFiltrosInsumos() {
    const sel = document.getElementById("UnidadNegocioFiltro");
    if (sel) {
        sel.value = _defaultUnidadNegocio();
        if (window.$ && typeof $().select2 === 'function') {
            $("#UnidadNegocioFiltro").val(_defaultUnidadNegocio()).trigger('change.select2');
        }
    }

    // Limpiar filtros de columnas (thead clonado)
    if (window.gridInsumos) {
        const api = $('#grd_Insumos').DataTable();
        $('#grd_Insumos thead tr.filters th input').each(function () { this.value = ''; });
        $('#grd_Insumos thead tr.filters th select').each(function () { $(this).val('').trigger('change.select2'); });
        api.columns().search('').draw();
    }

    await aplicarFiltrosInsumos();
}

/* ============================================================
 * Data fetch
 * ============================================================ */
async function aplicarFiltrosOldCompat() { // (por si lo llamabas en algún lado)
    return aplicarFiltrosInsumos();
}

async function cargarKpisInsumos() {
    const un = document.getElementById("UnidadNegocioFiltro")?.value || _defaultUnidadNegocio();
    try {
        const response = await fetch(`/Insumos/Kpis?IdUnidadNegocio=${un}`, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        const elTot = document.getElementById('kpiCantInsumos');
        const elSin = document.getElementById('kpiSinProveedor');
        if (elTot) elTot.textContent = data.total ?? 0;
        if (elSin) elSin.textContent = data.sinProveedor ?? 0;
    } catch { /* KPIs opcionales */ }
}

async function listaInsumos(UnidadNegocio) {
    await aplicarFiltrosInsumos();
}

const editarInsumo = id => {
    fetch("/Insumos/EditarInfo?id=" + id, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
        .then(async response => {
            if (!response.ok) throw new Error("No se pudo cargar el insumo.");
            const dataJson = await response.json();
            if (dataJson?.valor === false) throw new Error(dataJson.mensaje || "No se pudo cargar el insumo.");
            if (!dataJson) throw new Error("No se pudo cargar el insumo.");
            await mostrarModal(dataJson);
        })
        .catch((err) => {
            console.error(err);
            errorModal(err?.message || "Ha ocurrido un error.");
        });
};

async function eliminarInsumo(id) {
    return eliminarConCascada({
        url: '/Insumos/Eliminar',
        id,
        confirmMsg: '¿Desea eliminar el Insumo?',
        headers: () => ({
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }),
        onSuccess: async (j) => {
            aplicarFiltrosInsumos();
            exitoModal(j.mensaje || 'Insumo eliminado correctamente');
        }
    });
}

/* ============================================================
 * DataTable
 * ============================================================ */
async function initInsumosGrid() {
    if (window.ensureKyoExportLibs) await window.ensureKyoExportLibs();
    if (gridInsumos) return;

    $('#grd_Insumos thead tr').clone(true).addClass('filters').appendTo('#grd_Insumos thead');
    gridInsumos = $('#grd_Insumos').DataTable({
        serverSide: true,
        processing: true,
        ajax: kyoServerGridAjax('/Insumos/ListaPaginada', () => ({
            IdUnidadNegocio: document.getElementById('UnidadNegocioFiltro')?.value ?? _defaultUnidadNegocio()
        })),
            language: {
                sLengthMenu: "Mostrar MENU registros",
                lengthMenu: "Anzeigen von _MENU_ Einträge",
                url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json"
            },
            scrollX: false,
            scrollCollapse: true,
            columns: [
                columnaGridAcciones(null, null, function (id) {
                    return `<div class="rp-row-actions" data-id="${id}">
        <button type="button" class="btn btn-sm rp-act rp-act-edit" title="Editar" onclick="editarInsumo(${id})"><i class="fa fa-pencil-square-o"></i></button>
        <button type="button" class="btn btn-sm rp-act rp-act-view" title="Duplicar" onclick="duplicarInsumo(${id})"><i class="fa fa-clone"></i></button>
        <button type="button" class="btn btn-sm rp-act rp-act-view" title="Historial" onclick="verHistorialInsumo(${id})"><i class="fa fa-history"></i></button>
        <button type="button" class="btn btn-sm rp-act rp-act-del" title="Eliminar" onclick="eliminarInsumo(${id})"><i class="fa fa-trash-o"></i></button>
      </div>`;
                }),
                columnaGridId(),

                { data: 'Descripcion' },
                { data: 'FechaActualizacion' },
                { data: 'Sku' },
                { data: 'UnidadMedida' },
                { data: 'Categoria' },
                { data: 'ProveedorDestacado' },
                { data: 'CostoUnitario' },
                {
                    data: null,
                    title: "Asociado",
                    className: "text-center",
                    orderable: false,
                    render: function (data, type, row) {
                        return row.CantidadProveedores > 0
                            ? "<i class='fa fa-check text-success'></i>"
                            : "<i class='fa fa-times text-danger'></i>";
                    }
                }
            ],
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'excelHtml5',
                    text: 'Exportar Excel',
                    filename: 'Reporte Insumos',
                    title: '',
                    exportOptions: { columns: [2, 3, 4, 5] },
                    className: 'btn-exportar-excel',
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Reporte Insumos',
                    title: '',
                    exportOptions: { columns: [2, 3, 4, 5] },
                    className: 'btn-exportar-pdf',
                },
                {
                    extend: 'print',
                    text: 'Imprimir',
                    title: '',
                    exportOptions: { columns: [2, 3, 4, 5] },
                    className: 'btn-exportar-print'
                },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: false,

            columnDefs: [
                {
                    render: function (data) {
                        if (data) {
                            const date = new Date(data);
                            return moment(date, 'YYYY-MM-DD hh:mm').format('DD/MM/YYYY hh:mm');
                        }
                        return '';
                    },
                    targets: [3]
                },
                {
                    render: function (data) {
                        return formatNumber(data);
                    },
                    targets: [8]
                }
            ],

            initComplete: async function () {
                const api = this.api();

                await kyoBindColumnFilters(api, {
                    columns: columnConfig,
                    skipIndexes: [0, 1]
                });

                configurarOpcionesColumnas();

                setTimeout(function () {
                    gridInsumos.columns.adjust();
                }, 10);

                // KPIs desde endpoint dedicado (totales del filtro actual)
                cargarKpisInsumos();

                // (Permanece tu lógica de íconos de mapa si la usabas)
                $('body').on('mouseenter', '#grd_Insumos .fa-map-marker', function () {
                    $(this).css('cursor', 'pointer');
                });
                $('body').on('click', '#grd_Insumos .fa-map-marker', function () {
                    const locationText = $(this).parent().text().trim().replace(' ', ' ');
                    const url = 'https://www.google.com/maps?q=' + encodeURIComponent(locationText);
                    window.open(url, '_blank');
                });
            },
        });
}

/* compat: llamadas antiguas */
async function configurarDataTable() {
    await initInsumosGrid();
}

/* ============================================================
 * Configuración columnas (persistencia localStorage)
 * ============================================================ */
function configurarOpcionesColumnas() {
    initGridColumnConfig({
        gridSelector: '#grd_Insumos',
        menuSelector: '#configColumnasMenu',
        storageKey: 'Insumos_Columnas',
    });
}

/* ============================================================
 * Listas (con token)
 * ============================================================ */
async function listaUnidadesNegocioFilter() {
    const url = `/UnidadesNegocio/Lista`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) throw new Error('No se pudieron cargar las unidades de negocio.');
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}

async function listaUnidadesMedidaFilter() {
    const url = `/UnidadesMedida/Lista`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) throw new Error('No se pudieron cargar las unidades de medida.');
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}

async function listaInsumosCategoriaFilter() {
    const url = `/InsumosCategoria/Lista`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) throw new Error('No se pudieron cargar las categorías.');
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}

async function listaUnidadesNegocio(autoSelectAll = false) {
    const data = await listaUnidadesNegocioFilter();
    const contenedor = document.getElementById("listaUnidades");
    if (!contenedor) return;

    contenedor.innerHTML = `
        <div class="form-check">
            <input class="form-check-input" type="checkbox" id="checkTodosUnidades">
            <label class="form-check-label" for="checkTodosUnidades">Seleccionar todos</label>
        </div>
        <hr class="my-2" />
    `;

    (Array.isArray(data) ? data : []).forEach(p => {
        const wrapper = document.createElement("div");
        wrapper.className = "form-check";
        wrapper.innerHTML = `
            <input class="form-check-input unidades-check" type="checkbox" value="${p.Id}" id="unidadNegocio${p.Id}">
            <label class="form-check-label" for="unidadNegocio${p.Id}">${p.Nombre}</label>
        `;
        contenedor.appendChild(wrapper);
    });

    // Listeners
    const master = document.getElementById("checkTodosUnidades");
    if (!master) return;
    master.addEventListener("change", function () {
        document.querySelectorAll(".unidades-check").forEach(cb => cb.checked = this.checked);
        actualizarTextoUnidadesNegocio();
        validarCampoIndividual(document.getElementById("btnUnidadesNegocio"));
    });

    document.querySelectorAll(".unidades-check").forEach(cb => {
        cb.addEventListener("change", function () {
            actualizarTextoUnidadesNegocio();
            validarCampoIndividual(document.getElementById("btnUnidadesNegocio"));
        });
    });

    // AUTO: simular "Seleccionar todos" al terminar de armar la lista
    if (autoSelectAll) {
        master.checked = true;
        master.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

async function listaUnidadesMedida() {
    const data = await listaUnidadesMedidaFilter();
    $('#UnidadesMedida option').remove();

    const select = document.getElementById("UnidadesMedida");
    const optionDefault = document.createElement("option");
    optionDefault.value = "";
    optionDefault.text = "Seleccionar";
    optionDefault.disabled = true;
    optionDefault.selected = true;
    select.appendChild(optionDefault);

    for (let i = 0; i < data.length; i++) {
        const option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);
    }
}

async function listaInsumosCategoria() {
    const data = await listaInsumosCategoriaFilter();
    $('#Categorias option').remove();

    const select = document.getElementById("Categorias");
    const optionDefault = document.createElement("option");
    optionDefault.value = "";
    optionDefault.text = "Seleccionar";
    optionDefault.disabled = true;
    optionDefault.selected = true;
    select.appendChild(optionDefault);

    for (let i = 0; i < data.length; i++) {
        const option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);
    }
}

async function listaUnidadesNegocioFiltro() {
    // (mantengo por compatibilidad si lo llamabas)
    return listaUnidadesNegocioFilter();
}

/* ============================================================
 * Modal Proveedores Asignados
 * ============================================================ */
function _paEsc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function actualizarBadgeProveedoresAsignados() {
    const badge = document.getElementById('badgeProveedoresAsignados');
    if (!badge) return;
    const n = Array.isArray(ProveedoresAsignados) ? ProveedoresAsignados.length : 0;
    badge.textContent = String(n);
    badge.classList.toggle('d-none', n <= 0);
}

function actualizarContadoresPa() {
    const rows = document.querySelectorAll('#tablaProveedoresAsignados tbody tr');
    let visible = 0;
    let selected = 0;
    let visibleChecked = 0;
    let visibleTotal = 0;

    rows.forEach(row => {
        if (row.style.display === 'none') return;
        visible++;
        const cb = row.querySelector('.chk-asignacion');
        if (!cb) return;
        visibleTotal++;
        if (cb.checked) {
            selected++;
            visibleChecked++;
        }
    });

    // Contar seleccionados (incluye ocultos por filtro)
    selected = document.querySelectorAll('#tablaProveedoresAsignados tbody .chk-asignacion:checked').length;

    const elV = document.getElementById('paVisibleCount');
    const elS = document.getElementById('paSelectedCount');
    if (elV) elV.textContent = String(visible);
    if (elS) elS.textContent = String(selected);

    const empty = document.getElementById('paEmptyState');
    if (empty) empty.classList.toggle('d-none', visible > 0);

    const master = document.getElementById('paCheckAllVisible');
    if (master) {
        master.indeterminate = visibleChecked > 0 && visibleChecked < visibleTotal;
        master.checked = visibleTotal > 0 && visibleChecked === visibleTotal;
    }
}

function toggleAsignacionesVisibles(checked) {
    document.querySelectorAll('#tablaProveedoresAsignados tbody tr').forEach(row => {
        if (row.style.display === 'none') return;
        const cb = row.querySelector('.chk-asignacion');
        if (!cb) return;
        cb.checked = !!checked;
        row.classList.toggle('fila-asignada', !!checked);
    });
    actualizarContadoresPa();
}

function abrirModalProveedoresAsignados() {
    const idInsumo = parseInt($("#txtId").val(), 10);
    const idI = Number.isFinite(idInsumo) && idInsumo > 0 ? idInsumo : 0;

    fetch(`/ProveedoresInsumos/Lista?idProveedor=-1`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
        .then(response => {
            if (!response.ok) throw new Error('No se pudo cargar la lista de proveedores.');
            return response.json();
        })
        .then(data => {
            const list = Array.isArray(data) ? data : (data?.$values || []);
            const tbody = document.querySelector("#tablaProveedoresAsignados tbody");
            tbody.innerHTML = "";

            const asignados = [];
            const noAsignados = [];

            list.forEach(item => {
                const idProv = parseInt(item.IdProveedor ?? item.idProveedor, 10);
                const idLista = parseInt(item.Id ?? item.id, 10);
                const isChecked = (ProveedoresAsignados || []).some(x =>
                    parseInt(x.IdListaProveedor, 10) === idLista &&
                    parseInt(x.IdProveedor, 10) === idProv
                );

                const codigo = item.Codigo ?? item.codigo ?? '';
                const desc = item.Descripcion ?? item.descripcion ?? '';
                const prov = item.Proveedor ?? item.proveedor ?? '';
                const costo = item.CostoUnitario ?? item.costoUnitario;

                const tr = document.createElement("tr");
                tr.className = isChecked ? "fila-asignada" : "";
                tr.innerHTML = `
                    <td>
                        <span class="pa-prov">${_paEsc(prov)}</span>
                    </td>
                    <td>
                        <div class="pa-desc">${_paEsc(desc)}</div>
                        ${costo != null && costo !== '' ? `<div class="pa-meta">Unitario: ${_paEsc(Number(costo).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }))}</div>` : ''}
                    </td>
                    <td><code class="pa-code">${codigo ? _paEsc(codigo) : '—'}</code></td>
                    <td class="text-center">
                        <input type="checkbox" class="form-check-input chk-asignacion"
                            data-idproveedor="${idProv}"
                            data-idlistaproveedor="${idLista}"
                            ${isChecked ? "checked" : ""}>
                    </td>
                `;

                isChecked ? asignados.push(tr) : noAsignados.push(tr);
            });

            [...asignados, ...noAsignados].forEach(tr => tbody.appendChild(tr));

            // Filtros limpios al abrir
            ['filtroDescripcionProveedor', 'filtroCodigoProveedor', 'filtroProveedor'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            tbody.querySelectorAll('.chk-asignacion').forEach(cb => {
                cb.addEventListener('change', () => {
                    cb.closest('tr')?.classList.toggle('fila-asignada', cb.checked);
                    actualizarContadoresPa();
                });
            });

            filtrarTablaProveedor();

            if (typeof bsShow === 'function') {
                bsShow('#modalProveedoresAsignados', { backdrop: true, keyboard: true });
            } else {
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProveedoresAsignados')).show();
            }
        })
        .catch(err => {
            console.error(err);
            errorModal(err.message || 'No se pudo abrir proveedores asignados.');
        });
}

async function guardarAsignacionesProveedores() {
    return withBusy("#btnGuardarAsignaciones", async () => {
        try {
            const checks = document.querySelectorAll("#tablaProveedoresAsignados .chk-asignacion");
            const idInsumo = parseInt($("#txtId").val(), 10);
            const idI = Number.isFinite(idInsumo) && idInsumo > 0 ? idInsumo : 0;

            const next = [];
            checks.forEach(cb => {
                if (!cb.checked) return;
                const idProveedor = parseInt(cb.dataset.idproveedor, 10);
                const idListaProveedor = parseInt(cb.dataset.idlistaproveedor, 10);
                if (!Number.isFinite(idProveedor) || !Number.isFinite(idListaProveedor)) return;
                next.push({
                    IdInsumo: idI || undefined,
                    IdProveedor: idProveedor,
                    IdListaProveedor: idListaProveedor
                });
            });

            ProveedoresAsignados = next;
            actualizarBadgeProveedoresAsignados();

            if (typeof bsHide === 'function') await bsHide('#modalProveedoresAsignados');
            else {
                const el = document.getElementById('modalProveedoresAsignados');
                if (el && window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(el).hide();
            }

            if (typeof exitoModal === 'function') {
                exitoModal(next.length
                    ? `${next.length} proveedor(es) vinculados. Guardá el insumo para confirmar.`
                    : 'Sin proveedores vinculados. Guardá el insumo para confirmar.');
            }
        } catch (e) {
            console.error(e);
            errorModal(e.message || 'No se pudieron aplicar las asignaciones.');
        }
    }, { label: "Aplicando..." });
}

function filtrarTablaProveedor() {
    const descripcion = (document.getElementById("filtroDescripcionProveedor")?.value || "").toLowerCase().trim();
    const codigo = (document.getElementById("filtroCodigoProveedor")?.value || "").toLowerCase().trim();
    const proveedor = (document.getElementById("filtroProveedor")?.value || "").toLowerCase().trim();

    document.querySelectorAll("#tablaProveedoresAsignados tbody tr").forEach(row => {
        const colProveedor = (row.children[0]?.textContent || "").toLowerCase();
        const colDescripcion = (row.children[1]?.textContent || "").toLowerCase();
        const colCodigo = (row.children[2]?.textContent || "").toLowerCase();

        const coincide =
            (!descripcion || colDescripcion.includes(descripcion)) &&
            (!codigo || colCodigo.includes(codigo)) &&
            (!proveedor || colProveedor.includes(proveedor));

        row.style.display = coincide ? "" : "none";
    });

    actualizarContadoresPa();
}

/* ============================================================
 * Validaciones y UI Unidades
 * ============================================================ */
function toggleUnidadesNegocio() {
    const lista = document.getElementById("listaUnidades");
    lista.classList.toggle("d-none");
}

// Evitar cierre al hacer clic dentro
document.getElementById("listaUnidades")?.addEventListener("click", function (e) {
    e.stopPropagation();
});

// Cerrar al hacer clic fuera
document.addEventListener("click", function (e) {
    const container = document.getElementById("listaUnidades");
    const button = document.getElementById("btnUnidadesNegocio");
    if (!container || !button) return;
    if (!container.contains(e.target) && !button.contains(e.target)) {
        container.classList.add("d-none");
    }
});

// Lógica "Seleccionar todos" (duplicada a propósito, mantengo lo tuyo)
document.getElementById("checkTodosUnidades")?.addEventListener("change", function () {
    const checkboxes = document.querySelectorAll(".unidad-check");
    checkboxes.forEach(cb => cb.checked = this.checked);
});

function actualizarTextoUnidadesNegocio() {
    const checks = document.querySelectorAll('.unidades-check:checked');
    const label = document.getElementById("btnUnidadesNegocio");

    if (checks.length === 0) {
        label.textContent = "Seleccionar Unidades";
    } else {
        label.textContent = armarResumenChecks(checks);
    }

    unidadesNegocioSeleccionados = Array.from(checks).map(cb => parseInt(cb.value));
}

function armarResumenChecks(checks, maxItems = 3, maxLength = 100) {
    const nombres = Array.from(checks).map(cb => cb.nextElementSibling.textContent.trim());
    let resumen = "";

    if (nombres.length <= maxItems) {
        resumen = nombres.join(", ");
    } else {
        resumen = nombres.join(", ");
        if (resumen.length > maxLength) {
            resumen = resumen.substring(0, maxLength).trim() + "...";
        }
    }

    return resumen;
}

function limpiarModal() {
    const formulario = document.querySelector("#formInsumo");
    if (!formulario) return;

    formulario.querySelectorAll("input, select, textarea").forEach(el => {
        if (el.tagName === "SELECT") el.selectedIndex = 0;
        else el.value = "";
        el.classList.remove("is-invalid", "is-valid");
    });

    const el = document.getElementById('lblUltimaModif');
    if (el) el.textContent = "";

    // Limpiar Unidades de Negocio
    document.querySelectorAll('.unidades-check').forEach(cb => cb.checked = false);
    unidadesNegocioSeleccionados = [];
    const btnUnidades = document.getElementById("btnUnidadesNegocio");
    if (btnUnidades) {
        btnUnidades.textContent = "Seleccionar Unidades";
        btnUnidades.classList.remove("is-valid", "is-invalid");
    }



    const errorMsg = document.getElementById("errorCampos");
    if (errorMsg) errorMsg.classList.add("d-none");

    ProveedoresAsignados = [];
    actualizarBadgeProveedoresAsignados();
}

function validarCampoIndividual(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id;
    const valor = el.value ? el.value.trim() : "";
    const feedback = el.nextElementSibling;

    if (tag === "input" || tag === "select" || tag === "textarea") {
        if (feedback && feedback.classList.contains("invalid-feedback")) {
            feedback.textContent = "Campo obligatorio";
        }

        if (valor === "" || valor === "Seleccionar") {
            el.classList.remove("is-valid");
            el.classList.add("is-invalid");
        } else {
            el.classList.remove("is-invalid");
            el.classList.add("is-valid");
        }
    }

    if (id === "btnUnidadesNegocio") {
        if (unidadesNegocioSeleccionados.length === 0) {
            el.classList.remove("is-valid");
            el.classList.add("is-invalid");
        } else {
            el.classList.remove("is-invalid");
            el.classList.add("is-valid");
        }
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
    let valido = true;

    // inputs/selects que validás en el modal
    const ids = ['#txtDescripcion', '#txtSku', '#UnidadesMedida', '#Categorias'];
    for (const sel of ids) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const empty = _isEmpty(el);
        _setInvalid(el, empty);
        if (empty) valido = false;
    }

    // U. de Negocio (pseudo-select): usamos 3 fuentes para el conteo
    const btnUnidades = document.getElementById('btnUnidadesNegocio');
    if (btnUnidades) {
        // 1) array global si existe
        let count = Array.isArray(window.unidadesNegocioSeleccionados) ? window.unidadesNegocioSeleccionados.length : 0;
        // 2) fallback: checkboxes marcados dentro del dropdown
        if (!count) {
            const lista = document.getElementById('listaUnidades');
            if (lista) count = lista.querySelectorAll('.form-check-input[type="checkbox"]:not(#checkTodosUnidades):checked').length;
        }
        // 3) fallback: atributo data-count si lo usás
        if (!count) count = parseInt(btnUnidades.dataset.count || '0', 10) || 0;

        const inval = count <= 0;
        btnUnidades.classList.toggle('is-invalid', inval);
        btnUnidades.classList.toggle('is-valid', !inval);

        // feedback del contenedor
        const fb = _feedbackFor(btnUnidades);
        if (fb) fb.classList.toggle('d-none', !inval);
        if (inval) valido = false;
    }

    document.getElementById('errorCampos')?.classList.toggle('d-none', valido);
    return valido;
}
// ==============================
//  Filtros Insumos (completo)
// ==============================
const _KEY_UN_FILTRO = 'Insumos_Filtro_UnidadNegocio';
const _KEY_BAR_VISIBLE = 'Insumos_FiltroBar_Visible';

// === helpers
function ensureOpcionTodosUnidad() {
    const sel = document.getElementById('UnidadNegocioFiltro');
    if (!sel) return;
    const hasTodos = Array.from(sel.options).some(o => String(o.value) === '-1');
    if (!hasTodos) {
        const opt = document.createElement('option');
        opt.value = '-1';
        opt.textContent = 'Todos';
        sel.insertBefore(opt, sel.firstChild);
    }
}

function setUnidadNegocioFiltro(value) {
    const sel = document.getElementById('UnidadNegocioFiltro');
    if (!sel) return;
    ensureOpcionTodosUnidad();
    sel.value = String(value);

    // Si usás Select2 en este select:
    if (window.jQuery && jQuery.fn && jQuery.fn.select2) {
        jQuery(sel).val(String(value)).trigger('change.select2');
    }
    try { localStorage.setItem(_KEY_UN_FILTRO, String(value)); } catch { }
}

function getUnidadNegocioFiltro() {
    const sel = document.getElementById('UnidadNegocioFiltro');
    if (!sel) return -1;
    const v = sel.value ?? '-1';
    const n = Number(v);
    return Number.isFinite(n) ? n : -1;
}

// === init persistente del filtro + toggle de barra

function initFiltroUnidadNegocioPersistente() {
    ensureOpcionTodosUnidad();

    // Cargar valor guardado
    let saved = -1;
    try {
        const raw = localStorage.getItem(_KEY_UN_FILTRO);
        if (raw != null && raw !== '') {
            const n = Number(raw);
            if (Number.isFinite(n)) saved = n;
        }
    } catch { }

    setUnidadNegocioFiltro(saved);

    const btn = document.getElementById('btnToggleFiltrosI');
    const bar = document.getElementById('formFiltrosInsumos');
    const icon = document.getElementById('iconFiltrosI');

    if (!btn || !bar || !icon) return;

    // Leer visibilidad previa
    let visible = true;
    try {
        const raw = localStorage.getItem(_KEY_BAR_VISIBLE);
        if (raw !== null) visible = raw === '1';
    } catch { }

    bar.classList.toggle('d-none', !visible);
    icon.classList.toggle('fa-arrow-up', visible);
    icon.classList.toggle('fa-arrow-down', !visible);

    btn.addEventListener('click', () => {
        const oculto = bar.classList.toggle('d-none');   // true si queda oculto
        icon.classList.toggle('fa-arrow-up', !oculto);
        icon.classList.toggle('fa-arrow-down', oculto);
        try { localStorage.setItem(_KEY_BAR_VISIBLE, oculto ? '0' : '1'); } catch { }
    });
}



// Duplica un insumo: abre el modal precargado en modo INSERT (sin Id / SKU único)
async function duplicarInsumo(id) {
    try {
        const resp = await fetch("/Insumos/EditarInfo?id=" + id, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });
        if (!resp.ok) throw new Error("No se pudo cargar el insumo.");

        const origen = await resp.json();
        if (origen?.valor === false) throw new Error(origen.mensaje || "No se pudo cargar el insumo.");
        if (!origen) throw new Error("No se pudo cargar el insumo.");

        const skuOrigen = String(origen.Sku || "").trim();
        const unidades = unwrapJsonList(origen.InsumosUnidadesNegocios || origen.insumosUnidadesNegocios);
        const proveedores = unwrapJsonList(origen.InsumosProveedores || origen.insumosProveedores);

        const copia = {
            ...origen,
            Id: 0,
            Sku: skuOrigen ? `${skuOrigen}-COPIA` : "",
            Descripcion: typeof kyoTextoCopia === 'function'
                ? kyoTextoCopia(origen.Descripcion)
                : `${(origen.Descripcion || "").trim()} (copia)`.trim(),
            IdUsuarioRegistra: null,
            FechaRegistra: null,
            IdUsuarioModifica: null,
            FechaModifica: null,
            UsuarioRegistra: null,
            UsuarioModifica: null,
            InsumosUnidadesNegocios: unidades.map(u => ({
                IdUnidadNegocio: u.IdUnidadNegocio ?? u.idUnidadNegocio
            })),
            InsumosProveedores: proveedores.map(p => ({
                IdProveedor: p.IdProveedor ?? p.idProveedor,
                IdListaProveedor: p.IdListaProveedor ?? p.idListaProveedor
            }))
        };

        await mostrarModal(copia);
        $("#txtId").val("");
        $("#btnGuardar").text("Registrar");
        $("#modalEdicionLabel").text("Duplicar Insumo");
    } catch (e) {
        console.error(e);
        errorModal(e?.message || "Ha ocurrido un error al duplicar el insumo.");
    }
}


// Helper local para volver a traer categorías (ajústalo a tu endpoint real)
async function recargarCategoriasYSeleccionar(idSeleccionar = null) {
    const sel = document.getElementById('Categorias');
    if (!sel) return;

    // guardo por si quiero restaurar
    const prev = sel.value;

    let data;
    try {
        data = await fetchJson('/InsumosCategoria/Lista');
    } catch {
        data = [];
    }
    if (!Array.isArray(data)) data = [];

    // limpiar y agregar placeholder
    sel.innerHTML = '';
    const opt0 = new Option('Seleccionar', '-1', false, false);
    opt0.disabled = true;
    sel.add(opt0);

    // helpers para detectar claves
    const pickKey = (obj, keys) => keys.find(k => Object.prototype.hasOwnProperty.call(obj, k));
    const idKeys = ['id', 'Id', 'ID', 'IdCategoria', 'idCategoria'];
    const textKeys = ['nombre', 'Nombre', 'descripcion', 'Descripcion', 'name', 'Name'];

    // cargar opciones
    data.forEach(x => {
        const idKey = pickKey(x, idKeys);
        const txtKey = pickKey(x, textKeys);
        if (idKey && txtKey) {
            sel.add(new Option(String(x[txtKey]), String(x[idKey])));
        }
    });

    // decidir selección
    let valueToSelect = null;

    if (idSeleccionar != null) {
        valueToSelect = String(idSeleccionar);
    } else {
        // último option real (ignora placeholder)
        if (sel.options.length > 1) {
            valueToSelect = sel.options[sel.options.length - 1].value;
        }
    }

    // si no hay último o no existe en la lista, intento restaurar el valor previo
    if (valueToSelect && [...sel.options].some(o => o.value === valueToSelect)) {
        sel.value = valueToSelect;
    } else if (prev && [...sel.options].some(o => o.value === prev)) {
        sel.value = prev;
    } else {
        sel.value = '-1'; // queda en placeholder si no hay nada más
    }

    // disparar eventos y limpiar validación
    sel.dispatchEvent(new Event('change'));
    try { $('#Categorias').trigger('change.select2'); } catch { }
    sel.classList.remove('is-invalid');
}



// Botón [+] al lado de Categorías
// Carga /UnidadesMedida/Lista y selecciona el último (o por id si se pasa).
async function recargarUnidadesMedidaYSeleccionar(idSeleccionar = null) {
    const sel = document.getElementById('UnidadesMedida');
    if (!sel) return;

    let data;
    try { data = await fetchJson('/UnidadesMedida/Lista'); } catch { data = []; }
    if (!Array.isArray(data)) data = [];

    // Limpiar y placeholder
    sel.innerHTML = '';
    const opt0 = new Option('Seleccionar', '-1', false, false);
    opt0.disabled = true; opt0.selected = true;
    sel.add(opt0);

    // Normalizo claves y armo texto "Nombre (Abreviatura)" si existe
    const norm = (data || []).map(x => {
        const id = x.id ?? x.Id ?? x.ID ?? x.IdUnidadMedida ?? x.idUnidadMedida;
        const nombre = x.nombre ?? x.Nombre ?? x.descripcion ?? x.Descripcion ?? '';
        const abrev = x.abreviatura ?? x.Abreviatura ?? x.sigla ?? x.Sigla ?? '';
        const texto = abrev ? `${nombre} (${abrev})` : String(nombre);
        return { id, texto };
    }).filter(x => x.id != null);

    norm.forEach(x => sel.add(new Option(x.texto, String(x.id))));

    // Decidir selección
    if (idSeleccionar != null) {
        sel.value = String(idSeleccionar);
    } else if (sel.options.length > 1) {
        // último option real (ignora placeholder)
        sel.value = sel.options[sel.options.length - 1].value;
    } else {
        sel.value = '-1';
    }

    sel.dispatchEvent(new Event('change'));
    try { $('#UnidadesMedida').trigger('change.select2'); } catch { }
    sel.classList.remove('is-invalid');
}


