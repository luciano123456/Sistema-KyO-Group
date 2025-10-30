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
}

$(document).ready(() => {

    listaUsuarios();

    document.querySelectorAll("#modalEdicion input, #modalEdicion select, #modalEdicion textarea").forEach(el => {
        el.setAttribute("autocomplete", "off");
        el.addEventListener("input", () => validarCampoIndividual(el));
        el.addEventListener("change", () => validarCampoIndividual(el));
        el.addEventListener("blur", () => validarCampoIndividual(el));
    });

})

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
            "Unidades": acc_buildPayload(),
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
    campos.forEach(campo => {
        $(`#txt${campo}`).val(modelo[campo]);
    });

    await listaEstados();
    await listaRoles();

    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Guardar");
    $("#modalEdicionLabel").text("Editar Usuario");

    document.getElementById("divContrasena").setAttribute("hidden", "hidden");
    document.getElementById("divContrasenaNueva").removeAttribute("hidden");



}

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
    $('.acciones-dropdown').hide(); // Cerrar todos los dropdowns

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
        .catch(error => {
            errorModal("Ha ocurrido un error.");
        });
};


async function eliminarUsuario(id) {
    $('.acciones-dropdown').hide(); // Cerrar todos los dropdowns
    const confirmado = await confirmarModal("¿Desea eliminar este usuario?");
    if (!confirmado) return;

    if (confirmado) {
        try {

            const response = await fetch("/Usuarios/Eliminar?id=" + id, {
                method: "DELETE",
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error("Error al eliminar el Usuario.");
            }

            const dataJson = await response.json();

            if (dataJson.valor) {
                listaUsuarios();
                exitoModal("Usuario eliminado correctamente");
            }
        } catch (error) {
            console.error("Ha ocurrido un error:", error);
        }
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
                    data: "Id",
                    title: '',
                    width: "1%", // Ancho fijo para la columna
                    render: function (data) {
                        return `
                <div class="acciones-menu" data-id="${data}">
                    <button class='btn btn-sm btnacciones' type='button' onclick='toggleAcciones(${data})' title='Acciones'>
                        <i class='fa fa-ellipsis-v fa-lg text-white' aria-hidden='true'></i>
                    </button>
                    <div class="acciones-dropdown" style="display: none;">
                        <button class='btn btn-sm btneditar' type='button' onclick='editarUsuario(${data})' title='Editar'>
                            <i class='fa fa-pencil-square-o fa-lg text-success' aria-hidden='true'></i> Editar
                        </button>
                        <button class='btn btn-sm btneliminar' type='button' onclick='eliminarUsuario(${data})' title='Eliminar'>
                            <i class='fa fa-trash-o fa-lg text-danger' aria-hidden='true'></i> Eliminar
                        </button>
                    </div>
                </div>`;
                    },
                    orderable: false,
                    searchable: false,
                },
                { data: 'Usuario' },
                { data: 'Nombre' },
                { data: 'Apellido' },
                { data: 'Dni' },
                { data: 'Telefono' },
                { data: 'Direccion' },
                { data: 'Rol' },
                {
                    data: 'Estado',
                    render: function (data, type, row) {
                        // Verificar si el estado es "Bloqueado" y aplicar el color rojo
                        return data === "Bloqueado" ? `<span style="color: red">${data}</span>` : data;
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
                    exportOptions: {
                        columns: [1, 2, 3, 4, 5, 6, 7]
                    },
                    className: 'btn-exportar-excel',
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Reporte Usuarios',
                    title: '',
                    exportOptions: {
                        columns: [1, 2, 3, 4, 5, 6, 7]
                    },
                    className: 'btn-exportar-pdf',
                },
                {
                    extend: 'print',
                    text: 'Imprimir',
                    title: '',
                    exportOptions: {
                        columns: [1, 2,3,4,5,6,7]
                    },
                    className: 'btn-exportar-print'
                },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: true,

            initComplete: async function () {
                var api = this.api();

                // Iterar sobre las columnas y aplicar la configuración de filtros
                columnConfig.forEach(async (config) => {
                    var cell = $('.filters th').eq(config.index);

                    if (config.filterType === 'select') {
                        var select = $('<select id="filter' + config.index + '"><option value="">Seleccionar</option></select>')
                            .appendTo(cell.empty())
                            .on('change', async function () {
                                var val = $(this).val();
                                var selectedText = $(this).find('option:selected').text(); // Obtener el texto del nombre visible
                                await api.column(config.index).search(val ? '^' + selectedText + '$' : '', true, false).draw(); // Buscar el texto del nombre
                            });

                        var data = await config.fetchDataFunc(); // Llamada a la función para obtener los datos
                        data.forEach(function (item) {
                            select.append('<option value="' + item.Id + '">' + item.Nombre + '</option>')
                        });

                    } else if (config.filterType === 'text') {
                        var input = $('<input type="text" placeholder="Buscar..." />')
                            .appendTo(cell.empty())
                            .off('keyup change') // Desactivar manejadores anteriores
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

                setTimeout(function () {
                    gridUsuarios.columns.adjust();
                }, 10);

                actualizarKpisUsuarios(data)

                $('body').on('mouseenter', '#grd_Usuarios .fa-map-marker', function () {
                    $(this).css('cursor', 'pointer');
                });



                $('body').on('click', '#grd_Usuarios .fa-map-marker', function () {
                    var locationText = $(this).parent().text().trim().replace(' ', ' '); // Obtener el texto visible
                    var url = 'https://www.google.com/maps?q=' + encodeURIComponent(locationText);
                    window.open(url, '_blank');
                });

            },
        });
    } else {
        gridUsuarios.clear().rows.add(data).draw();
        actualizarKpisUsuarios(data)
    }
}


async function listaRoles() {
    const url = `/Roles/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    $('#Roles option').remove();

    select = document.getElementById("Roles");

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
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

    select = document.getElementById("Estados");

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}

async function listaEstadosFilter() {
    const url = `/EstadosUsuarios/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    return data.map(estado => ({
        Id: estado.Id,
        Nombre: estado.Nombre
    }));

}

async function listaRolesFilter() {
    const url = `/Roles/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    return data.map(rol => ({
        Id: rol.Id,
        Nombre: rol.Nombre
    }));

}

function configurarOpcionesColumnas() {
    const grid = $('#grd_Usuarios').DataTable(); // Accede al objeto DataTable utilizando el id de la tabla
    const columnas = grid.settings().init().columns; // Obtiene la configuración de columnas
    const container = $('#configColumnasMenu'); // El contenedor del dropdown específico para configurar columnas

    const storageKey = `Usuarios_Columnas`; // Clave única para esta pantalla

    const savedConfig = JSON.parse(localStorage.getItem(storageKey)) || {}; // Recupera configuración guardada o inicializa vacía

    container.empty(); // Limpia el contenedor

    columnas.forEach((col, index) => {
        if (col.data && col.data !== "Id") { // Solo agregar columnas que no sean "Id"
            // Recupera el valor guardado en localStorage, si existe. Si no, inicializa en 'false' para no estar marcado.
            const isChecked = savedConfig && savedConfig[`col_${index}`] !== undefined ? savedConfig[`col_${index}`] : true;

            // Asegúrate de que la columna esté visible si el valor es 'true'
            grid.column(index).visible(isChecked);

            const columnName = index != 6 ? col.data : "Direccion";

            // Ahora agregamos el checkbox, asegurándonos de que se marque solo si 'isChecked' es 'true'
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

    // Asocia el evento para ocultar/mostrar columnas
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

    // Si está visible, lo ocultamos, si está oculto lo mostramos
    if ($dropdown.is(":visible")) {
        $dropdown.hide();
    } else {
        // Ocultar todos los dropdowns antes de mostrar el seleccionado
        $('.acciones-dropdown').hide();
        $dropdown.show();
    }
}

$(document).on('click', function (e) {
    // Verificar si el clic está fuera de cualquier dropdown
    if (!$(e.target).closest('.acciones-menu').length) {
        $('.acciones-dropdown').hide(); // Cerrar todos los dropdowns
    }
});


function limpiarModal() {
    const formulario = document.querySelector("#modalEdicion");
    if (!formulario) return;

    formulario.querySelectorAll("input, select, textarea").forEach(el => {
        if (el.tagName === "SELECT") {
            el.selectedIndex = 0;
        } else {
            el.value = "";
        }
        el.classList.remove("is-invalid", "is-valid");
    });

    // Ocultar mensaje general de error
    const errorMsg = document.getElementById("errorCampos");
    if (errorMsg) errorMsg.classList.add("d-none");
}


function validarCampoIndividual(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id;
    const valor = el.value ? el.value.trim() : ""; // Para inputs/selects

    const feedback = el.nextElementSibling;

    if (id != "txtNombre" && id != "txtContrasena" && id != "txtUsuario") return //Solo valida el nombre


    // Validación para inputs/selects normales
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

    verificarErroresGenerales();
}

function verificarErroresGenerales() {
    const errorMsg = document.getElementById("errorCampos");
    const hayInvalidos = document.querySelectorAll("#modalEdicion .is-invalid").length > 0;
    if (!errorMsg) return;

    if (!hayInvalidos) {
        errorMsg.classList.add("d-none");
    }
}

function validarCampos() {
    const campos = [
        "#txtNombre",
        "#txtUsuario",
        "#txtContrasena"
    ];

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

    document.getElementById("errorCampos").classList.toggle("d-none", valido);
    return valido;
}



function actualizarKpisUsuarios(data) {
    const cant = Array.isArray(data) ? data.length : 0;
    const el = document.getElementById('kpiCantUsuarios');
    if (el) el.textContent = cant;
}

/* ================================================================
 *  ACCESOS (Unidades de Negocio + Locales) - SIEMPRE REFRESCA
 * ================================================================ */
let _ACC_CAT_UNIDADES = null;     // [{Id, Nombre}]
let _ACC_CAT_LOCALES = null;     // [{Id, IdCombo, NombreCombo, Nombre}]
let _ACC_ASIGN = [];       // [{IdUnidadNegocio, LocalesIds:number[]}]
let _ACC_UNIDAD_ACTIVA = null;


function activarTabDatos() {
    // Botón del tab "Datos"
    const btnDatos = document.querySelector('#tab-datos');
    if (!btnDatos) return;

    // Si existe Bootstrap.Tab, usarlo (BS5)
    if (window.bootstrap && bootstrap.Tab) {
        const tab = new bootstrap.Tab(btnDatos);
        tab.show();
    } else {
        // Fallback: click directo (por si no está bootstrap.Tab)
        btnDatos.click();
    }
}

// Normalizador robusto (por si el backend cambia la forma)
function normalizeAsignacion(a) {
    if (!a) return null;
    const idU =
        (a.IdUnidadNegocio != null ? a.IdUnidadNegocio :
            (a.IdCombo != null ? a.IdCombo :
                (a.UnidadId != null ? a.UnidadId :
                    (a.Id != null ? a.Id : null))));
    if (idU == null) return null;

    let candidates = (
        a.LocalesIds ??
        a.Locales ??
        a.IdLocales ??
        a.Ids ??
        a.Items ??
        []
    );
    if (typeof candidates === 'string') {
        candidates = candidates.split(',').map(s => s.trim()).filter(s => s.length);
    }
    const toNum = (x) => {
        if (x == null) return null;
        if (typeof x === 'number') return x;
        if (typeof x === 'string') { const n = Number(x); return isNaN(n) ? null : n; }
        if (typeof x === 'object') {
            if (x.Id != null) return Number(x.Id);
            if (x.IdLocal != null) return Number(x.IdLocal);
            if (x.LocalId != null) return Number(x.LocalId);
            if (x.IdLocalNavigation && x.IdLocalNavigation.Id != null) return Number(x.IdLocalNavigation.Id);
        }
        return null;
    };
    const localesNums = Array.from(new Set((Array.isArray(candidates) ? candidates : [candidates]).map(toNum).filter(n => n != null && !isNaN(n))));
    return { IdUnidadNegocio: Number(idU), LocalesIds: localesNums };
}

// SIEMPRE refresca catálogos desde backend
async function acc_cargarCatalogos() {
    // Unidades
    const resU = await fetch('/UnidadesNegocio/Lista', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json;charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
    if (!resU.ok) throw new Error(resU.statusText);
    _ACC_CAT_UNIDADES = await resU.json();
    _ACC_CAT_UNIDADES = Array.isArray(_ACC_CAT_UNIDADES) ? _ACC_CAT_UNIDADES : [];

    // Locales
    const resL = await fetch('/Locales/Lista', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json;charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
    if (!resL.ok) throw new Error(resL.statusText);
    _ACC_CAT_LOCALES = await resL.json();
    _ACC_CAT_LOCALES = Array.isArray(_ACC_CAT_LOCALES) ? _ACC_CAT_LOCALES : [];
}

// plantilla de tarjeta de unidad (single-select)
function acc_templateUnidad(u, active) {
    return `
    <div class="acc-unit-item list-group-item d-flex align-items-center justify-content-between ${active ? 'active' : ''}"
         data-id="${u.Id}"
         style="border:1px solid rgba(255,255,255,.08); border-radius:12px; background:${active ? '#1f2a52' : 'rgba(255,255,255,.04)'}; color:#e7e9fb; margin-bottom:12px; cursor:pointer;">
      <div class="d-flex align-items-center gap-2 py-2 px-3">
        <i class="fa fa-building-o"></i>
        <span class="text-truncate">${u.Nombre}</span>
      </div>
      <i class="fa fa-angle-right me-3 text-muted"></i>
    </div>`;
}

async function acc_renderUnidades(activeId, forceReload = false) {
    if (forceReload) {
        const resU = await fetch('/UnidadesNegocio/Lista', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json;charset=utf-8',
                'Cache-Control': 'no-store'
            }
        });
        if (!resU.ok) throw new Error(resU.statusText);
        _ACC_CAT_UNIDADES = await resU.json();
        _ACC_CAT_UNIDADES = Array.isArray(_ACC_CAT_UNIDADES) ? _ACC_CAT_UNIDADES : [];
    }

    const cont = document.getElementById('accUnidadesList');
    if (!cont) return;

    cont.innerHTML = '';

    const existe = _ACC_CAT_UNIDADES.some(u => Number(u.Id) === Number(activeId));
    const idActivo = existe ? Number(activeId) : (_ACC_CAT_UNIDADES[0]?.Id ?? null);
    _ACC_UNIDAD_ACTIVA = idActivo;

    const frag = document.createDocumentFragment();
    _ACC_CAT_UNIDADES.forEach(u => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = acc_templateUnidad(u, Number(idActivo) === Number(u.Id)).trim();
        frag.appendChild(wrapper.firstElementChild);
    });
    cont.appendChild(frag);

    $('#accUnidadesList').off('click').on('click', '.acc-unit-item', function () {
        const idU = Number(this.getAttribute('data-id'));
        acc_setUnidadActiva(idU);
    });
}

function acc_localesDeUnidad(idUnidad) {
    const result = new Map();
    _ACC_CAT_LOCALES
        .filter(l => Number(l.IdCombo) === Number(idUnidad))
        .forEach(l => result.set(l.Id, l));
    return Array.from(result.values());
}

// SIEMPRE refresca locales desde backend antes de pintar
async function acc_renderLocales() {
    const select = document.getElementById('accLocalesMulti');
    if (select) select.style.display = 'none';

    const cont = document.getElementById('accLocalesList');
    if (!cont) return;

    try {
        const resL = await fetch('/Locales/Lista', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json;charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        if (!resL.ok) throw new Error(resL.statusText);
        _ACC_CAT_LOCALES = await resL.json();
        _ACC_CAT_LOCALES = Array.isArray(_ACC_CAT_LOCALES) ? _ACC_CAT_LOCALES : [];
    } catch (e) {
        console.warn('No se pudieron obtener Locales (refresh):', e);
        _ACC_CAT_LOCALES = Array.isArray(_ACC_CAT_LOCALES) ? _ACC_CAT_LOCALES : [];
    }

    cont.innerHTML = '';

    const locales = acc_localesDeUnidad(_ACC_UNIDAD_ACTIVA);
    const asign = _ACC_ASIGN.find(a => Number(a.IdUnidadNegocio) === Number(_ACC_UNIDAD_ACTIVA));
    const pre = new Set((asign?.LocalesIds || []).map(Number));

    if (locales.length === 0) {
        cont.innerHTML = `<div class="text-muted small py-2 px-2">No hay locales para esta unidad.</div>`;
    } else {
        locales.forEach(l => {
            const checked = pre.has(Number(l.Id)) ? 'checked' : '';
            const row = document.createElement('label');
            row.className = 'list-group-item d-flex align-items-center gap-2';
            row.style.background = 'transparent';
            row.style.border = '0';
            row.style.borderBottom = '1px solid rgba(255,255,255,.06)';
            row.innerHTML = `
                <input type="checkbox" class="form-check-input accLocalChk" value="${l.Id}" ${checked}>
                <span class="flex-grow-1 text-truncate">${l.Nombre}</span>`;
            cont.appendChild(row);
        });
        if (cont.lastElementChild) cont.lastElementChild.style.borderBottom = '0';
    }

    $('#accLocalesList').off('click').on('click', '.list-group-item', function (e) {
        const chk = this.querySelector('.accLocalChk');
        if (chk) {
            if (e.target !== chk) { chk.checked = !chk.checked; }
            $(chk).trigger('change');
        }
    });

    $('#accLocalesList').off('change').on('change', '.accLocalChk', function () {
        acc_guardarSeleccionUnidadActual();
        acc_refrescarSwitchSelectAll();
    });

    acc_refrescarSwitchSelectAll();
}

function acc_refrescarSwitchSelectAll() {
    const sw = document.getElementById('accSelectAllLocales');
    if (!sw) return;
    const total = document.querySelectorAll('#accLocalesList .accLocalChk').length;
    const marc = document.querySelectorAll('#accLocalesList .accLocalChk:checked').length;
    sw.checked = total > 0 && marc === total;
}

function acc_bindSelectAllLocales() {
    $('#accSelectAllLocales').off('change').on('change', function () {
        const on = $(this).is(':checked');
        document.querySelectorAll('#accLocalesList .accLocalChk').forEach(chk => chk.checked = on);
        acc_guardarSeleccionUnidadActual();
    });
}

function acc_guardarSeleccionUnidadActual() {
    if (!_ACC_UNIDAD_ACTIVA) return;
    const seleccion = Array.from(document.querySelectorAll('#accLocalesList .accLocalChk:checked')).map(i => Number(i.value));
    const idx = _ACC_ASIGN.findIndex(a => a.IdUnidadNegocio === _ACC_UNIDAD_ACTIVA);
    if (idx >= 0) {
        _ACC_ASIGN[idx].LocalesIds = seleccion;
    } else {
        _ACC_ASIGN.push({ IdUnidadNegocio: _ACC_UNIDAD_ACTIVA, LocalesIds: seleccion });
    }
    acc_renderChips();
}

function acc_renderChips() {
    const wrap = document.getElementById('accResumenChips');
    if (!wrap) return;
    let html = '';
    _ACC_ASIGN.forEach(a => {
        const u = _ACC_CAT_UNIDADES.find(x => x.Id === a.IdUnidadNegocio);
        const nombre = u ? u.Nombre : `Unidad ${a.IdUnidadNegocio}`;
        html += `<span class="badge rounded-pill me-2 mb-2" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.12);color:#e7e9fb;">
                   <i class="fa fa-building-o me-1"></i>${nombre} <small>· ${a.LocalesIds.length} local(es)</small>
                 </span>`;
    });
    wrap.innerHTML = html;
}

function acc_setUnidadActiva(idUnidad) {
    // guardar lo visible antes de cambiar
    acc_guardarSeleccionUnidadActual();

    _ACC_UNIDAD_ACTIVA = Number(idUnidad);
    acc_renderUnidades(_ACC_UNIDAD_ACTIVA, false);
    acc_renderLocales();
    acc_renderChips();
}

// INIT Accesos: SIEMPRE refresca catálogos + asignaciones
async function acc_initUI(idUsuario) {
    await acc_cargarCatalogos();

    _ACC_ASIGN = [];
    if (idUsuario && Number(idUsuario) > 0) {
        try {
            const resA = await fetch(`/Usuarios/Asignaciones?idUsuario=${idUsuario}`, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json;charset=utf-8'
                }
            });
            if (!resA.ok) throw new Error(resA.statusText);
            const raw = await resA.json();
            if (Array.isArray(raw)) {
                _ACC_ASIGN = raw.map(normalizeAsignacion).filter(Boolean);
            }
        } catch (e) {
            console.warn('No se pudieron obtener asignaciones de usuario', e);
        }
    }

    const primeraAsignada = _ACC_ASIGN.length ? _ACC_ASIGN[0].IdUnidadNegocio : null;
    _ACC_UNIDAD_ACTIVA = (primeraAsignada != null) ? Number(primeraAsignada) : (_ACC_CAT_UNIDADES[0]?.Id ?? null);

    await acc_renderUnidades(_ACC_UNIDAD_ACTIVA, true); // fuerza refresh visual
    await acc_renderLocales();                           // fuerza refresh de locales
    acc_bindSelectAllLocales();
    acc_renderChips();
}

// salida para el payload al guardar
function acc_buildPayload() {
    acc_guardarSeleccionUnidadActual();
    const map = new Map();
    _ACC_ASIGN.forEach(a => {
        const key = String(a.IdUnidadNegocio);
        const locs = Array.from(new Set((a.LocalesIds || []).map(Number)));
        if (locs.length > 0) {
            map.set(key, { IdUnidadNegocio: a.IdUnidadNegocio, LocalesIds: locs });
        }
    });
    return Array.from(map.values());
}

// === Mostrar / Ocultar contraseña ===
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

// Exponer funciones Accesos si las llamás desde otros lados
window.acc_initUI = acc_initUI;
window.acc_buildPayload = acc_buildPayload;