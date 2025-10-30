let gridInsumos;
let isEditing = false;


const columnConfig = [
    { index: 1, filterType: 'text' },
    { index: 2, filterType: 'text' },
    { index: 3, filterType: 'text' },
    { index: 4, filterType: 'text' },
    { index: 5, filterType: 'text' },

];



$(document).ready(() => {

    listaProveedoresFiltro();
    listaInsumos(-1);


    $("#Proveedores").select2({
        dropdownParent: $("#modalEdicion"),
        width: "100%",
        placeholder: "Selecciona una opción",
        allowClear: false
    }).on('change', function () {
        validarCampoIndividual(this);
    }).on('select2:close', function () {
        validarCampoIndividual(this);
    });




    document.querySelectorAll("#formInsumo input, #formInsumo select, #formInsumo textarea #formInsumo").forEach(el => {
        el.setAttribute("autocomplete", "off");
        el.addEventListener("input", () => validarCampoIndividual(el));
        el.addEventListener("change", () => validarCampoIndividual(el));
        el.addEventListener("blur", () => validarCampoIndividual(el));
    });


})




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
        method: method,
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(nuevoModelo)
    })
        .then(response => {
            if (!response.ok) throw new Error(response.statusText);
            return response.json();
        })
        .then(dataJson => {
            const mensaje = idInsumo === "" ? "Insumo registrado correctamente" : "Insumo modificado correctamente";
            $('#modalEdicion').modal('hide');
            exitoModal(mensaje);
            aplicarFiltros();
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function nuevoInsumo() {
    limpiarModal();
    listaProveedores()
    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Registrar");
    $("#modalEdicionLabel").text("Nuevo Insumo");

}

async function mostrarModal(modelo) {

    limpiarModal();

    await listaProveedores();

    const campos = ["Id", "Codigo", "Descripcion", "CostoUnitario"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val(modelo[campo]);
    });

    $("#Proveedores").val(modelo.IdProveedor).trigger("change.select2");


    $('#modalEdicion').modal('show');
    $("#btnGuardar").text("Guardar");
    $("#modalEdicionLabel").text("Editar Insumo");
}




async function aplicarFiltros() {
    listaInsumos(document.getElementById("ProveedorFiltro").value)
}


async function listaInsumos(IdProveedor) {
    const url = `/ProveedoresInsumos/Lista?IdProveedor=${IdProveedor}`;
    const response = await fetch(url);
    const data = await response.json();
    await configurarDataTable(data);
}

const editarInsumo = id => {
    fetch("ProveedoresInsumos/EditarInfo?id=" + id)
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
}
async function eliminarInsumo(id) {
    let resultado = window.confirm("¿Desea eliminar el Insumo?");

    if (resultado) {
        try {
            const response = await fetch("ProveedoresInsumos/Eliminar?id=" + id, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error("Error al eliminar el Insumo.");
            }

            const dataJson = await response.json();

            if (dataJson.valor) {
                aplicarFiltros();
                exitoModal("Insumo eliminado correctamente")
            }
        } catch (error) {
            console.error("Ha ocurrido un error:", error);
        }
    }
}

async function configurarDataTable(data) {
    if (!gridInsumos) {
        $('#grd_InsumosProveedor thead tr').clone(true).addClass('filters').appendTo('#grd_InsumosProveedor thead');
        gridInsumos = $('#grd_InsumosProveedor').DataTable({
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
                    filename: 'Reporte Insumos',
                    title: '',
                    exportOptions: {
                        columns: [0, 1, 2, 3]
                    },
                    className: 'btn-exportar-excel',
                },
                {
                    extend: 'pdfHtml5',
                    text: 'Exportar PDF',
                    filename: 'Reporte Insumos',
                    title: '',
                    exportOptions: {
                        columns: [0, 1, 2, 3]
                    },
                    className: 'btn-exportar-pdf',
                },
                {
                    extend: 'print',
                    text: 'Imprimir',
                    title: '',
                    exportOptions: {
                        columns: [0, 1, 2, 3]
                    },
                    className: 'btn-exportar-print'
                },
                'pageLength'
            ],
            orderCellsTop: true,
            fixedHeader: true,

            "columnDefs": [
                {
                    "render": function (data, type, row) {
                        if (data) {
                            const date = new Date(data); // Convierte la cadena en un objeto Date
                            //return date.toLocaleDateString('es-ES'); // Formato: 'DD/MM/YYYY'
                            return moment(date, 'YYYY-MM-DD hh:mm').format('DD/MM/YYYY hh:mm'); // Formato: 'DD/MM/YYYY'
                        }
                    },
                    "targets": [5] // Índices de las columnas de fechas 
                },
                {
                    "render": function (data, type, row) {
                        return formatNumber(data); // Formatear números
                    },
                    "targets": [3] // Índices de las columnas de números
                },

            ],

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

                $('.filters th').eq(0).html(''); // Limpiar la última columna si es necesario

                configurarOpcionesColumnas();

                setTimeout(function () {
                    gridInsumos.columns.adjust();
                }, 10);

                $('body').on('click', '#grd_InsumosProveedor .fa-map-marker', function () {
                    var locationText = $(this).parent().text().trim().replace(' ', ' '); // Obtener el texto visible
                    var url = 'https://www.google.com/maps?q=' + encodeURIComponent(locationText);
                    window.open(url, '_blank');
                });
            },
        });

    } else {
        gridInsumos.clear().rows.add(data).draw();
    }
}


