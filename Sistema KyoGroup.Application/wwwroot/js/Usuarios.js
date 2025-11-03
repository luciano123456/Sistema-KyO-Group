let gridUsuarios;

const columnConfig = [
    { index: 1, filterType: 'text' },
    { index: 2, filterType: 'text' },
    { index: 3, filterType: 'text' },
    { index: 4, filterType: 'text' },
    { index: 5, filterType: 'text' },
    { index: 6, filterType: 'text' },
    { index: 7, filterType: 'select', fetchDataFunc: listaRolesFilter },
    { index: 8, filterType: 'select', fetchDataFunc: listaEstadosFilter },
    { index: 9, filterType: 'text' },
];

const Modelo_base = {
    Id: 0,
    Nombre: "",
    Telefono: "",
    Direccion: "",
};

/* === Helper para coalescer Pascal/camel por si el backend cambia === */
function pick(row, prop) {
    if (!row) return '';
    if (prop in row) return row[prop];
    const camel = prop.substring(0, 1).toLowerCase() + prop.substring(1);
    if (camel in row) return row[camel];
    return '';
}

$(document).ready(() => {
    listaUsuarios();

    document.querySelectorAll("#modalEdicion input, #modalEdicion select, #modalEdicion textarea").forEach(el => {
        el.setAttribute("autocomplete", "off");
        el.addEventListener("input", () => validarCampoIndividual(el));
        el.addEventListener("change", () => validarCampoIndividual(el));
        el.addEventListener("blur", () => validarCampoIndividual(el));
    });
});

