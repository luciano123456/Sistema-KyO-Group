let gridProveedores;

const provColumnConfig = [
    { index: 2, filterType: 'text' }, // Nombre
    { index: 3, filterType: 'text' }, // Apodo
    { index: 4, filterType: 'text' }, // Ubicacion
    { index: 5, filterType: 'text' }, // Telefono
    { index: 6, filterType: 'text' }, // CBU
    { index: 7, filterType: 'text' }  // CUIT
];

$(document).ready(() => {
    initProveedoresGrid();

    document.querySelectorAll("#modalProveedor input").forEach(el => {
        el.setAttribute("autocomplete", "off");
        el.addEventListener("input", () => provValidarCampo(el));
        el.addEventListener("change", () => provValidarCampo(el));
        el.addEventListener("blur", () => provValidarCampo(el));
    });
});

async function listaProveedores() {
    if (gridProveedores) {
        kyoGridReload(gridProveedores);
    } else {
        await initProveedoresGrid();
    }
}

function nuevoProveedor() {
    window.location.href = '/Proveedores/Gestion?id=0';
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

    return withBusy("#btnGuardarProv", () => {
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

        return fetch(url, {
            method,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(payload)
        })
            .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
            .then(data => {
                const r = interpretarRespuestaApi(data);
                if (r.valor) {
                    $('#modalProveedor').modal('hide');
                    exitoModal(payload.Id === 0 ? "Proveedor registrado correctamente" : "Proveedor modificado correctamente");
                    listaProveedores();
                } else if (r.tipo === 'duplicado') {
                    mostrarErrorDuplicado(r.mensaje, r.idReferencia, `/Proveedores/Gestion?id=${r.idReferencia}`);
                } else {
                    errorModal(r.mensaje || "No se pudo completar la operación");
                }
            })
            .catch(err => {
                console.error(err);
                errorModal("Ha ocurrido un error");
            });
    });
}

async function eliminarProveedor(id) {
    return eliminarConCascada({
        url: '/Proveedores/Eliminar',
        id,
        confirmMsg: '¿Desea eliminar este proveedor?',
        headers: () => ({
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }),
        onSuccess: async (j) => {
            exitoModal(j.mensaje || 'Proveedor eliminado correctamente');
            listaProveedores();
        }
    });
}

/* ===================== DataTable ===================== */
async function initProveedoresGrid() {
    if (window.ensureKyoExportLibs) await window.ensureKyoExportLibs();
    if (gridProveedores) return;

    $('#grd_Proveedores thead tr').clone(true).addClass('filters').appendTo('#grd_Proveedores thead');

    gridProveedores = $('#grd_Proveedores').DataTable({
        serverSide: true,
        processing: true,
        ajax: kyoServerGridAjax('/Proveedores/ListaPaginada'),
        language: {
            sLengthMenu: "Mostrar MENU registros",
            lengthMenu: "Anzeigen von _MENU_ Einträge",
            url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json"
        },
        scrollX: false,
        scrollCollapse: false,
        autoWidth: true,
        responsive: true,
        columns: [
            columnaGridAcciones({ editar: 'provEditar', duplicar: 'provDuplicar', historial: 'verHistorialProveedor', eliminar: 'eliminarProveedor' }, 'Proveedores'),
            columnaGridId(),
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
                exportOptions: { columns: [2, 3, 4, 5, 6, 7] },
                className: 'btn-exportar-excel',
            },
            {
                extend: 'pdfHtml5',
                text: 'Exportar PDF',
                filename: 'Reporte Proveedores',
                title: '',
                exportOptions: { columns: [2, 3, 4, 5, 6, 7] },
                className: 'btn-exportar-pdf',
            },
            {
                extend: 'print',
                text: 'Imprimir',
                title: '',
                exportOptions: { columns: [2, 3, 4, 5, 6, 7] },
                className: 'btn-exportar-print'
            },
            'pageLength'
        ],
        orderCellsTop: true,
        fixedHeader: false,
        drawCallback: function () {
            const json = this.api().ajax.json();
            if (json) provActualizarKpi(json.recordsTotal);
        },

        initComplete: async function () {
            const api = this.api();

            await kyoBindColumnFilters(api, {
                columns: provColumnConfig,
                skipIndexes: [0, 1]
            });

            provConfigurarOpcionesColumnas();

            setTimeout(() => gridProveedores.columns.adjust(), 10);
        }
    });
}

async function provConfigDataTable() {
    await initProveedoresGrid();
}

function provEditar(id) {
    window.location.href = '/Proveedores/Gestion?id=' + id;
}
function provDuplicar(id) {
    window.location.href = '/Proveedores/Gestion?duplicar=' + id;
}

/* ===================== Columnas ===================== */
function provConfigurarOpcionesColumnas() {
    initGridColumnConfig({
        gridSelector: '#grd_Proveedores',
        menuSelector: '#configColumnasMenu',
        storageKey: 'Proveedores_Columnas',
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

function provActualizarKpi(cant) {
    const total = typeof cant === 'number' ? cant : (Array.isArray(cant) ? cant.length : 0);
    const el = document.getElementById('kpiCantProveedores');
    if (el) el.textContent = total;
}