function configurarOpcionesColumnas() {
    const grid = $('#grd_InsumosProveedor').DataTable(); // Accede al objeto DataTable utilizando el id de la tabla
    const columnas = grid.settings().init().columns; // Obtiene la configuración de columnas
    const container = $('#configColumnasMenu'); // El contenedor del dropdown específico para configurar columnas


    const storageKey = `InsumosProveedor_Columnas`; // Clave única para esta pantalla

    const savedConfig = JSON.parse(localStorage.getItem(storageKey)) || {}; // Recupera configuración guardada o inicializa vacía

    container.empty(); // Limpia el contenedor

    columnas.forEach((col, index) => {
        if (col.data && col.data !== "Id") { // Solo agregar columnas que no sean "Id"
            // Recupera el valor guardado en localStorage, si existe. Si no, inicializa en 'false' para no estar marcado.
            const isChecked = savedConfig && savedConfig[`col_${index}`] !== undefined ? savedConfig[`col_${index}`] : true;

            // Asegúrate de que la columna esté visible si el valor es 'true'
            grid.column(index).visible(isChecked);

            const columnName = col.data;

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

$(document).on('click', function (e) {
    // Verificar si el clic está fuera de cualquier dropdown
    if (!$(e.target).closest('.acciones-menu').length) {
        $('.acciones-dropdown').hide(); // Cerrar todos los dropdowns
    }
});

async function listaProveedoresFilter() {
    const url = `/Proveedores/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    return data.map(x => ({
        Id: x.Id,
        Nombre: x.Nombre
    }));

}


async function listaUnidadesNegocioFilter() {
    const url = `/UnidadesNegocio/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    return data.map(x => ({
        Id: x.Id,
        Nombre: x.Nombre
    }));

}

async function listaUnidadesMedidaFilter() {
    const url = `/UnidadesMedida/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    return data.map(x => ({
        Id: x.Id,
        Nombre: x.Nombre
    }));

}

async function listaInsumosCategoriaFilter() {
    const url = `/InsumosCategoria/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    return data.map(x => ({
        Id: x.Id,
        Nombre: x.Nombre
    }));

}




async function listaUnidadesMedida() {
    const data = await listaUnidadesMedidaFilter();

    $('#UnidadesMedida option').remove();

    select = document.getElementById("UnidadesMedida");

    // Opción por defecto (seleccionada y deshabilitada)
    const optionDefault = document.createElement("option");
    optionDefault.value = "";
    optionDefault.text = "Seleccionar";
    optionDefault.disabled = true;
    optionDefault.selected = true;
    select.appendChild(optionDefault);

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}

async function listaProveedores() {
    const data = await listaProveedoresFilter();

    $('#Proveedores option').remove();

    const select = document.getElementById("Proveedores");

    // Opción por defecto (seleccionada y deshabilitada)
    const optionDefault = document.createElement("option");
    optionDefault.value = "";
    optionDefault.text = "Seleccionar";
    optionDefault.disabled = true;
    optionDefault.selected = true;
    select.appendChild(optionDefault);

    // Cargar opciones dinámicas
    for (let i = 0; i < data.length; i++) {
        const option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);
    }
}


async function listaProveedoresFiltro() {
    const data = await listaProveedoresFilter();

    $('#ProveedorFiltro option').remove();

    select = document.getElementById("ProveedorFiltro");

    option = document.createElement("option");
    option.value = -1;
    option.text = "-";
    select.appendChild(option);

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}



async function listaUnidadesNegocioFiltro() {
    const data = await listaUnidadesNegocioFilter();

    $('#UnidadNegocioFiltro option').remove();

    select = document.getElementById("UnidadNegocioFiltro");

    option = document.createElement("option");
    option.value = -1;
    option.text = "-";
    select.appendChild(option);

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}

function limpiarModal() {
    const formulario = document.querySelector("#formInsumo");
    if (!formulario) return;

    formulario.querySelectorAll("input, select, textarea").forEach(el => {
        if (el.tagName === "SELECT") {
            el.selectedIndex = 0;
        } else {
            el.value = "";
        }
        el.classList.remove("is-invalid", "is-valid");
    });

    // Reset select2 de Proveedores
    const proveedores = document.getElementById("Proveedores");
    if (proveedores) {
        $(proveedores).val("").trigger("change");
        $(proveedores).next(".select2-container").removeClass("is-valid is-invalid");
    }

    // Ocultar mensaje general de error
    const errorMsg = document.getElementById("errorCampos");
    if (errorMsg) errorMsg.classList.add("d-none");
}



function validarCampoIndividual(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id;
    const valor = el.value ? el.value.trim() : "";
    const feedback = el.nextElementSibling;

    // Validar campos numéricos específicos
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

    // Validación visual para select2
    if ($(el).hasClass("select2-hidden-accessible")) {
        const container = $(el).next(".select2-container");
        container.removeClass("is-valid is-invalid");

        if (!valor || valor === "Seleccionar") {
            container.addClass("is-invalid");
        } else {
            container.addClass("is-valid");
        }

        // Eliminar estilos del select original
        $(el).removeClass("is-valid is-invalid");
    }

    verificarErroresGenerales();
}


function verificarErroresGenerales() {
    const errorMsg = document.getElementById("errorCampos");
    const hayInvalidos = document.querySelectorAll("#formInsumo .is-invalid").length > 0;
    if (!errorMsg) return;

    if (!hayInvalidos) {
        errorMsg.classList.add("d-none");
    }
}

function validarCampos() {
    const campos = [
        "#txtCodigo",
        "#txtDescripcion",
        "#Proveedores",
        "#txtCostoUnitario"
    ];

    const camposNumericos = ["#txtCostoUnitario"];
    let valido = true;

    campos.forEach(selector => {
        const campo = document.querySelector(selector);
        const valor = campo?.value?.trim();
        const feedback = campo?.nextElementSibling;
        const esNumero = camposNumericos.includes(selector);
        const isSelect2 = campo?.classList.contains("select2-hidden-accessible");

        // Reset visual
        if (isSelect2) {
            const container = $(campo).next(".select2-container");
            container.removeClass("is-valid is-invalid");
        }

        if (!campo || !valor || valor === "Seleccionar") {
            if (isSelect2) {
                $(campo).next(".select2-container").addClass("is-invalid");
            } else {
                campo.classList.add("is-invalid");
                campo.classList.remove("is-valid");
            }

            if (feedback && feedback.classList.contains("invalid-feedback")) {
                feedback.textContent = "Campo obligatorio";
            }

            valido = false;
        } else if (esNumero) {
            const sinFormato = valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
            if (isNaN(parseFloat(sinFormato))) {
                if (isSelect2) {
                    $(campo).next(".select2-container").addClass("is-invalid");
                } else {
                    campo.classList.remove("is-valid");
                    campo.classList.add("is-invalid");
                }

                if (feedback && feedback.classList.contains("invalid-feedback")) {
                    feedback.textContent = "Valor erróneo";
                }

                valido = false;
            } else {
                if (isSelect2) {
                    $(campo).next(".select2-container").addClass("is-valid");
                } else {
                    campo.classList.remove("is-invalid");
                    campo.classList.add("is-valid");
                }
            }
        } else {
            if (isSelect2) {
                $(campo).next(".select2-container").addClass("is-valid");
            } else {
                campo.classList.remove("is-invalid");
                campo.classList.add("is-valid");
            }
        }
    });

    document.getElementById("errorCampos").classList.toggle("d-none", valido);
    return valido;
}



    let listaInsumosArray = [];

async function cargarProveedores() {
    const resp = await fetch('/Proveedores/Lista');
    const data = await resp.json();
    const select = document.getElementById('ProveedorImportar');
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

    limpiarModalImportar(); // <<< AÑADIDO

    if (archivo && idProveedor) {
        procesarArchivo();
    } 
}



document.getElementById('modalImportar').addEventListener('shown.bs.modal', () => {
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
    resumenDiv.classList.remove('mostrar');
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

        if (lista.length === 0) {
            throw new Error("Ninguna hoja contiene columnas reconocidas de Código, Descripción y Precio.");
        }

        const payload = {
            IdProveedor: parseInt(idProveedor),
            Lista: lista
        };

        const resp = await fetch('/ProveedoresInsumos/Comparar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error(await resp.text());

        const comparacion = await resp.json();
        listaInsumosArray = comparacion;

        let subas = 0, bajas = 0, nuevos = 0, totalSuba = 0, totalBaja = 0;

        comparacion.forEach(item => {
            const tr = document.createElement('tr');

            const precioNuevo = parsearPrecio(item.precioNuevo);
            const precioAnterior = parsearPrecio(item.precioAnterior);

            const EPSILON = 1;
            const sonIguales = Math.abs(precioAnterior - precioNuevo) < EPSILON;

            const diferenciaValor = item.nuevo || sonIguales ? 0 : precioNuevo - precioAnterior;


            const porcentajeValor = (precioAnterior === 0 || diferenciaValor === 0)
                ? 0
                : (diferenciaValor / precioAnterior) * 100;

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

                if (diferenciaValor > 0) {
                    subas++;
                    totalSuba += diferenciaValor;
                } else {
                    bajas++;
                    totalBaja += Math.abs(diferenciaValor);
                }
            } else {
                claseFila = 'fila-sin-cambios';
                diferenciaTexto = '$ 0,00';
                porcentajeTexto = '0.0%';
            }

            tr.className = claseFila;
            tr.innerHTML = `
        <td>${item.codigo}</td>
        <td>
            <button class="btn btn-sm text-danger me-2" onclick="eliminarFilaImportacion(this)" title="Eliminar insumo">
                <i class="fa fa-trash"></i>
            </button>
            <span title="${item.descripcion}">${item.descripcion}</span>
        </td>
        <td>${item.precioAnterior != null ? formatearPrecio(precioAnterior) : '-'}</td>
        <td>${formatearPrecio(precioNuevo)}</td>
        <td class="${claseCambio}">${diferenciaTexto}</td>
        <td class="${claseCambio}">${porcentajeTexto}</td>
    `;

            tbody.appendChild(tr);
        });


        document.getElementById('bloqueTabla').classList.remove('d-none');
        document.getElementById('bloqueBuscador').classList.remove('d-none');

        if (errores.length > 0) {
            errorBox.textContent = `Se omitieron ${errores.length} insumos con errores:\n${errores.slice(0, 5).join('\n')}`;
            errorBox.classList.remove('d-none');
        }

        if (subas + bajas + nuevos > 0) {
            const promedioSuba = comparacion.filter(i => !i.nuevo && i.precioNuevo > i.precioAnterior)
                .reduce((acc, i) => acc + ((i.precioNuevo - i.precioAnterior) / i.precioAnterior), 0) / (subas || 1);

            const promedioBaja = comparacion.filter(i => !i.nuevo && i.precioNuevo < i.precioAnterior)
                .reduce((acc, i) => acc + ((i.precioAnterior - i.precioNuevo) / i.precioAnterior), 0) / (bajas || 1);

            let resumenTexto = `
                Se han registrado <strong>${nuevos}</strong> <span class="text-primary fw-bold">nuevos insumos</span>.<br>
                Se han registrado <strong>${subas}</strong> insumos con <span class="text-danger fw-bold">aumento de precio</span>.<br>
                Se han registrado <strong>${bajas}</strong> insumos con <span class="text-success fw-bold">baja de precio</span>.<br>
                <hr class="my-1">
                Promedio de aumento: <strong class="text-danger">${(promedioSuba * 100).toFixed(1)}%</strong><br>
                Promedio de baja: <strong class="text-success">${(promedioBaja * 100).toFixed(1)}%</strong><br>
            `;

            resumenTexto += promedioBaja > promedioSuba
                ? `<div class="mt-2"><i class="fa fa-arrow-down text-success"></i> La baja promedio supera al aumento promedio.</div>`
                : promedioSuba > promedioBaja
                    ? `<div class="mt-2"><i class="fa fa-arrow-up text-danger"></i> El aumento promedio supera a la baja promedio.</div>`
                    : `<div class="mt-2"><i class="fa fa-balance-scale text-secondary"></i> Las subas y bajas se equilibran.</div>`;

            document.getElementById('resumenContainer').classList.remove('d-none');
            resumenDiv.innerHTML = resumenTexto;
            resumenDiv.classList.remove('mostrar');

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

    const ws = XLSX.utils.json_to_sheet([], {
        header: ["Código", "Descripción", "Precio"]
    });

    XLSX.utils.book_append_sheet(wb, ws, "Insumos");
    XLSX.writeFile(wb, "maqueta-insumos.xlsx");
}

async function enviarDatos() {
    const idProveedor = document.getElementById('ProveedorImportar').value;
    const errorBox = document.getElementById('errorImportar');

    // Validación inicial
    if (!idProveedor || listaInsumosArray.length === 0) {
        errorBox.textContent = "Debe seleccionar un proveedor y cargar al menos un insumo.";
        errorBox.classList.remove('d-none');
        return;
    }

    // Preparar payload con las propiedades correctas (letra inicial mayúscula)
    const payload = {
        IdProveedor: parseInt(idProveedor),
        Lista: listaInsumosArray.map(x => ({
            Codigo: x.Codigo ?? x.codigo,
            Descripcion: x.Descripcion ?? x.descripcion,
            CostoUnitario: x.CostoUnitario ?? x.costoUnitario ?? x.precioNuevo
        }))
    };

    // Validación adicional por si algún item está incompleto
    if (!payload.Lista.every(x => x.Descripcion && !isNaN(x.CostoUnitario))) {
        errorBox.textContent = "Algunos insumos tienen datos incompletos o inválidos.";
        errorBox.classList.remove('d-none');
        return;
    }

    // Oculta errores anteriores
    errorBox.classList.add('d-none');

    try {
        const resp = await fetch('/ProveedoresInsumos/Importar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const texto = await resp.text();
            throw new Error(texto || "Error en la solicitud.");
        }

        const result = await resp.json();

        if (result.valor) {
            exitoModal("Insumos importados correctamente");
            aplicarFiltros()
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

function filtrarVistaPrevia() {
    const input = document.getElementById('buscadorVistaPrevia');
    const filter = input.value.toLowerCase();
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


function parsearPrecio(precioTexto) {
    if (precioTexto == null || precioTexto === '') return NaN;

    const texto = precioTexto.toString().trim();
    const limpio = texto.replace(/[^0-9.,]/g, '');

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
    return '$ ' + numero
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

            if (
                celdaCodigo.includes("codigo") &&
                celdaDescripcion.includes("descripcion") &&
                celdaPrecio.includes("precio")
            ) {
                let f = fila + 1;
                while (f < jsonMatriz.length) {
                    const datos = jsonMatriz[f];
                    if (!datos || datos.length < col + 3) break;

                    const codigo = datos[col]?.toString().trim() ?? '';
                    const descripcion = datos[col + 1]?.toString().trim().toUpperCase() ?? '';
                    const precioRaw = datos[col + 2]?.toString().trim() ?? '';
                    const precio = +parsearPrecio(precioRaw).toFixed(2);


                    const esEncabezado =
                        normalizarClave(codigo).includes('codigo') &&
                        normalizarClave(descripcion).includes('descripcion') &&
                        normalizarClave(precioRaw).includes('precio');

                    const vacio = !codigo && !descripcion && !precioRaw;

                    const esTitulo = (
                        !codigo && descripcion &&
                        descripcion.startsWith('-') &&
                        descripcion.endsWith('-')
                    );

                    if (vacio || esEncabezado || esTitulo) break;

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
    return txt
        ?.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim() || '';
}
