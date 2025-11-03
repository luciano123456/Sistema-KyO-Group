let gridProveedores;

const provColumnConfig = [
    { index: 1, filterType: 'text' }, // Nombre
    { index: 2, filterType: 'text' }, // Apodo
    { index: 3, filterType: 'text' }, // Ubicacion
    { index: 4, filterType: 'text' }, // Telefono
    { index: 5, filterType: 'text' }, // CBU
    { index: 6, filterType: 'text' }  // CUIT
];

$(document).ready(() => {
    listaProveedores();

    document.querySelectorAll("#modalProveedor input").forEach(el => {
        el.setAttribute("autocomplete", "off");
        el.addEventListener("input", () => provValidarCampo(el));
        el.addEventListener("change", () => provValidarCampo(el));
        el.addEventListener("blur", () => provValidarCampo(el));
    });
});

/* ===================== CRUD ===================== */
async function listaProveedores() {
    const url = `/Proveedores/Lista`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) throw new Error(`Error: ${response.statusText}`);

    const data = await response.json();
    await provConfigDataTable(data);
    provActualizarKpi(data);
}

function nuevoProveedor() {
    provLimpiarModal();
  
    $('#modalProveedor').modal('show');
    $("#btnGuardarProv").text("Registrar");
    $("#modalProveedorLabel").text("Nuevo Proveedor");
}

async function mostrarProveedor(modelo) {
 
    provLimpiarModal();
    setInfoAuditoria(modelo);

    $("#provId").val(modelo.Id);
    $("#provNombre").val(modelo.Nombre);
    $("#provApodo").val(modelo.Apodo);
    $("#provUbicacion").val(modelo.Ubicacion);
    $("#provTelefono").val(modelo.Telefono);
    $("#provCbu").val(modelo.Cbu);
    $("#provCuit").val(modelo.Cuit);

    $('#modalProveedor').modal('show');
    $("#btnGuardarProv").text("Guardar");
    $("#modalProveedorLabel").text("Editar Proveedor");
}

function guardarProveedor() {
    if (!provValidarFormulario()) return;

    const id = $("#provId").val();
    const payload = {
        Id: id !== "" ? Number(id) : 0,
        Nombre: $("#provNombre").val(),
        Apodo: $("#provApodo").val(),
        Ubicacion: $("#provUbicacion").val(),
        Telefono: $("#provTelefono").val(),
        Cbu: $("#provCbu").val(),
        Cuit: $("#provCuit").val()
    };

    const url = payload.Id === 0 ? "/Proveedores/Insertar" : "/Proveedores/Actualizar";
    const method = payload.Id === 0 ? "POST" : "PUT";

    fetch(url, {
        method,
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(payload)
    })
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(data => {
            if (data && data.valor) {
                $('#modalProveedor').modal('hide');
                exitoModal(payload.Id === 0 ? "Proveedor registrado correctamente" : "Proveedor modificado correctamente");
                listaProveedores();
            } else {
                errorModal("No se pudo completar la operación");
            }
        })
        .catch(err => {
            console.error(err);
            errorModal("Ha ocurrido un error");
        });
}