/* ======================== GUARDAR ======================== */
function guardarCambios() {
    if (validarCampos()) {
        const idUsuario = $("#txtId").val();
        const nuevoModelo = {
            "Id": idUsuario !== "" ? idUsuario : 0,
            "Usuario": $("#txtUsuario").val(),
            "Nombre": $("#txtNombre").val(),
            "Apellido": $("#txtApellido").val(),
            "DNI": $("#txtDni").val(),
            "Telefono": $("#txtTelefono").val(),
            "Direccion": $("#txtDireccion").val(),
            "IdRol": $("#Roles").val(),
            "IdEstado": $("#Estados").val(),
            "Contrasena": idUsuario === "" ? $("#txtContrasena").val() : "",
            "ContrasenaNueva": $("#txtContrasenaNueva").val(),
            "CambioAdmin": 1,
            "Unidades": acc_buildPayload(), // <<=== payload accesos
        };

        const url = idUsuario === "" ? "/Usuarios/Insertar" : "/Usuarios/Actualizar";
        const method = idUsuario === "" ? "POST" : "PUT";

        fetch(url, {
            method: method,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(dataJson => {
                let mensaje = idUsuario === "" ? "Usuario registrado correctamente" : "Usuario modificado correctamente";
                if (dataJson.valor === 'Contrasena') {
                    mensaje = "Contrasena incorrecta";
                    errorModal(mensaje);
                    return false;
                } else {
                    $('#modalEdicion').modal('hide');
                    exitoModal(mensaje);
                }
                listaUsuarios();
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        return false;
    }
}

function nuevoUsuario() {
    limpiarModal();
    listaEstados();
    listaRoles();
    acc_initUI(0);
    activarTabDatos();
    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Registrar");
    $("#modalEdicionLabel").text("Nuevo Usuario");

    document.getElementById("divContrasena").removeAttribute("hidden");
    document.getElementById("divContrasenaNueva").setAttribute("hidden", "hidden");
}

async function mostrarModal(modelo) {
    limpiarModal();
    await acc_initUI(modelo.Id);
    activarTabDatos();

    const campos = ["Id", "Usuario", "Nombre", "Apellido", "Dni", "Telefono", "Direccion", "Contrasena", "ContrasenaNueva"];
    campos.forEach(campo => { $(`#txt${campo}`).val(modelo[campo]); });

    await listaEstados();
    await listaRoles();

    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Guardar");
    $("#modalEdicionLabel").text("Editar Usuario");

    document.getElementById("divContrasena").setAttribute("hidden", "hidden");
    document.getElementById("divContrasenaNueva").removeAttribute("hidden");
}

/* ======================== LISTA / DT ======================== */
async function listaUsuarios() {
    let paginaActual = gridUsuarios != null ? gridUsuarios.page() : 0;
    const url = `/Usuarios/Lista`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Error en la solicitud: ${response.statusText}`);
    }

    const data = await response.json();
    await configurarDataTable(data);

    if (paginaActual > 0) {
        gridUsuarios.page(paginaActual).draw('page');
    }
}

const editarUsuario = id => {
    $('.acciones-dropdown').hide();

    fetch("/Usuarios/EditarInfo?id=" + id, {
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
        .catch(() => errorModal("Ha ocurrido un error."));
};

async function eliminarUsuario(id) {
    $('.acciones-dropdown').hide();
    const confirmado = await confirmarModal("¿Desea eliminar este usuario?");
    if (!confirmado) return;

    try {
        const response = await fetch("/Usuarios/Eliminar?id=" + id, {
            method: "DELETE",
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error("Error al eliminar el Usuario.");

        const dataJson = await response.json();
        if (dataJson.valor) {
            listaUsuarios();
            exitoModal("Usuario eliminado correctamente");
        }
    } catch (error) {
        console.error("Ha ocurrido un error:", error);
    }
}

async function configurarDataTable(data) {
    if (!gridUsuarios) {
        $('#grd_Usuarios thead tr').clone(true).addClass('filters').appendTo('#grd_Usuarios thead');
        gridUsuarios = $('#grd_Usuarios').DataTable({
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
                    data: null,
                    title: '',
                    width: "1%",
                    render: function (_data, _type, row) {
                        const id = pick(row, 'Id');
                        return `
      <div class="acciones-menu" data-id="${id}">
        <button class='btn btn-sm btnacciones' type='button' title='Acciones'>
          <i class='fa fa-ellipsis-v fa-lg text-white' aria-hidden='true'></i>
        </button>
        <div class="acciones-dropdown" style="display:none;">
          <button class='btn btn-sm btneditar'  type='button' onclick='editarUsuario(${id})'   title='Editar'>
            <i class='fa fa-pencil-square-o fa-lg text-success' aria-hidden='true'></i> Editar
          </button>
          <button class='btn btn-sm btneliminar' type='button' onclick='eliminarUsuario(${id})' title='Eliminar'>
            <i class='fa fa-trash-o fa-lg text-danger' aria-hidden='true'></i> Eliminar
          </button>
        </div>
      </div>`;
                    },
                    orderable: false,
                    searchable: false,
                },
                { data: null, render: (_d, _t, row) => pick(row, 'Usuario') },
                { data: null, render: (_d, _t, row) => pick(row, 'Nombre') },
                { data: null, render: (_d, _t, row) => pick(row, 'Apellido') },
                { data: null, render: (_d, _t, row) => pick(row, 'Dni') },
                { data: null, render: (_d, _t, row) => pick(row, 'Telefono') },
                { data: null, render: (_d, _t, row) => pick(row, 'Direccion') },
                { data: null, render: (_d, _t, row) => pick(row, 'Rol') },
                {
                    data: null,
                    render: function (_d, _t, row) {
                        const estado = pick(row, 'Estado');
                        return estado === "Bloqueado" ? `<span style="color: red">${estado}</span>` : estado;
                    }
                },
            ],
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'excelHtml5',
                    text: 'Exportar Excel',
                    filename: 'Reporte Usuarios',
                    title: '',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7] },
                    className: 'btn-exportar-excel',
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Reporte Usuarios',
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

            initComplete: async function () {
                var api = this.api();

                columnConfig.forEach(async (config) => {
                    var cell = $('.filters th').eq(config.index);

                    if (config.filterType === 'select') {
                        var select = $('<select id="filter' + config.index + '"><option value="">Seleccionar</option></select>')
                            .appendTo(cell.empty())
                            .on('change', async function () {
                                var val = $(this).val();
                                var selectedText = $(this).find('option:selected').text();
                                await api.column(config.index).search(val ? '^' + selectedText + '$' : '', true, false).draw();
                            });

                        var data = await config.fetchDataFunc();
                        data.forEach(function (item) {
                            select.append('<option value="' + item.Id + '">' + item.Nombre + '</option>');
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
                                    .search(this.value != '' ? regexr.replace('{search}', '(((' + this.value + ')))') : '', this.value != '', this.value == '')
                                    .draw();
                                $(this).focus()[0].setSelectionRange(cursorPosition, cursorPosition);
                            });
                    }
                });

                $('.filters th').eq(0).html('');
                configurarOpcionesColumnas();

                setTimeout(function () { gridUsuarios.columns.adjust(); }, 10);

                actualizarKpisUsuarios(data);
            },
        });
    } else {
        gridUsuarios.clear().rows.add(data).draw();
        actualizarKpisUsuarios(data);
    }
}

async function listaRoles() {
    const url = `/Roles/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    $('#Roles option').remove();
    const select = document.getElementById("Roles");
    for (let i = 0; i < data.length; i++) {
        const option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);
    }
}

async function listaEstados() {
    const url = `/EstadosUsuarios/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    $('#Estados option').remove();
    const select = document.getElementById("Estados");
    for (let i = 0; i < data.length; i++) {
        const option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);
    }
}

async function listaEstadosFilter() {
    const url = `/EstadosUsuarios/Lista`;
    const response = await fetch(url);
    const data = await response.json();
    return data.map(estado => ({ Id: estado.Id, Nombre: estado.Nombre }));
}

async function listaRolesFilter() {
    const url = `/Roles/Lista`;
    const response = await fetch(url);
    const data = await response.json();
    return data.map(rol => ({ Id: rol.Id, Nombre: rol.Nombre }));
}

function configurarOpcionesColumnas() {
    const grid = $('#grd_Usuarios').DataTable();
    const columnas = grid.settings().init().columns;
    const container = $('#configColumnasMenu');

    const storageKey = `Usuarios_Columnas`;
    const savedConfig = JSON.parse(localStorage.getItem(storageKey)) || {};

    container.empty();

    columnas.forEach((col, index) => {
        if (col && col.data !== "Id") {
            const isChecked = savedConfig && savedConfig[`col_${index}`] !== undefined ? savedConfig[`col_${index}`] : true;
            grid.column(index).visible(isChecked);

            const columnName = index != 6
                ? (typeof col.data === 'string' ? col.data : $(grid.column(index).header()).text().trim())
                : "Direccion";

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

function toggleAcciones(id) {
    var $dropdown = $(`.acciones-menu[data-id="${id}"] .acciones-dropdown`);
    if ($dropdown.is(":visible")) $dropdown.hide();
    else { $('.acciones-dropdown').hide(); $dropdown.show(); }
}

$(document).on('click', function (e) {
    if (!$(e.target).closest('.acciones-menu').length) {
        $('.acciones-dropdown').hide();
    }
});

function limpiarModal() {
    const formulario = document.querySelector("#modalEdicion");
    if (!formulario) return;

    formulario.querySelectorAll("input, select, textarea").forEach(el => {
        if (el.tagName === "SELECT") el.selectedIndex = 0;
        else el.value = "";
        el.classList.remove("is-invalid", "is-valid");
    });

    const errorMsg = document.getElementById("errorCampos");
    if (errorMsg) errorMsg.classList.add("d-none");
}

function validarCampoIndividual(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id;
    const valor = el.value ? el.value.trim() : "";
    const feedback = el.nextElementSibling;

    if (id != "txtNombre" && id != "txtContrasena" && id != "txtUsuario") return;

    if (tag === "input" || tag === "select" || tag === "textarea") {
        if (feedback && feedback.classList.contains("invalid-feedback")) feedback.textContent = "Campo obligatorio";
        if (valor === "" || valor === "Seleccionar") { el.classList.add("is-invalid"); el.classList.remove("is-valid"); }
        else { el.classList.remove("is-invalid"); el.classList.add("is-valid"); }
    }
    verificarErroresGenerales();
}

function verificarErroresGenerales() {
    const errorMsg = document.getElementById("errorCampos");
    const hayInvalidos = document.querySelectorAll("#modalEdicion .is-invalid").length > 0;
    if (!errorMsg) return;
    if (!hayInvalidos) errorMsg.classList.add("d-none");
}

function validarCampos() {
    const campos = ["#txtNombre", "#txtUsuario", "#txtContrasena"];
    let valido = true;
    campos.forEach(selector => {
        const campo = document.querySelector(selector);
        const valor = campo?.value.trim();
        const feedback = campo?.nextElementSibling;
        if (!campo || !valor || valor === "Seleccionar") {
            campo.classList.add("is-invalid"); campo.classList.remove("is-valid");
            if (feedback) feedback.textContent = "Campo obligatorio";
            valido = false;
        } else { campo.classList.remove("is-invalid"); campo.classList.add("is-valid"); }
    });
    document.getElementById("errorCampos").classList.toggle("d-none", valido);
    return valido;
}

function actualizarKpisUsuarios(data) {
    const cant = Array.isArray(data) ? data.length : 0;
    const el = document.getElementById('kpiCantUsuarios');
    if (el) el.textContent = cant;
}

/* ================================================================
 *      ACCESOS (Unidades + Locales) — CON CHECKS Y QUITAR TODO
 * ================================================================ */
let _ACC_CAT_UNIDADES = [];   // [{Id, Nombre}]
let _ACC_CAT_LOCALES = [];   // [{Id, IdCombo, Nombre}]
let _ACC_ENABLED = new Map(); // unitId -> boolean (tiene acceso)
let _ACC_LOCALES_SET = new Map(); // unitId -> Set(localId)
let _ACC_UNIDAD_ACTIVA = null;

/* Toast dentro del modal (aparece 2.5s) */
function acc_toast(msg) {
    const box = document.getElementById('accToast');
    const span = document.getElementById('accToastMsg');
    if (!box || !span) return;
    span.textContent = msg || 'Listo.';
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    setTimeout(() => box.classList.remove('show'), 2500);
}

/* Activar tab Datos para que no quede en Accesos al abrir */
function activarTabDatos() {
    const btnDatos = document.querySelector('#tab-datos');
    if (!btnDatos) return;
    if (window.bootstrap && bootstrap.Tab) new bootstrap.Tab(btnDatos).show();
    else btnDatos.click();
}

function normalizeAsignacion(a) {
    if (!a) return null;
    const idU = a.IdUnidadNegocio ?? a.IdCombo ?? a.UnidadId ?? a.Id;
    if (idU == null) return null;

    const enabled = (a.Enabled === true) || (a.TodosLocales === true) || (Array.isArray(a.LocalesIds) && a.LocalesIds.length >= 0);
    let locales = a.LocalesIds ?? a.Locales ?? a.IdLocales ?? [];
    if (typeof locales === 'string') locales = locales.split(',').map(s => Number(s)).filter(n => !isNaN(n));
    locales = Array.isArray(locales) ? locales.map(Number).filter(n => !isNaN(n)) : [];
    if (a.TodosLocales === true) locales = []; // set vacío => todos
    return { IdUnidadNegocio: Number(idU), Enabled: !!enabled, LocalesIds: locales };
}

async function acc_cargarCatalogos() {
    const rh = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' };

    const rU = await fetch('/UnidadesNegocio/Lista', { headers: rh });
    _ACC_CAT_UNIDADES = await rU.json(); if (!Array.isArray(_ACC_CAT_UNIDADES)) _ACC_CAT_UNIDADES = [];

    const rL = await fetch('/Locales/Lista', { headers: rh });
    _ACC_CAT_LOCALES = await rL.json(); if (!Array.isArray(_ACC_CAT_LOCALES)) _ACC_CAT_LOCALES = [];
}

function acc_localesDeUnidad(idU) {
    return _ACC_CAT_LOCALES.filter(l => Number(l.IdCombo) === Number(idU));
}

function acc_renderUnidades() {
    const wrap = document.getElementById('accUnidadesList');
    if (!wrap) return;

    wrap.innerHTML = '';

    _ACC_CAT_UNIDADES.forEach(u => {
        // Estado inicial por si no existe
        if (!_ACC_ENABLED.has(u.Id)) _ACC_ENABLED.set(u.Id, false);
        if (!_ACC_LOCALES_SET.has(u.Id)) _ACC_LOCALES_SET.set(u.Id, new Set());

        const enabled = _ACC_ENABLED.get(u.Id) === true;
        const isActive = (_ACC_UNIDAD_ACTIVA === u.Id);

        const row = document.createElement('div');
        row.className = `list-group-item ${isActive ? 'unit-active' : ''}`;

        row.innerHTML = `
            <div class="unit-head">
                <div class="unit-name" data-open="${u.Id}" title="Ver locales">
                    <i class="fa fa-building-o"></i>
                    <span>${u.Nombre}</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge ${enabled ? 'bg-success' : 'bg-secondary'}">
                        ${enabled ? 'Con acceso' : 'Sin acceso'}
                    </span>
                    <div class="form-check form-switch m-0">
                        <input class="form-check-input accUnitChk" type="checkbox"
                               data-unit="${u.Id}" ${enabled ? 'checked' : ''}>
                    </div>
                </div>
            </div>
        `;
        wrap.appendChild(row);
    });

    // Abrir unidad (1 clic) y repintar activo
    wrap.querySelectorAll('[data-open]').forEach(btn => {
        btn.addEventListener('click', e => {
            const idU = Number(e.currentTarget.getAttribute('data-open'));
            _ACC_UNIDAD_ACTIVA = idU;
            acc_renderUnidades();  // repinta para aplicar .unit-active
            acc_renderLocales();   // refresca locales de la unidad activa
        });
    });

    // Toggle acceso por unidad (switch)
    wrap.querySelectorAll('.accUnitChk').forEach(chk => {
        chk.addEventListener('change', e => {
            const idU = Number(e.target.getAttribute('data-unit'));
            const on = !!e.target.checked;

            _ACC_ENABLED.set(idU, on);
            if (!on) _ACC_LOCALES_SET.set(idU, new Set()); // al desactivar, vaciar selección

            acc_renderUnidades();         // refresca badges y estado activo
            if (_ACC_UNIDAD_ACTIVA === idU) acc_renderLocales();
            acc_renderChips();
            acc_toast(on ? 'Acceso concedido a la unidad.' : 'Acceso removido de la unidad.');
        });
    });

    // Si no hay unidad activa, seleccionar la primera y renderizar locales
    if (_ACC_UNIDAD_ACTIVA == null && _ACC_CAT_UNIDADES.length) {
        _ACC_UNIDAD_ACTIVA = _ACC_CAT_UNIDADES[0].Id;
        acc_renderUnidades();
        acc_renderLocales();
    }
}


function acc_renderLocales() {
    const list = document.getElementById('accLocalesList');
    const selectAll = document.getElementById('accSelectAllLocales');
    const header = document.querySelector('#cardLocalesHeader h6');
    if (!list) return;

    list.innerHTML = '';
    if (!_ACC_UNIDAD_ACTIVA) {
        if (selectAll) { selectAll.checked = false; selectAll.disabled = true; }
        if (header) { header.innerHTML = `<i class="fa fa-map-marker me-2"></i>Locales`; }
        return;
    }

    const u = _ACC_CAT_UNIDADES.find(x => x.Id === _ACC_UNIDAD_ACTIVA);
    header && (header.innerHTML = `<i class="fa fa-map-marker me-2"></i>Locales — <span class="text-info">${u?.Nombre ?? ('Unidad ' + _ACC_UNIDAD_ACTIVA)}</span>`);

    const enabled = _ACC_ENABLED.get(_ACC_UNIDAD_ACTIVA) === true;
    const locales = acc_localesDeUnidad(_ACC_UNIDAD_ACTIVA);
    const setSel = _ACC_LOCALES_SET.get(_ACC_UNIDAD_ACTIVA) || new Set();

    locales.forEach(l => {
        const item = document.createElement('label');
        item.className = 'list-group-item d-flex align-items-center gap-2';
        item.innerHTML = `
            <input type="checkbox" class="form-check-input accLocalChk" value="${l.Id}" ${setSel.has(l.Id) ? 'checked' : ''} ${!enabled ? 'disabled' : ''}>
            <span class="flex-grow-1 text-truncate">${l.Nombre}</span>`;
        list.appendChild(item);
    });

    // Select All
    if (selectAll) {
        selectAll.disabled = !enabled || locales.length === 0;
        if (enabled && locales.length > 0) {
            selectAll.checked = locales.every(x => setSel.has(x.Id));
        } else selectAll.checked = false;

        selectAll.onchange = (e) => {
            if (!enabled) { e.target.checked = false; return; }
            if (e.target.checked) {
                _ACC_LOCALES_SET.set(_ACC_UNIDAD_ACTIVA, new Set(locales.map(x => x.Id)));
                list.querySelectorAll('.accLocalChk').forEach(c => c.checked = true);
            } else {
                _ACC_LOCALES_SET.set(_ACC_UNIDAD_ACTIVA, new Set());
                list.querySelectorAll('.accLocalChk').forEach(c => c.checked = false);
            }
            acc_renderChips();
        };
    }

    // Click en item
    list.querySelectorAll('.accLocalChk').forEach(ch => {
        ch.addEventListener('change', e => {
            const idL = Number(e.target.value);
            const set = _ACC_LOCALES_SET.get(_ACC_UNIDAD_ACTIVA) || new Set();
            if (e.target.checked) set.add(idL); else set.delete(idL);
            _ACC_LOCALES_SET.set(_ACC_UNIDAD_ACTIVA, set);
            // actualizar select all
            if (selectAll) {
                const all = acc_localesDeUnidad(_ACC_UNIDAD_ACTIVA);
                selectAll.checked = all.length > 0 && all.every(x => set.has(x.Id));
            }
            acc_renderChips();
        });
    });
}

function acc_renderChips() {
    const cont = document.getElementById('accResumenChips');
    if (!cont) return;
    cont.innerHTML = '';

    _ACC_CAT_UNIDADES.forEach(u => {
        if (_ACC_ENABLED.get(u.Id) !== true) return;

        const localesUnidad = acc_localesDeUnidad(u.Id);
        const total = localesUnidad.length;
        const set = _ACC_LOCALES_SET.get(u.Id) || new Set();

        let txt;
        if (total === 0) {
            // La unidad no tiene locales
            txt = 'Sin locales asignados';
        } else if (set.size === 0) {
            // Set vacío => ninguno seleccionado
            txt = 'Sin locales asignados';
        } else if (set.size === total) {
            // Seleccionó todos explícitamente (el set contiene todos los IDs)
            txt = 'Todos los locales';
        } else {
            // Selección parcial
            txt = `${set.size} de ${total} locales asignados`;
        }

        const chip = document.createElement('span');
        chip.className = 'acc-chip';
        chip.innerHTML = `
            <i class="fa fa-building-o"></i>
            <strong>${u.Nombre}</strong>
            <span>· ${txt}</span>
            <i class="fa fa-times x" title="Quitar acceso" data-xu="${u.Id}"></i>
        `;
        cont.appendChild(chip);
    });

    cont.querySelectorAll('[data-xu]').forEach(x => {
        x.addEventListener('click', e => {
            const idU = Number(e.currentTarget.getAttribute('data-xu'));
            _ACC_ENABLED.set(idU, false);
            _ACC_LOCALES_SET.set(idU, new Set());
            if (_ACC_UNIDAD_ACTIVA === idU) acc_renderLocales();
            acc_renderUnidades();
            acc_renderChips();
            acc_toast('Se quitó el acceso de la unidad.');
        });
    });
}

/* Botones del tab Accesos */
function acc_bindToolbar() {
    const btnAll = document.getElementById('btnQuitarTodo');
    if (btnAll) {
        btnAll.addEventListener('click', () => {
            _ACC_CAT_UNIDADES.forEach(u => {
                _ACC_ENABLED.set(u.Id, false);
                _ACC_LOCALES_SET.set(u.Id, new Set());
            });
            acc_renderUnidades();
            acc_renderLocales();
            acc_renderChips();
            acc_toast('Se revocó el acceso a TODAS las unidades.');
        });
    }

    const btnRef = document.getElementById('btnRefrescarAccesos');
    if (btnRef) {
        btnRef.addEventListener('click', async () => {
            const uid = Number($("#txtId").val() || 0);
            await acc_initUI(uid || 0);
            acc_toast('Accesos refrescados.');
        });
    }
}

/* INIT de Accesos: carga catálogos + asignaciones */
async function acc_initUI(idUsuario) {
    const rh = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json;charset=utf-8' };

    await acc_cargarCatalogos();

    // Estado base
    _ACC_ENABLED = new Map();
    _ACC_LOCALES_SET = new Map();
    _ACC_CAT_UNIDADES.forEach(u => {
        _ACC_ENABLED.set(u.Id, false);
        _ACC_LOCALES_SET.set(u.Id, new Set());
    });

    // Asignaciones actuales
    if (idUsuario && Number(idUsuario) > 0) {
        try {
            const res = await fetch(`/Usuarios/Asignaciones?idUsuario=${idUsuario}`, { headers: rh });
            const arr = await res.json();
            (arr || []).map(normalizeAsignacion).filter(Boolean).forEach(a => {
                _ACC_ENABLED.set(a.IdUnidadNegocio, true); // si vino listada, está habilitada
                _ACC_LOCALES_SET.set(a.IdUnidadNegocio, new Set((a.LocalesIds || []).map(Number)));
            });
        } catch { /* ignore */ }
    }

    // Unidad activa
    const firstEnabled = _ACC_CAT_UNIDADES.find(u => _ACC_ENABLED.get(u.Id) === true)?.Id;
    _ACC_UNIDAD_ACTIVA = firstEnabled ?? (_ACC_CAT_UNIDADES[0]?.Id ?? null);

    acc_renderUnidades();
    acc_renderLocales();
    acc_renderChips();
    acc_bindToolbar();
}

/* Payload para backend */
function acc_buildPayload() {
    const out = [];
    _ACC_CAT_UNIDADES.forEach(u => {
        const enabled = _ACC_ENABLED.get(u.Id) === true;
        if (!enabled) return;
        const set = _ACC_LOCALES_SET.get(u.Id) || new Set();
        out.push({
            IdUnidadNegocio: u.Id,
            Enabled: true,
            TodosLocales: set.size === 0,      // vacío => todos
            LocalesIds: Array.from(set.values())
        });
    });
    return out;
}

/* Mostrar / Ocultar contraseña */
function togglePwd(idInput) {
    const input = document.getElementById(idInput);
    if (!input) return;
    const btnIcon = event.target.closest('button').querySelector('i');
    if (input.type === "password") {
        input.type = "text";
        if (btnIcon) btnIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = "password";
        if (btnIcon) btnIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

/* Exponer funciones si las necesitás en otros lados */
window.acc_initUI = acc_initUI;
window.acc_buildPayload = acc_buildPayload;
