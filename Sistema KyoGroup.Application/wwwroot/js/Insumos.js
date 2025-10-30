/* =============================================================
 * Insumos.js (FULL) — adaptado a header KPI + filtros
 * Sin remover nada. Agrega KPIs + filtros top + token en fetch.
 * ============================================================= */

let gridInsumos;
let isEditing = false;

const columnConfig = [
    { index: 1, filterType: 'text' },
    { index: 2, filterType: 'text' },
    { index: 3, filterType: 'text' },
    { index: 4, filterType: 'select', fetchDataFunc: listaUnidadesMedidaFilter },
    { index: 5, filterType: 'select', fetchDataFunc: listaInsumosCategoriaFilter },
    { index: 6, filterType: 'text' },
    { index: 7, filterType: 'text' },
    { index: 8, filterType: 'text' },
];

let unidadesNegocioSeleccionados = [];
let proveedoresAsignados = [];

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

    // Cargar opciones del filtro top y luego lista inicial
    _cargarFiltrosInsumos().then(() => {
        aplicarFiltrosInsumos(); // primer carga
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

    const idInsumo = $("#txtId").val();

    const nuevoModelo = {
        Id: idInsumo !== "" ? parseInt(idInsumo) : 0,
        Descripcion: $("#txtDescripcion").val(),
        Sku: $("#txtSku").val(),
        IdUnidadMedida: parseInt($("#UnidadesMedida").val()),
        IdCategoria: parseInt($("#Categorias").val()),
        InsumosUnidadesNegocios: unidadesNegocioSeleccionados.map(id => ({ IdUnidadNegocio: id })),
        InsumosProveedores: proveedoresAsignados.map(p => ({
            IdProveedor: p.IdProveedor,
            IdListaProveedor: p.IdListaProveedor
        }))
    };

    const url = idInsumo === "" ? "Insumos/Insertar" : "Insumos/Actualizar";
    const method = idInsumo === "" ? "POST" : "PUT";

    fetch(url, {
        method,
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(nuevoModelo)
    })
        .then(async response => {
            const data = await response.json();
            if (data.valor == false) {
                errorModal("El insumo no se ha podido guardar correctamente");
                return;
            }

            $('#modalEdicion').modal('hide');
            exitoModal(data.mensaje || "Insumo guardado correctamente");
            // Mantener compatibilidad con llamadas existentes
            if (typeof aplicarFiltros === 'function') aplicarFiltros();
            else aplicarFiltrosInsumos();
        })
        .catch(error => {
            errorModal(error.message);
            console.error('Error:', error);
        });
}

function nuevoInsumo() {

    limpiarModal();
    listaUnidadesNegocio();
    listaUnidadesMedida();
    listaInsumosCategoria();
    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Registrar");
    $("#modalEdicionLabel").text("Nuevo Insumo");
}

async function mostrarModal(modelo) {
    limpiarModal();

    const campos = ["Id", "Sku", "Descripcion"];
    campos.forEach(campo => { $(`#txt${campo}`).val(modelo[campo]); });

    await listaUnidadesNegocio();
    await listaUnidadesMedida();
    await listaInsumosCategoria();
    setInfoAuditoria(modelo);


    document.getElementById("Categorias").value = modelo.IdCategoria;
    document.getElementById("UnidadesMedida").value = modelo.IdUnidadMedida;

    const idsUnidades = modelo.InsumosUnidadesNegocios?.map(x => parseInt(x.IdUnidadNegocio)) ?? [];
    unidadesNegocioSeleccionados = [];

    document.querySelectorAll(".unidades-check").forEach(cb => {
        const id = parseInt(cb.value);
        const seleccionado = idsUnidades.includes(id);
        cb.checked = seleccionado;
        if (seleccionado) unidadesNegocioSeleccionados.push(id);
    });



    actualizarTextoUnidadesNegocio();

    // Proveedores asignados
    proveedoresAsignados = modelo.InsumosProveedores?.map(x => ({
        IdInsumo: x.IdInsumo,
        IdProveedor: x.IdProveedor,
        IdListaProveedor: x.IdListaProveedor
    })) ?? [];

    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Guardar");
    $("#modalEdicionLabel").text("Editar Insumo");
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
    const un = document.getElementById("UnidadNegocioFiltro")?.value || _defaultUnidadNegocio();
    await listaInsumos(un);
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

async function listaInsumos(UnidadNegocio) {
    const url = `/Insumos/ListaPorUnidadNegocio?IdUnidadNegocio=${UnidadNegocio}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    await configurarDataTable(data);
}

const editarInsumo = id => {
    $('.acciones-dropdown').hide();
    fetch("Insumos/EditarInfo?id=" + id,
    {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
        .then(response => {
            if (!response.ok) throw new Error("Ha ocurrido un error.");
            return response.json();
        })
        .then(dataJson => {
            if (dataJson !== null) {
                mostrarModal(dataJson);
            } else {
                throw new Error("Ha ocurrido un error.");
            }
        })
        .catch(() => {
            errorModal("Ha ocurrido un error.");
        });
};

async function eliminarInsumo(id) {
    let resultado = window.confirm("¿Desea eliminar el Insumo?");
    if (!resultado) return;

    try {
        const response = await fetch("Insumos/Eliminar?id=" + id, {
            method: "DELETE",
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error("Error al eliminar el Insumo.");

        const dataJson = await response.json();
        if (dataJson.valor) {
            aplicarFiltrosInsumos();
            exitoModal("Insumo eliminado correctamente");
        }
    } catch (error) {
        console.error("Ha ocurrido un error:", error);
    }
}

/* ============================================================
 * DataTable
 * ============================================================ */
async function configurarDataTable(data) {
    if (!gridInsumos) {
        $('#grd_Insumos thead tr').clone(true).addClass('filters').appendTo('#grd_Insumos thead');
        gridInsumos = $('#grd_Insumos').DataTable({
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
                    exportOptions: { columns: [0, 1, 2, 3] },
                    className: 'btn-exportar-excel',
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Reporte Insumos',
                    title: '',
                    exportOptions: { columns: [0, 1, 2, 3] },
                    className: 'btn-exportar-pdf',
                },
                {
                    extend: 'print',
                    text: 'Imprimir',
                    title: '',
                    exportOptions: { columns: [0, 1, 2, 3] },
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
                            return moment(date, 'YYYY-MM-DD hh:mm').format('DD/MM/YYYY hh:mm');
                        }
                        return '';
                    },
                    targets: [2]
                },
                {
                    render: function (data) {
                        return formatNumber(data);
                    },
                    targets: [7]
                }
            ],

            initComplete: async function () {
                const api = this.api();

                // Filtros por columna
                columnConfig.forEach(async (config) => {
                    const cell = $('.filters th').eq(config.index);

                    if (config.filterType === 'select') {
                        const select = $('<select id="filter' + config.index + '"><option value="">Seleccionar</option></select>')
                            .appendTo(cell.empty())
                            .on('change', async function () {
                                const val = $(this).val();
                                const selectedText = $(this).find('option:selected').text();
                                await api.column(config.index).search(val ? '^' + selectedText + '$' : '', true, false).draw();
                            });

                        const data = await config.fetchDataFunc();
                        data.forEach(function (item) {
                            select.append('<option value="' + item.Id + '">' + item.Nombre + '</option>');
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
                                    .search(this.value !== '' ? regexr.replace('{search}', '(((' + this.value + ')))') : '', this.value !== '', this.value === '')
                                    .draw();
                                $(this).focus()[0].setSelectionRange(cursorPosition, cursorPosition);
                            });
                    }
                });

                $('.filters th').eq(0).html('');

                configurarOpcionesColumnas();

                setTimeout(function () {
                    gridInsumos.columns.adjust();
                }, 10);

                // KPIs con los datos actuales de la tabla
                actualizarKpisInsumos(api.rows().data().toArray());

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

    } else {
        gridInsumos.clear().rows.add(data).draw();
        actualizarKpisInsumos(data); // NUEVO: refrescar KPIs al recargar
    }
}

/* ============================================================
 * Configuración columnas (persistencia localStorage)
 * ============================================================ */
function configurarOpcionesColumnas() {
    const grid = $('#grd_Insumos').DataTable();
    const columnas = grid.settings().init().columns;
    const container = $('#configColumnasMenu');

    const storageKey = `Insumos_Columnas`;
    const savedConfig = JSON.parse(localStorage.getItem(storageKey)) || {};

    container.empty();

    columnas.forEach((col, index) => {
        if (col.data && col.data !== "Id") {
            const isChecked = savedConfig && savedConfig[`col_${index}`] !== undefined ? savedConfig[`col_${index}`] : true;

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
        }
    });

    $('.toggle-column').on('change', function () {
        const columnIdx = parseInt($(this).data('column'), 10);
        const isChecked = $(this).is(':checked');
        savedConfig[`col_${columnIdx}`] = isChecked;
        localStorage.setItem(storageKey, JSON.stringify(savedConfig));
        grid.column(columnIdx).visible(isChecked);
    });
}

/* ============================================================
 * Dropdown Acciones (no tocar)
 * ============================================================ */
$(document).on('click', function (e) {
    if (!$(e.target).closest('.acciones-menu').length) {
        $('.acciones-dropdown').hide();
    }
});
function toggleAcciones(id) {
    const $dropdown = $(`.acciones-menu[data-id="${id}"] .acciones-dropdown`);
    if ($dropdown.is(":visible")) $dropdown.hide();
    else {
        $('.acciones-dropdown').hide();
        $dropdown.show();
    }
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
    const data = await response.json();
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
    const data = await response.json();
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
    const data = await response.json();
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}

async function listaUnidadesNegocio() {
    const data = await listaUnidadesNegocioFilter();
    const contenedor = document.getElementById("listaUnidades");

    contenedor.innerHTML = `
        <div class="form-check">
            <input class="form-check-input" type="checkbox" id="checkTodosUnidades">
            <label class="form-check-label" for="checkTodosUnidades">Seleccionar todos</label>
        </div>
        <hr class="my-2" />
    `;

    data.forEach(p => {
        const wrapper = document.createElement("div");
        wrapper.className = "form-check";
        wrapper.innerHTML = `
            <input class="form-check-input unidades-check" type="checkbox" value="${p.Id}" id="unidadNegocio${p.Id}">
            <label class="form-check-label" for="unidadNegocio${p.Id}">${p.Nombre}</label>
        `;
        contenedor.appendChild(wrapper);
    });

    document.getElementById("checkTodosUnidades").addEventListener("change", function () {
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
function abrirModalProveedoresAsignados() {
    const idInsumo = $("#txtId").val();

    fetch(`/ProveedoresInsumos/Lista?idProveedor=-1`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            const tbody = document.querySelector("#tablaProveedoresAsignados tbody");
            tbody.innerHTML = "";

            const asignados = [];
            const noAsignados = [];

            const idI = parseInt($("#txtId").val());

            data.forEach(item => {
                const isChecked = proveedoresAsignados.some(x =>
                    x.IdInsumo === idI &&
                    x.IdProveedor === parseInt(item.IdProveedor) &&
                    x.IdListaProveedor === parseInt(item.Id)
                );

                const tr = document.createElement("tr");
                tr.className = isChecked ? "fila-asignada" : "";
                tr.innerHTML = `
                    <td>${item.Proveedor}</td>
                    <td>${item.Descripcion}</td>
                    <td>${item.Codigo}</td>
                    <td>
                        <input type="checkbox" class="chk-asignacion" 
                            data-idproveedor="${item.IdProveedor}" 
                            data-idlistaproveedor="${item.Id}" 
                            ${isChecked ? "checked" : ""}>
                    </td>
                `;

                isChecked ? asignados.push(tr) : noAsignados.push(tr);
            });

            [...asignados, ...noAsignados].forEach(tr => tbody.appendChild(tr));

            $('#modalProveedoresAsignados')
                .appendTo('body')
                .modal({ backdrop: false, keyboard: false })
                .modal('show');
        });
}

function guardarAsignacionesProveedores() {
    const checks = document.querySelectorAll(".chk-asignacion");
    proveedoresAsignados = []; // reset intencional

    checks.forEach(cb => {
        if (cb.checked) {
            const idProveedor = parseInt(cb.dataset.idproveedor);
            const idListaProveedor = parseInt(cb.dataset.idlistaproveedor);

            proveedoresAsignados.push({
                IdProveedor: idProveedor,
                IdListaProveedor: idListaProveedor
            });
        }
    });

    $('#modalProveedoresAsignados').modal('hide');
}

function filtrarTablaProveedor() {
    const descripcion = document.getElementById("filtroDescripcionProveedor").value.toLowerCase();
    const codigo = document.getElementById("filtroCodigoProveedor").value.toLowerCase();
    const proveedor = document.getElementById("filtroProveedor").value.toLowerCase();

    document.querySelectorAll("#tablaProveedoresAsignados tbody tr").forEach(row => {
        const colProveedor = row.children[0]?.textContent.toLowerCase();
        const colDescripcion = row.children[1]?.textContent.toLowerCase();
        const colCodigo = row.children[2]?.textContent.toLowerCase();

        const coincide =
            colDescripcion.includes(descripcion) &&
            colCodigo.includes(codigo) &&
            colProveedor.includes(proveedor);

        row.style.display = coincide ? "" : "none";
    });
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
    const campos = ["#txtDescripcion", "#txtSku", "#Categorias", "#UnidadesMedida"];
    let valido = true;

    campos.forEach(selector => {
        const campo = document.querySelector(selector);
        const valor = campo?.value.trim();
        const feedback = campo?.nextElementSibling;

        if (!campo || !valor || valor === "Seleccionar") {
            campo.classList.add("is-invalid");
            campo.classList.remove("is-valid");
            if (feedback) feedback.textContent = "Campo obligatorio";
            valido = false;
        } else {
            campo.classList.remove("is-invalid");
            campo.classList.add("is-valid");
        }
    });

    const btnUnidades = document.getElementById("btnUnidadesNegocio");
    if (unidadesNegocioSeleccionados.length === 0) {
        btnUnidades.classList.add("is-invalid");
        btnUnidades.classList.remove("is-valid");
        valido = false;
    } else {
        btnUnidades.classList.remove("is-invalid");
        btnUnidades.classList.add("is-valid");
    }

    document.getElementById("errorCampos").classList.toggle("d-none", valido);
    return valido;
}

// ==============================
//  Filtros Insumos (completo)
// ==============================
const _KEY_UN_FILTRO = 'Insumos_Filtro_UnidadNegocio';
const _KEY_BAR_VISIBLE = 'Insumos_FiltroBar_Visible';

// ——— helpers
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

// ——— init persistente del filtro + toggle de barra

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

// ——— aplicar/limpiar (mantengo tu flujo)
function aplicarFiltrosInsumos() {
    // Usa la API existente
    const idUnidad = getUnidadNegocioFiltro();
    listaUnidadesNegocioFiltro(); // opcional si querés refrescar opciones
    listaInsumos(idUnidad);       // <- tu función existente
}

// wrapper para compatibilidad con el botón o código viejo
function aplicarFiltros() {
    aplicarFiltrosInsumos();
}

function limpiarFiltrosInsumos() {
    setUnidadNegocioFiltro(-1);   // setea a "Todos" + persiste + dispara change si hay Select2
    aplicarFiltrosInsumos();      // recarga la grilla con default
}

// ——— inicialización en document.ready
document.addEventListener('DOMContentLoaded', () => {
    // Si querés Select2 en el filtro (opcional)
    if (window.jQuery && jQuery.fn && jQuery.fn.select2) {
        $('#UnidadNegocioFiltro').select2({
            placeholder: 'Todos',
            allowClear: false,
            width: '100%'
        });
    }

    // Llenar el combo (usa tu función real)
    // cuando termine de llenar, llamá a initFiltroUnidadNegocioPersistente();
    (async function bootstrapFiltro() {
        try {
            await listaUnidadesNegocioFiltro(); // <- tu función que pobla el select
        } finally {
            initFiltroUnidadNegocioPersistente();
            // primera carga respetando el valor guardado
            aplicarFiltrosInsumos();
        }
    })();
});