async function eliminarProveedor(id) {
    const ok = await confirmarModal("¿Desea eliminar este proveedor?");
    if (!ok) return;

    fetch("/Proveedores/Eliminar?id=" + id, {
        method: 'DELETE',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(data => {
            if (data && data.valor) {
                exitoModal("Proveedor eliminado correctamente");
                listaProveedores();
            } else {
                errorModal("No se pudo eliminar el proveedor");
            }
        })
        .catch(err => {
            console.error(err);
            errorModal("Ha ocurrido un error");
        });
}

/* ===================== DataTable ===================== */
async function provConfigDataTable(data) {
    if (!gridProveedores) {
        $('#grd_Proveedores thead tr').clone(true).addClass('filters').appendTo('#grd_Proveedores thead');

        gridProveedores = $('#grd_Proveedores').DataTable({
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
          <button class='btn btn-sm btneditar' type='button' onclick='provEditar(${data})' title='Editar'>
            <i class='fa fa-pencil-square-o fa-lg text-success' aria-hidden='true'></i> Editar
          </button>
          <button class='btn btn-sm btneliminar' type='button' onclick='eliminarProveedor(${data})' title='Eliminar'>
            <i class='fa fa-trash-o fa-lg text-danger' aria-hidden='true'></i> Eliminar
          </button>
        </div>
      </div>`;
                    },
                    orderable: false,
                    searchable: false,
                },
                { data: 'Nombre' },
                { data: 'Apodo' },
                { data: 'Ubicacion' },
                { data: 'Telefono' },
                { data: 'Cbu' },
                { data: 'Cuit' }
            ],
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'excelHtml5',
                    text: 'Exportar Excel',
                    filename: 'Reporte Proveedores',
                    title: '',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6] },
                    className: 'btn-exportar-excel',
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Reporte Proveedores',
                    title: '',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6] },
                    className: 'btn-exportar-pdf',
                },
                {
                    extend: 'print',
                    text: 'Imprimir',
                    title: '',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6] },
                    className: 'btn-exportar-print'
                },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: true,

            initComplete: async function () {
                const api = this.api();

                provColumnConfig.forEach(async (config) => {
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
                                    .search(this.value != '' ? regexr.replace('{search}', '(((' + this.value + ')))') : '', this.value != '', this.value == '')
                                    .draw();
                                $(this).focus()[0].setSelectionRange(cursorPosition, cursorPosition);
                            });
                    }
                });

                $('.filters th').eq(0).html(''); // sin filtro para acciones
                provConfigurarOpcionesColumnas();

                setTimeout(() => gridProveedores.columns.adjust(), 10);
            }
        });
    } else {
        gridProveedores.clear().rows.add(data).draw();
    }
}

function provEditar(id) {
    $('.acciones-dropdown').hide();
    fetch("/Proveedores/EditarInfo?id=" + id, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
        .then(r => { if (!r.ok) throw new Error("Ha ocurrido un error."); return r.json(); })
        .then(data => mostrarProveedor(data))
        .catch(() => errorModal("Ha ocurrido un error."));
}

/* ===================== Columnas ===================== */
function provConfigurarOpcionesColumnas() {
    const grid = $('#grd_Proveedores').DataTable();
    const columnas = grid.settings().init().columns;
    const container = $('#configColumnasMenu');
    const storageKey = `Proveedores_Columnas`;
    const savedConfig = JSON.parse(localStorage.getItem(storageKey)) || {};

    container.empty();

    columnas.forEach((col, index) => {
        if (col.data && col.data !== "Id") {
            const isChecked = savedConfig[`col_${index}`] !== undefined ? savedConfig[`col_${index}`] : true;
            grid.column(index).visible(isChecked);

            container.append(`
                <li>
                    <label class="dropdown-item">
                        <input type="checkbox" class="toggle-column" data-column="${index}" ${isChecked ? 'checked' : ''}>
                        ${col.data}
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

/* ===================== Validaciones y helpers ===================== */
function provLimpiarModal() {
    const form = document.querySelector("#modalProveedor");
    if (!form) return;
    form.querySelectorAll("input").forEach(el => {
        el.value = "";
        el.classList.remove("is-invalid", "is-valid");
    });
    const errorMsg = document.getElementById("provErrorCampos");
    if (errorMsg) errorMsg.classList.add("d-none");
    const el = document.getElementById('lblUltimaModif');
    if (el) el.textContent = "";
}

function provValidarCampo(el) {
    const id = el.id;
    const valor = el.value ? el.value.trim() : "";
    const feedback = el.nextElementSibling;

    if (id !== "provNombre") return; // solo nombre obligatorio

    if (feedback && feedback.classList.contains("invalid-feedback")) {
        feedback.textContent = "Campo obligatorio";
    }

    if (valor === "") {
        el.classList.remove("is-valid");
        el.classList.add("is-invalid");
    } else {
        el.classList.remove("is-invalid");
        el.classList.add("is-valid");
    }
    const errorMsg = document.getElementById("provErrorCampos");
    if (errorMsg && !document.querySelector("#modalProveedor .is-invalid")) errorMsg.classList.add("d-none");
}

function provValidarFormulario() {
    const nombre = document.getElementById("provNombre");
    let ok = true;

    if (!nombre || !nombre.value.trim()) {
        nombre.classList.add("is-invalid");
        nombre.classList.remove("is-valid");
        ok = false;
    } else {
        nombre.classList.remove("is-invalid");
        nombre.classList.add("is-valid");
    }

    document.getElementById("provErrorCampos").classList.toggle("d-none", ok);
    return ok;
}

function provActualizarKpi(data) {
    const cant = Array.isArray(data) ? data.length : 0;
    const el = document.getElementById('kpiCantProveedores');
    if (el) el.textContent = cant;
}

/* acciones dropdown */
function provToggleAcciones(id) {
    const $dropdown = $(`.acciones-menu[data-id="${id}"] .acciones-dropdown`);
    if ($dropdown.is(":visible")) $dropdown.hide();
    else {
        $('.acciones-dropdown').hide();
        $dropdown.show();
    }
}

$(document).on('click', function (e) {
    if (!$(e.target).closest('.acciones-menu').length) {
        $('.acciones-dropdown').hide();
    }
});


