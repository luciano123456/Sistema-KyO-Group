let gridUsuarios;

// La columna 3 ("Dónde está") no se filtra: es presencia en vivo.
const columnConfig = [
    { index: 2, filterType: 'text' },
    { index: 4, filterType: 'text' },
    { index: 5, filterType: 'text' },
    { index: 6, filterType: 'text' },
    { index: 7, filterType: 'text' },
    { index: 8, filterType: 'text' },
    { index: 9, filterType: 'select', fetchDataFunc: listaRolesFilter },
    { index: 10, filterType: 'select', fetchDataFunc: listaEstadosFilter },
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
    initUsuariosGrid();

    // Presencia en vivo: payload mínimo, sin recargar DataTables
    setInterval(() => {
        if (document.visibilityState === "visible") refrescarPresenciaUsuarios();
    }, 15000);

    document.querySelectorAll("#modalEdicion input, #modalEdicion select, #modalEdicion textarea").forEach(el => {
        el.setAttribute("autocomplete", "off");
        el.addEventListener("input", () => validarCampoIndividual(el));
        el.addEventListener("change", () => validarCampoIndividual(el));
        el.addEventListener("blur", () => validarCampoIndividual(el));
    });
});

/* ======================== GUARDAR ======================== */
function guardarCambios() {
    if (!validarCampos()) return false;

    return withBusy("#btnGuardar", () => {
        const idUsuario = $("#txtId").val();
        const esNuevo = !idUsuario || idUsuario === "0";
        const nuevoModelo = {
            "Id": esNuevo ? 0 : idUsuario,
            "Usuario": $("#txtUsuario").val(),
            "Nombre": $("#txtNombre").val(),
            "Apellido": $("#txtApellido").val(),
            "DNI": $("#txtDni").val(),
            "Telefono": $("#txtTelefono").val(),
            "Direccion": $("#txtDireccion").val(),
            "IdRol": $("#Roles").val(),
            "IdEstado": $("#Estados").val(),
            "Contrasena": esNuevo ? $("#txtContrasena").val() : "",
            "ContrasenaNueva": $("#txtContrasenaNueva").val(),
            "CambioAdmin": 1,
            "Unidades": acc_buildPayload(), // <<=== payload accesos
        };

        const url = esNuevo ? "/Usuarios/Insertar" : "/Usuarios/Actualizar";
        const method = esNuevo ? "POST" : "PUT";

        return fetch(url, {
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
                let mensaje = esNuevo ? "Usuario registrado correctamente" : "Usuario modificado correctamente";
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
    });
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
    if (gridUsuarios) {
        kyoGridReload(gridUsuarios);
    } else {
        await initUsuariosGrid();
    }
}

const editarUsuario = id => {
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

async function duplicarUsuario(id) {
    try {
        const resp = await fetch("/Usuarios/EditarInfo?id=" + id, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });
        if (!resp.ok) throw new Error("Ha ocurrido un error.");
        const origen = await resp.json();
        if (!origen) throw new Error("Ha ocurrido un error.");

        const usuarioBase = String(origen.Usuario || "").trim();
        const copia = {
            ...origen,
            Id: 0,
            Usuario: usuarioBase ? `${usuarioBase}_copia` : "",
            Nombre: typeof kyoTextoCopia === 'function' ? kyoTextoCopia(origen.Nombre) : `${origen.Nombre || ''} (copia)`.trim(),
            Dni: "",
            Contrasena: "",
            ContrasenaNueva: ""
        };

        await mostrarModal(copia);
        $("#txtId").val("");
        await acc_initUI(0);
        document.getElementById("divContrasena")?.removeAttribute("hidden");
        document.getElementById("divContrasenaNueva")?.setAttribute("hidden", "hidden");
        $("#btnGuardar").text("Registrar");
        $("#modalEdicionLabel").text("Duplicar Usuario");
    } catch (e) {
        console.error(e);
        errorModal("Ha ocurrido un error al duplicar el usuario.");
    }
}

async function eliminarUsuario(id) {
    return eliminarConCascada({
        url: '/Usuarios/Eliminar',
        id,
        confirmMsg: '¿Desea eliminar este usuario?',
        cascadeTitulo: 'El usuario tiene registros asociados',
        cascadeLabelSi: 'Sí, eliminar usuario',
        cascadeSubSi: 'Se desvincula la auditoría; no se borran insumos ni movimientos',
        headers: () => ({
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }),
        onSuccess: async (j) => {
            listaUsuarios();
            exitoModal(j.mensaje || 'Usuario eliminado correctamente');
        }
    });
}

async function initUsuariosGrid() {
    if (window.ensureKyoExportLibs) await window.ensureKyoExportLibs();
    if (gridUsuarios) return;

    $('#grd_Usuarios thead tr').clone(true).addClass('filters').appendTo('#grd_Usuarios thead');
    gridUsuarios = $('#grd_Usuarios').DataTable({
        serverSide: true,
        processing: true,
        ajax: kyoServerGridAjax('/Usuarios/ListaPaginada'),
            language: {
                sLengthMenu: "Mostrar MENU registros",
                lengthMenu: "Anzeigen von _MENU_ Einträge",
                url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json"
            },
            scrollX: false,
            scrollCollapse: false,
            columns: [
                columnaGridAcciones(
                    { editar: 'editarUsuario', duplicar: 'duplicarUsuario', historial: 'verHistorialUsuario', eliminar: 'eliminarUsuario' },
                    'Usuarios',
                    (id, _type, row) => {
                        const base = renderAccionesGrid(id, {
                            editar: 'editarUsuario',
                            duplicar: 'duplicarUsuario',
                            historial: 'verHistorialUsuario',
                            eliminar: 'eliminarUsuario'
                        }, 'Usuarios');
                        const user = String(pick(row, 'Usuario') || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                        const btnConexiones = `<button type="button" class="btn btn-sm rp-act rp-act-view" title="Historial de conexiones" onclick="verHistorialConexionesUsuario(${id}, '${user}')"><i class="fa fa-plug"></i></button>`;
                        return base.replace('</div>', `${btnConexiones}</div>`);
                    }
                ),
                columnaGridId(),
                {
                    data: null,
                    render: function (_d, type, row) {
                        const usuario = pick(row, 'Usuario');
                        if (type === 'sort' || type === 'filter' || type === 'type') return usuario || '';
                        if (type === 'export' || type === 'print') return usuario || '';
                        const online = !!pick(row, 'EnLinea');
                        return `<span class="usr-user-cell">
                            <span class="usr-presence ${online ? 'is-online' : 'is-offline'}" title="${online ? 'En línea' : 'Desconectado'}">
                                <span class="usr-presence-dot"></span>
                            </span>
                            <span class="usr-user-name">${escapeHtmlUsr(usuario)}</span>
                            <span class="usr-presence-label ${online ? 'is-online' : 'is-offline'}">${online ? 'En línea' : 'Offline'}</span>
                        </span>`;
                    }
                },
                {
                    data: null,
                    render: function (_d, type, row) {
                        const modulo = pick(row, 'UltimoModulo');
                        const online = !!pick(row, 'EnLinea');
                        if (type === 'sort' || type === 'filter' || type === 'type') {
                            return online ? (modulo || '') : '';
                        }
                        if (type === 'export' || type === 'print') {
                            if (!online) return '';
                            return window.RpModulos ? RpModulos.label(modulo) : (modulo || '');
                        }
                        return renderDondeEstaCell(row);
                    }
                },
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
                    exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
                    className: 'btn-exportar-excel',
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Reporte Usuarios',
                    title: '',
                    exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
                    className: 'btn-exportar-pdf',
                },
                {
                    extend: 'print',
                    text: 'Imprimir',
                    title: '',
                    exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
                    className: 'btn-exportar-print'
                },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: false,

            drawCallback: function () {
                const api = this.api();

                api.rows({ page: 'current' }).every(function () {
                    pintarAvataresDondeEstaEnFila($(this.node()), this.data());
                });

                // KPI "Cantidad": la grilla es server-side, así que el total viene
                // en la respuesta ajax (no se puede contar las filas de la página).
                const json = api.ajax.json();
                actualizarKpisUsuarios(json?.recordsFiltered ?? json?.recordsTotal ?? 0);
            },

            initComplete: async function () {
                var api = this.api();

                await kyoBindColumnFilters(api, {
                    columns: columnConfig,
                    skipIndexes: [0, 1, 3]
                });

                configurarOpcionesColumnas();

                setTimeout(function () { gridUsuarios.columns.adjust(); }, 10);
            },
        });
}

async function configurarDataTable() {
    await initUsuariosGrid();
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
    initGridColumnConfig({
        gridSelector: '#grd_Usuarios',
        menuSelector: '#configColumnasMenu',
        storageKey: 'Usuarios_Columnas_v2',
        skipColumn: (col) => !col || col.data === 'Id',
        getLabel: (col, index, grid) => {
            if (index === 8) return 'Dirección';
            if (typeof col.data === 'string') return humanizeColumnLabel(col.data);
            return $(grid.column(index).header()).text().trim() || `Columna ${index}`;
        },
    });
}

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

function actualizarKpisUsuarios(cant) {
    const total = typeof cant === 'number' ? cant : (Array.isArray(cant) ? cant.length : 0);
    const el = document.getElementById('kpiCantUsuarios');
    if (el) el.textContent = total;
}

/* ================================================================
 *      ACCESOS (Unidades + Locales) → CON CHECKS Y QUITAR TODO
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

    if (!_ACC_CAT_UNIDADES.length) {
        wrap.innerHTML = `<div class="acc-empty"><i class="fa fa-building-o"></i><span>No hay unidades de negocio cargadas.</span></div>`;
        return;
    }

    _ACC_CAT_UNIDADES.forEach(u => {
        if (!_ACC_ENABLED.has(u.Id)) _ACC_ENABLED.set(u.Id, false);
        if (!_ACC_LOCALES_SET.has(u.Id)) _ACC_LOCALES_SET.set(u.Id, new Set());

        const enabled = _ACC_ENABLED.get(u.Id) === true;
        const isActive = (_ACC_UNIDAD_ACTIVA === u.Id);

        const row = document.createElement('div');
        row.className = `acc-unit-row ${isActive ? 'unit-active' : ''}`;
        row.innerHTML = `
            <div class="acc-unit-name" data-open="${u.Id}" title="Ver locales">
                <i class="fa fa-building-o"></i>
                <span>${u.Nombre}</span>
            </div>
            <div class="acc-unit-meta">
                <span class="acc-badge ${enabled ? 'acc-badge--on' : 'acc-badge--off'}">
                    ${enabled ? 'Con acceso' : 'Sin acceso'}
                </span>
                <div class="form-check form-switch m-0">
                    <input class="form-check-input accUnitChk" type="checkbox"
                           data-unit="${u.Id}" ${enabled ? 'checked' : ''}
                           onclick="event.stopPropagation()">
                </div>
            </div>
        `;
        wrap.appendChild(row);
    });

    wrap.querySelectorAll('[data-open]').forEach(btn => {
        btn.addEventListener('click', e => {
            const idU = Number(e.currentTarget.getAttribute('data-open'));
            _ACC_UNIDAD_ACTIVA = idU;
            acc_renderUnidades();
            acc_renderLocales();
        });
    });

    wrap.querySelectorAll('.accUnitChk').forEach(chk => {
        chk.addEventListener('change', e => {
            e.stopPropagation();
            const idU = Number(e.target.getAttribute('data-unit'));
            const on = !!e.target.checked;

            _ACC_ENABLED.set(idU, on);
            if (!on) _ACC_LOCALES_SET.set(idU, new Set());

            acc_renderUnidades();
            if (_ACC_UNIDAD_ACTIVA === idU) acc_renderLocales();
            acc_renderChips();
            acc_toast(on ? 'Acceso concedido a la unidad.' : 'Acceso removido de la unidad.');
        });
    });

    if (_ACC_UNIDAD_ACTIVA == null && _ACC_CAT_UNIDADES.length) {
        _ACC_UNIDAD_ACTIVA = _ACC_CAT_UNIDADES[0].Id;
        acc_renderUnidades();
        acc_renderLocales();
    }
}


function acc_renderLocales() {
    const list = document.getElementById('accLocalesList');
    const selectAll = document.getElementById('accSelectAllLocales');
    const titleEl = document.getElementById('accLocalesTitle');
    if (!list) return;

    list.innerHTML = '';
    if (!_ACC_UNIDAD_ACTIVA) {
        if (selectAll) { selectAll.checked = false; selectAll.disabled = true; }
        if (titleEl) titleEl.textContent = 'Locales';
        list.innerHTML = `<div class="acc-empty"><i class="fa fa-map-marker"></i><span>Seleccioná una unidad de negocio.</span></div>`;
        return;
    }

    const u = _ACC_CAT_UNIDADES.find(x => x.Id === _ACC_UNIDAD_ACTIVA);
    if (titleEl) {
        titleEl.innerHTML = `Locales <span class="acc-locales-title-highlight">→ ${u?.Nombre ?? ('Unidad ' + _ACC_UNIDAD_ACTIVA)}</span>`;
    }

    const enabled = _ACC_ENABLED.get(_ACC_UNIDAD_ACTIVA) === true;
    const locales = acc_localesDeUnidad(_ACC_UNIDAD_ACTIVA);
    const setSel = _ACC_LOCALES_SET.get(_ACC_UNIDAD_ACTIVA) || new Set();

    if (!locales.length) {
        list.innerHTML = `<div class="acc-empty"><i class="fa fa-map-o"></i><span>Esta unidad no tiene locales asignados.</span></div>`;
    } else {
        locales.forEach(l => {
            const item = document.createElement('label');
            item.className = `acc-local-row ${!enabled ? 'is-disabled' : ''}`;
            item.innerHTML = `
                <input type="checkbox" class="form-check-input accLocalChk" value="${l.Id}" ${setSel.has(l.Id) ? 'checked' : ''} ${!enabled ? 'disabled' : ''}>
                <span class="flex-grow-1 text-truncate">${l.Nombre}</span>`;
            list.appendChild(item);
        });
    }

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

    list.querySelectorAll('.accLocalChk').forEach(ch => {
        ch.addEventListener('change', e => {
            const idL = Number(e.target.value);
            const set = _ACC_LOCALES_SET.get(_ACC_UNIDAD_ACTIVA) || new Set();
            if (e.target.checked) set.add(idL); else set.delete(idL);
            _ACC_LOCALES_SET.set(_ACC_UNIDAD_ACTIVA, set);
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

    let any = false;
    _ACC_CAT_UNIDADES.forEach(u => {
        if (_ACC_ENABLED.get(u.Id) !== true) return;
        any = true;

        const localesUnidad = acc_localesDeUnidad(u.Id);
        const total = localesUnidad.length;
        const set = _ACC_LOCALES_SET.get(u.Id) || new Set();

        let txt;
        if (total === 0) {
            txt = 'Sin locales asignados';
        } else if (set.size === 0) {
            txt = 'Sin locales asignados';
        } else if (set.size === total) {
            txt = 'Todos los locales';
        } else {
            txt = `${set.size} de ${total} locales`;
        }

        const chip = document.createElement('span');
        chip.className = 'acc-chip';
        chip.innerHTML = `
            <i class="fa fa-building-o"></i>
            <strong>${u.Nombre}</strong>
            <span class="acc-chip-detail">· ${txt}</span>
            <i class="fa fa-times x" title="Quitar acceso" data-xu="${u.Id}"></i>
        `;
        cont.appendChild(chip);
    });

    if (!any) {
        cont.innerHTML = `<span class="acc-chip-detail" style="color:#a89bb0;font-size:0.85rem;">Sin accesos configurados todavía.</span>`;
    }

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


/* ======================== PRESENCIA / CONEXIONES ======================== */

function escapeHtmlUsr(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function parseFechaUtcUsr(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    const s = String(d).trim();
    if (!s) return null;
    // Con Z u offset: el motor ya interpreta bien.
    if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) return new Date(s);
    // Sin zona: en BD se guarda UTC → forzar interpretación UTC.
    const iso = s.includes("T") ? s : s.replace(" ", "T");
    return new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
}

function fmtFechaConexionUsr(d) {
    const dt = parseFechaUtcUsr(d);
    if (!dt || Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
}

function renderDondeEstaCell(row) {
    const online = !!pick(row, 'EnLinea');
    const key = pick(row, 'UltimoModulo');
    if (!online || !key) {
        return `<span class="usr-donde-empty">—</span>`;
    }
    const label = window.RpModulos ? RpModulos.label(key) : key;
    const url = window.RpModulos ? RpModulos.url(key) : null;
    const id = pick(row, 'Id');
    const avatarHtml = `<span class="usr-donde-avatar rp-avatar-circle rp-avatar-circle--sm" data-avatar-id="${id}"></span>`;
    const irBtn = url
        ? `<a class="usr-donde-ir" href="${url}" title="Ir a ${escapeHtmlUsr(label)}"><i class="fa fa-external-link"></i> Ir</a>`
        : "";
    return `<span class="usr-donde-cell" data-id="${id}">
        ${avatarHtml}
        <span class="usr-donde-chip">${escapeHtmlUsr(label)}</span>
        ${irBtn}
    </span>`;
}

function pintarAvataresDondeEstaEnFila($tr, row) {
    if (!window.RpAvatar || !row) return;
    if (!pick(row, 'EnLinea') || !pick(row, 'UltimoModulo')) return;
    const el = $tr.find(".usr-donde-avatar")[0];
    if (!el) return;
    RpAvatar.render(el, {
        color: pick(row, 'AvatarColor'),
        icono: pick(row, 'AvatarIcono'),
        foto: pick(row, 'AvatarFoto'),
        size: "sm"
    });
}

async function refrescarPresenciaUsuarios() {
    if (!gridUsuarios) return;
    try {
        const response = await fetch(`/Usuarios/Presencia`, {
            headers: { Authorization: "Bearer " + localStorage.getItem("JwtToken") }
        });
        if (!response.ok) return;
        const data = await response.json();
        const map = new Map((data || []).map(x => [Number(x.Id), x]));
        const enCards = window.RpGridView && !RpGridView.debeMostrarTabla();
        let huboCambios = false;

        gridUsuarios.rows({ page: "current" }).every(function () {
            const row = this.data();
            if (!row) return true;
            const id = Number(pick(row, 'Id'));
            const remote = map.get(id);
            if (!remote) return true;

            const online = !!remote.EnLinea;
            const modulo = online ? (remote.UltimoModulo || null) : null;
            const sameOnline = !!row.EnLinea === online;
            const sameModulo = (row.UltimoModulo || null) === modulo;
            const sameAvatar =
                (row.AvatarColor || null) === (remote.AvatarColor || null)
                && (row.AvatarIcono || null) === (remote.AvatarIcono || null)
                && (row.AvatarFoto || null) === (remote.AvatarFoto || null);

            if (sameOnline && sameModulo && sameAvatar) return true;

            huboCambios = true;
            row.EnLinea = online;
            row.UltimoModulo = modulo;
            row.AvatarColor = remote.AvatarColor;
            row.AvatarIcono = remote.AvatarIcono;
            row.AvatarFoto = remote.AvatarFoto;

            if (enCards) return true;

            const $tr = $(this.node());
            const $cell = $tr.find(".usr-user-cell");
            if ($cell.length) {
                $cell.find(".usr-presence")
                    .toggleClass("is-online", online)
                    .toggleClass("is-offline", !online)
                    .attr("title", online ? "En línea" : "Desconectado");
                $cell.find(".usr-presence-label")
                    .toggleClass("is-online", online)
                    .toggleClass("is-offline", !online)
                    .text(online ? "En línea" : "Offline");
            }

            // Se ubica la celda por API y no por posición del <td>: si se ocultan
            // columnas desde el dropdown, el índice en el DOM ya no coincide.
            const celdaDonde = gridUsuarios.cell(this.index(), 3).node();
            if (celdaDonde) {
                $(celdaDonde).html(renderDondeEstaCell(row));
                pintarAvataresDondeEstaEnFila($tr, row);
            }
            return true;
        });

        if (huboCambios && enCards && window.RpGridView) {
            RpGridView.renderCards("usuarios");
        }
    } catch {
        /* silencioso: no impacta UX */
    }
}

window.verHistorialConexionesUsuario = async function (id, usuarioNombre) {
    const modalEl = document.getElementById("modalHistorialConexionesUsr");
    if (!modalEl) return;

    $("#usrConnTitulo").text(usuarioNombre || ("Usuario #" + id));
    $("#usrConnSub").text("Cargando movimientos…");
    $("#usrConnKpis").html("");
    $("#usrConnTimeline").html(`<div class="usr-conn-loading"><i class="fa fa-spinner fa-spin"></i> Cargando historial…</div>`);

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    try {
        const response = await fetch(`/Usuarios/HistorialConexiones?id=${id}&take=150`, {
            headers: { Authorization: "Bearer " + localStorage.getItem("JwtToken") }
        });
        if (!response.ok) throw new Error("No se pudo cargar el historial");
        const data = await response.json();

        const online = !!data.EnLinea;
        $("#usrConnTitulo").text(data.Usuario || usuarioNombre || ("#" + id));
        $("#usrConnSub").html(
            `${escapeHtmlUsr(data.NombreCompleto || "")} · ` +
            `<span class="usr-presence-label ${online ? "is-online" : "is-offline"}">${online ? "En línea ahora" : "Desconectado"}</span>` +
            (data.FechaUltimaActividad ? ` · última actividad ${fmtFechaConexionUsr(data.FechaUltimaActividad)}` : "")
        );

        $("#usrConnKpis").html(`
            <div class="usr-conn-kpi"><span>Conexiones</span><strong>${data.TotalConexiones || 0}</strong></div>
            <div class="usr-conn-kpi"><span>Salidas</span><strong>${data.TotalDesconexiones || 0}</strong></div>
            <div class="usr-conn-kpi"><span>Eventos</span><strong>${(data.Eventos || []).length}</strong></div>
        `);

        const eventos = Array.isArray(data.Eventos) ? data.Eventos : [];
        if (!eventos.length) {
            $("#usrConnTimeline").html(`<div class="usr-conn-empty">Todavía no hay conexiones registradas para este usuario.</div>`);
            return;
        }

        $("#usrConnTimeline").html(eventos.map(ev => {
            const tipo = Number(ev.Tipo);
            const cls = tipo === 1 ? "is-in" : (tipo === 3 ? "is-exp" : "is-out");
            const icon = tipo === 1 ? "fa-sign-in" : (tipo === 3 ? "fa-clock-o" : "fa-sign-out");
            return `<article class="usr-conn-item ${cls}">
                <div class="usr-conn-icon"><i class="fa ${icon}"></i></div>
                <div class="usr-conn-body">
                    <div class="usr-conn-head">
                        <strong>${escapeHtmlUsr(ev.TipoNombre || "Evento")}</strong>
                        <time>${fmtFechaConexionUsr(ev.Fecha)}</time>
                    </div>
                    <div class="usr-conn-meta">
                        ${ev.Detalle ? `<span>${escapeHtmlUsr(ev.Detalle)}</span>` : ""}
                    </div>
                </div>
            </article>`;
        }).join(""));
    } catch (e) {
        console.error(e);
        $("#usrConnTimeline").html(`<div class="usr-conn-empty">No se pudo cargar el historial de conexiones.</div>`);
        $("#usrConnSub").text("Error al cargar");
    }
};
