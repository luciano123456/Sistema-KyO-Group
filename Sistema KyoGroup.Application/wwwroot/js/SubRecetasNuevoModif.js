/* =========================================================================
 * SubrecetasNuevoModif.js  (FULL, con CRUD robusto y token en fetch)
 * ========================================================================= */

let gridInsumos = null, gridSubrecetas = null;
let insumos = [];     // cache del modal Insumos
let Subrecetas = [];  // cache del modal Subrecetas

/* ===== Helpers de autenticación y UI ===== */
function authHeaders(extra = {}) {
    return { 'Authorization': 'Bearer ' + token, ...extra };
}
const fmtN = n => Number(n || 0);
const toMoney = v => formatoMoneda.format(fmtN(v));
const toNumberFromMoney = v => parseFloat(convertirMonedaAFloat(v));
const ensurePos = v => isFinite(v) && v > 0 ? v : 0;

/* ===== Helpers de DataTable (row search / update) ===== */
function findRowIndex(dt, predicate) {
    let found = -1;
    dt.rows().every(function (idx) {
        if (predicate(this.data())) { found = idx; return false; }
    });
    return found;
}
function updateRowByIndex(dt, rowIndex, newData) {
    if (rowIndex < 0) return;
    const row = dt.row(rowIndex);
    const cur = row.data() || {};
    row.data({ ...cur, ...newData }).draw(false);
}
function removeRowByIndex(dt, rowIndex) {
    if (rowIndex < 0) return;
    dt.row(rowIndex).remove().draw(false);
}

/* ====== INIT ====== */
$(document).ready(() => {
    listaUnidadesNegocio();
    listaCategorias();
    listaUnidadMedidas();

    if (SubrecetaData && SubrecetaData > 0) {
        cargarDatosSubreceta();
    } else {
        configurarDataTableInsumos(null);
        configurarDataTableSubrecetas(null);
        $("#tituloSubreceta").text("Nueva Subreceta");
    }

    $('#UnidadesNegocio').on('change', function () {
        gridInsumos.clear().draw();
        gridSubrecetas.clear().draw();
        calcularDatosReceta();
    });

    $('#descripcion').on('input', validarCampos);
    validarCampos();

    // Select2 con parent real (evita superposición)
    $("#SubrecetaSelect").select2({
        dropdownParent: $("#SubrecetasModal"),
        width: "100%",
        placeholder: "Selecciona una opción",
        allowClear: false
    });

    $("#insumoSelect").select2({
        dropdownParent: $("#insumosModal"),
        width: "100%",
        placeholder: "Selecciona una opción",
        allowClear: false
    });
});

/* ====== Carga inicial ====== */
async function ObtenerDatosSubreceta(id) {
    const url = `/Subrecetas/EditarInfo?id=${id}`;
    const response = await fetch(url, { headers: authHeaders() });
    return await response.json();
}

async function cargarDatosSubreceta() {
    if (!(SubrecetaData && SubrecetaData > 0)) return;

    const datosReceta = await ObtenerDatosSubreceta(SubrecetaData);
    await insertarDatosSubreceta(datosReceta.Subreceta);
    await configurarDataTableInsumos(datosReceta.Insumos);
    await configurarDataTableSubrecetas(datosReceta.Subrecetas);

    calcularDatosReceta();
    validarCampos();
}

async function insertarDatosSubreceta(datos) {
    $("#idSubreceta").val(datos.Id);
    $("#UnidadesNegocio").val(datos.IdUnidadNegocio);
    $("#descripcion").val(datos.Descripcion);
    $("#sku").val(datos.Sku);
    $("#Categorias").val(datos.IdCategoria);
    $("#UnidadMedidas").val(datos.IdUnidadMedida);

    $("#costoInsumos").val(toMoney(datos.CostoInsumos ?? 0));
    $("#costoSubrecetas").val(toMoney(datos.CostoSubrecetas ?? 0));
    $("#CostoPorcion").val(toMoney(datos.CostoPorcion ?? 0));
    $("#Rendimiento").val(datos.Rendimiento ?? 0);
    $("#CostoUnitario").val(toMoney(datos.CostoUnitario ?? 0));

    $("#btnNuevoModificar").text("Guardar");
    $("#tituloSubreceta").text("Editar Subreceta");

    await calcularDatosReceta();
}

/* ====== DataTables ====== */
function renderActionsInsumo(row) {
    return `
    <div class="d-flex gap-2 justify-content-center">
      <button class="btn btn-outline-light btn-sm rounded-circle shadow-sm"
              title="Editar" onclick="editarInsumo(${row.IdInsumo})" aria-label="Editar insumo">
        <i class="fa fa-pencil"></i>
      </button>
      <button class="btn btn-outline-danger btn-sm rounded-circle shadow-sm"
              title="Eliminar" onclick="eliminarInsumo(${row.IdInsumo})" aria-label="Eliminar insumo">
        <i class="fa fa-trash"></i>
      </button>
    </div>`;
}
function renderActionsSubreceta(row) {
    return `
    <div class="d-flex gap-2 justify-content-center">
      <button class="btn btn-outline-light btn-sm rounded-circle shadow-sm"
              title="Editar" onclick="editarSubreceta(${row.IdSubrecetaHija})" aria-label="Editar Subreceta">
        <i class="fa fa-pencil"></i>
      </button>
      <button class="btn btn-outline-danger btn-sm rounded-circle shadow-sm"
              title="Eliminar" onclick="eliminarSubreceta(${row.IdSubrecetaHija})" aria-label="Eliminar Subreceta">
        <i class="fa fa-trash"></i>
      </button>
    </div>`;
}

async function configurarDataTableSubrecetas(data) {
    if (!gridSubrecetas) {
        gridSubrecetas = $('#grd_Subrecetas').DataTable({
            data: data != null ? data.$values : data,
            language: {
                sLengthMenu: "Mostrar MENU registros",
                lengthMenu: "Anzeigen von _MENU_ Einträgen",
                url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json"
            },
            scrollX: "100px",
            scrollCollapse: true,
            columns: [
                { data: 'Nombre' },
                { data: 'CostoUnitario', render: d => toMoney(d) },
                { data: 'Cantidad', render: d => formatNumber(d) },
                { data: 'SubTotal', render: d => toMoney(d) },
                { data: null, orderable: false, searchable: false, render: (_, __, row) => renderActionsSubreceta(row) }
            ],
            orderCellsTop: true,
            fixedHeader: true,
            initComplete: function () { setTimeout(() => gridSubrecetas.columns.adjust(), 10); },
        });
    } else {
        gridSubrecetas.clear().rows.add(data).draw();
    }
}

async function configurarDataTableInsumos(data) {
    if (!gridInsumos) {
        gridInsumos = $('#grd_Insumos').DataTable({
            data: data != null ? data.$values : data,
            language: {
                sLengthMenu: "Mostrar MENU registros",
                lengthMenu: "Anzeigen von _MENU_ Einträgen",
                url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json"
            },
            scrollX: "100px",
            scrollCollapse: true,
            columns: [
                { data: 'Nombre' },
                { data: 'CostoUnitario', render: d => toMoney(d) },
                { data: 'Cantidad', render: d => formatNumber(d) },
                { data: 'SubTotal', render: d => toMoney(d) },
                { data: null, orderable: false, searchable: false, render: (_, __, row) => renderActionsInsumo(row) }
            ],
            orderCellsTop: true,
            fixedHeader: true,
            initComplete: function () { /* hook si hiciera falta */ },
        });
    } else {
        gridInsumos.clear().rows.add(data).draw();
    }
}

/* =========================================================================
 * CRUD — INSUMOS
 * ========================================================================= */
async function anadirInsumo() {
    const IdUnidadNegocio = $("#UnidadesNegocio").val();

    // Cache para combo
    insumos = await obtenerInsumosUnidadNegocio(IdUnidadNegocio);

    // Armo la lista sin los ya agregados
    const yaAgregados = new Set();
    gridInsumos.rows().every(function () { yaAgregados.add(Number(this.data().IdInsumo)); });

    const $sel = $("#insumoSelect");
    $sel.off('change');
    $sel.empty();

    let firstId = null;
    insumos.forEach(p => {
        if (!yaAgregados.has(p.Id)) {
            if (firstId === null) firstId = p.Id;
            $sel.append(new Option(p.Descripcion, p.Id));
        }
    });

    if (firstId === null) {
        advertenciaModal("¡Ya agregaste todos los insumos de esta unidad de negocio!");
        return;
    }

    $sel.val(firstId).trigger('change');

    // attach handlers únicos del modal
    $("#precioInput").off('input blur');
    $("#cantidadInput").off('input');

    $("#insumoSelect").off('change').on('change', function () {
        const selId = parseInt(this.value);
        const p = insumos.find(x => x.Id === selId);
        const precio = fmtN(p?.CostoUnitario);
        $("#cantidadInput").val(1);
        $("#precioInput").val(toMoney(precio));
        $("#totalInput").val(toMoney(precio * 1));
    }).trigger('change');

    $("#precioInput").on('input', calcularTotalInsumo).on('blur', function () {
        this.value = formatMoneda(toNumberFromMoney(this.value));
        calcularTotalInsumo();
    });
    $("#cantidadInput").on('input', calcularTotalInsumo);

    // modo alta
    const $modal = $('#insumosModal');
    $modal.data('edit-index', -1);
    $('#btnGuardarInsumo').text('Añadir');
    $modal.modal('show');
}

function calcularTotalInsumo() {
    const precio = toNumberFromMoney($('#precioInput').val());
    const cant = fmtN($('#cantidadInput').val());
    $('#totalInput').val(toMoney(precio * cant));
}

function upsertInsumo({ IdInsumo, Nombre, CostoUnitario, Cantidad }) {
    const idx = findRowIndex(gridInsumos, r => Number(r.IdInsumo) === Number(IdInsumo));
    const subTotal = fmtN(CostoUnitario) * fmtN(Cantidad);

    if (idx >= 0) {
        // merge (suma cantidad; mantiene precio del form — o podrías decidir otro criterio)
        const cur = gridInsumos.row(idx).data();
        const newCant = fmtN(Cantidad);
        const newPrecio = fmtN(CostoUnitario);
        updateRowByIndex(gridInsumos, idx, {
            Nombre,
            CostoUnitario: newPrecio,
            Cantidad: newCant,
            SubTotal: newPrecio * newCant
        });
    } else {
        gridInsumos.row.add({
            IdInsumo: Number(IdInsumo),
            Id: 0,
            Nombre,
            CostoUnitario: fmtN(CostoUnitario),
            Cantidad: fmtN(Cantidad),
            SubTotal: subTotal
        }).draw(false);
    }
}

async function guardarInsumo() {
    const $modal = $('#insumosModal');
    const editIndex = Number($modal.data('edit-index') ?? -1);

    const id = Number($('#insumoSelect').val());
    const nombre = $('#insumoSelect option:selected').text();
    const precio = toNumberFromMoney($('#precioInput').val());
    const cant = fmtN($('#cantidadInput').val() || 1);

    if (editIndex >= 0) {
        // editar puntual la fila (sin duplicar)
        updateRowByIndex(gridInsumos, editIndex, {
            IdInsumo: id,
            Nombre: nombre,
            CostoUnitario: precio,
            Cantidad: cant,
            SubTotal: precio * cant
        });
    } else {
        // alta/merge
        upsertInsumo({ IdInsumo: id, Nombre: nombre, CostoUnitario: precio, Cantidad: cant });
    }

    $modal.modal('hide');
    calcularDatosReceta();
}

async function editarInsumo(id) {
    const idx = findRowIndex(gridInsumos, r => Number(r.IdInsumo) === Number(id));
    if (idx < 0) { advertenciaModal("No se encontró el insumo a editar."); return; }

    const row = gridInsumos.row(idx).data();

    const IdUnidadNegocio = parseInt($("#UnidadesNegocio").val());
    insumos = await obtenerInsumosUnidadNegocio(IdUnidadNegocio);

    const $sel = $("#insumoSelect");
    $sel.off('change');
    $sel.empty();

    // Permitimos solo el actual (bloqueado) y el resto no listarlo (evita cambios de ID en edición)
    const actual = insumos.find(x => x.Id === Number(row.IdInsumo));
    if (actual) $sel.append(new Option(actual.Descripcion, actual.Id, true, true));

    $("#insumoSelect").prop("disabled", true);
    $("#cantidadInput").val(row.Cantidad);
    $("#precioInput").val(toMoney(row.CostoUnitario));
    $("#totalInput").val(toMoney(row.SubTotal));

    $("#precioInput").off('input blur').on('input', calcularTotalInsumo).on('blur', function () {
        this.value = formatMoneda(toNumberFromMoney(this.value));
        calcularTotalInsumo();
    });
    $("#cantidadInput").off('input').on('input', calcularTotalInsumo);

    const $modal = $('#insumosModal');
    $modal.data('edit-index', idx);
    $('#btnGuardarInsumo').text('Editar');
    $modal.modal('show');
}

function eliminarInsumo(id) {
    const idx = findRowIndex(gridInsumos, r => Number(r.IdInsumo) === Number(id));
    removeRowByIndex(gridInsumos, idx);
    calcularDatosReceta();
}

/* =========================================================================
 * CRUD — SubrecetaS
 * ========================================================================= */
async function anadirSubreceta() {
    const IdUnidadNegocio = $("#UnidadesNegocio").val();
    Subrecetas = await obtenerSubrecetasUnidadNegocio(IdUnidadNegocio);

    // Filtrar ya agregadas
    const yaAgregadas = new Set();
    gridSubrecetas.rows().every(function () { yaAgregadas.add(Number(this.data().IdSubrecetaHija)); });

    const $sel = $("#SubrecetaSelect");
    $sel.off('change');
    $sel.empty();

    let firstId = null;
    Subrecetas.forEach(p => {
        if (!yaAgregadas.has(p.Id)) {
            if (firstId === null) firstId = p.Id;
            $sel.append(new Option(p.Descripcion, p.Id));
        }
    });

    if (firstId === null) {
        advertenciaModal("¡Ya agregaste todas las Subrecetas de esta unidad de negocio!");
        return;
    }

    $sel.val(firstId).trigger('change');

    $("#SubrecetaSelect").off('change').on('change', function () {
        const selId = parseInt(this.value);
        const p = Subrecetas.find(x => x.Id === selId);
        const precio = fmtN(p?.CostoUnitario);
        $("#cantidadSubrecetaInput").val(1);
        $("#precioSubrecetaInput").val(toMoney(precio));
        $("#totalSubrecetaInput").val(toMoney(precio * 1));
    }).trigger('change');

    $("#precioSubrecetaInput").off('input blur').on('input', calcularTotalSubreceta).on('blur', function () {
        this.value = formatMoneda(toNumberFromMoney(this.value));
        calcularTotalSubreceta();
    });
    $("#cantidadSubrecetaInput").off('input').on('input', calcularTotalSubreceta);

    const $modal = $('#SubrecetasModal');
    $modal.data('edit-index', -1);
    $('#btnGuardarSubreceta').text('Añadir');
    $modal.modal('show');
}

function calcularTotalSubreceta() {
    const precio = toNumberFromMoney($('#precioSubrecetaInput').val());
    const cant = fmtN($('#cantidadSubrecetaInput').val());
    $('#totalSubrecetaInput').val(toMoney(precio * cant));
}

function upsertSubreceta({ IdSubrecetaHija, Nombre, CostoUnitario, Cantidad }) {
    const idx = findRowIndex(gridSubrecetas, r => Number(r.IdSubrecetaHija) === Number(IdSubrecetaHija));
    const subTotal = fmtN(CostoUnitario) * fmtN(Cantidad);

    if (idx >= 0) {
        const newCant = fmtN(Cantidad);
        const newPrecio = fmtN(CostoUnitario);
        updateRowByIndex(gridSubrecetas, idx, {
            Nombre,
            CostoUnitario: newPrecio,
            Cantidad: newCant,
            SubTotal: newPrecio * newCant
        });
    } else {
        gridSubrecetas.row.add({
            Id: 0,
            IdSubreceta: Number(IdSubrecetaHija),
            IdSubrecetaHija: Number(IdSubrecetaHija),
            Nombre,
            CostoUnitario: fmtN(CostoUnitario),
            Cantidad: fmtN(Cantidad),
            SubTotal: subTotal
        }).draw(false);
    }
}

async function guardarSubreceta() {
    const $modal = $('#SubrecetasModal');
    const editIndex = Number($modal.data('edit-index') ?? -1);

    const id = Number($('#SubrecetaSelect').val());
    const nombre = $('#SubrecetaSelect option:selected').text();
    const precio = toNumberFromMoney($('#precioSubrecetaInput').val());
    const cant = fmtN($('#cantidadSubrecetaInput').val() || 1);

    if (editIndex >= 0) {
        updateRowByIndex(gridSubrecetas, editIndex, {
            IdSubreceta: id,
            IdSubrecetaHija: id,
            Nombre: nombre,
            CostoUnitario: precio,
            Cantidad: cant,
            SubTotal: precio * cant
        });
    } else {
        upsertSubreceta({ IdSubrecetaHija: id, Nombre: nombre, CostoUnitario: precio, Cantidad: cant });
    }

    $modal.modal('hide');
    calcularDatosReceta();
}

async function editarSubreceta(id) {
    const idx = findRowIndex(gridSubrecetas, r => Number(r.IdSubrecetaHija) === Number(id));
    if (idx < 0) { advertenciaModal("No se encontró la Subreceta a editar."); return; }

    const row = gridSubrecetas.row(idx).data();

    const IdUnidadNegocio = parseInt($("#UnidadesNegocio").val());
    Subrecetas = await obtenerSubrecetasUnidadNegocio(IdUnidadNegocio);

    const $sel = $("#SubrecetaSelect");
    $sel.off('change');
    $sel.empty();

    const actual = Subrecetas.find(x => x.Id === Number(row.IdSubrecetaHija));
    if (actual) $sel.append(new Option(actual.Descripcion, actual.Id, true, true));

    $("#SubrecetaSelect").prop("disabled", true);
    $("#cantidadSubrecetaInput").val(row.Cantidad);
    $("#precioSubrecetaInput").val(toMoney(row.CostoUnitario));
    $("#totalSubrecetaInput").val(toMoney(row.SubTotal));

    $("#precioSubrecetaInput").off('input blur').on('input', calcularTotalSubreceta).on('blur', function () {
        this.value = formatMoneda(toNumberFromMoney(this.value));
        calcularTotalSubreceta();
    });
    $("#cantidadSubrecetaInput").off('input').on('input', calcularTotalSubreceta);

    const $modal = $('#SubrecetasModal');
    $modal.data('edit-index', idx);
    $('#btnGuardarSubreceta').text('Editar');
    $modal.modal('show');
}

function eliminarSubreceta(id) {
    const idx = findRowIndex(gridSubrecetas, r => Number(r.IdSubrecetaHija) === Number(id));
    removeRowByIndex(gridSubrecetas, idx);
    calcularDatosReceta();
}

/* =========================================================================
 * Listas / combos (con token)
 * ========================================================================= */
async function listaUnidadesNegocioFilter() {
    const response = await fetch(`/UnidadesNegocio/Lista`, { headers: authHeaders() });
    const data = await response.json();
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaUnidadesNegocio() {
    const data = await listaUnidadesNegocioFilter();
    const select = document.getElementById("UnidadesNegocio");
    $('#UnidadesNegocio option').remove();
    data.forEach(d => select.appendChild(new Option(d.Nombre, d.Id)));
}

async function listaCategoriasFilter() {
    const response = await fetch(`/SubrecetasCategoria/Lista`, { headers: authHeaders() });
    const data = await response.json();
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaCategorias() {
    const data = await listaCategoriasFilter();
    const select = document.getElementById("Categorias");
    $('#Categorias option').remove();
    data.forEach(d => select.appendChild(new Option(d.Nombre, d.Id)));
}

async function listaUnidadMedidasFilter() {
    const response = await fetch(`/UnidadesMedida/Lista`, { headers: authHeaders() });
    const data = await response.json();
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaUnidadMedidas() {
    const data = await listaUnidadMedidasFilter();
    const select = document.getElementById("UnidadMedidas");
    $('#UnidadMedidas option').remove();
    data.forEach(d => select.appendChild(new Option(d.Nombre, d.Id)));
}

async function obtenerInsumosUnidadNegocio(id) {
    const response = await fetch(`/Insumos/Lista?IdUnidadNegocio=${id}`, { headers: authHeaders() });
    const data = await response.json();
    return data.map(x => ({ Id: x.Id, Descripcion: x.Descripcion, CostoUnitario: x.CostoUnitario }));
}

async function obtenerSubrecetasUnidadNegocio(id) {
    const response = await fetch(`/Subrecetas/Lista?IdUnidadNegocio=${id}`, { headers: authHeaders() });
    const data = await response.json();
    return data.map(x => ({ Id: x.Id, Descripcion: x.Descripcion, CostoUnitario: x.CostoUnitario }));
}

/* =========================================================================
 * Ajustes de tabs y cálculos globales
 * ========================================================================= */
document.querySelector('#insumos-tab').addEventListener('shown.bs.tab', () => {
    if (gridInsumos) setTimeout(() => gridInsumos.columns.adjust(), 10);
});
document.querySelector('#Subreceta-tab').addEventListener('shown.bs.tab', () => {
    if (gridSubrecetas) setTimeout(() => gridSubrecetas.columns.adjust(), 10);
});

document.getElementById('Rendimiento').addEventListener('blur', calcularDatosReceta);

async function calcularDatosReceta() {
    let InsumoTotal = 0;
    let SubrecetaTotal = 0;

    if (gridInsumos && gridInsumos.rows().count() > 0) {
        gridInsumos.rows().every(function () {
            const r = this.data();
            InsumoTotal += fmtN(r.SubTotal);
        });
    }
    if (gridSubrecetas && gridSubrecetas.rows().count() > 0) {
        gridSubrecetas.rows().every(function () {
            const r = this.data();
            SubrecetaTotal += fmtN(r.SubTotal);
        });
    }

    const CostoPorcion = SubrecetaTotal + InsumoTotal;
    const rendimiento = ensurePos(parseFloat($("#Rendimiento").val())) || 1;
    const CostoUnitario = +(CostoPorcion / rendimiento).toFixed(2);

    $("#CostoUnitario").val(toMoney(CostoUnitario));
    $("#CostoPorcion").val(toMoney(CostoPorcion));
    $("#costoInsumos").val(toMoney(InsumoTotal));
    $("#costoSubrecetas").val(toMoney(SubrecetaTotal));
}

/* =========================================================================
 * Validación y Guardado
 * ========================================================================= */
function validarCampos() {
    const desc = $("#descripcion").val() || "";
    const ok = desc.trim().length > 0;
    $("#lblDescripcion").css("color", ok ? "" : "red");
    $("#descripcion").css("border-color", ok ? "" : "red");
    return ok;
}

function guardarCambios() {
    const idSubreceta = $("#idSubreceta").val();

    if (!validarCampos()) { errorModal("Debes completar los campos requeridos."); return; }

    function obtenerInsumos(grd) {
        const arr = [];
        grd.rows().every(function () {
            const r = this.data();
            arr.push({
                IdSubreceta: idSubreceta !== "" ? parseInt(idSubreceta) : 0,
                IdInsumo: parseInt(r.IdInsumo),
                Id: r.Id ? parseInt(r.Id) : 0,
                Nombre: r.Nombre,
                CostoUnitario: fmtN(r.CostoUnitario),
                SubTotal: fmtN(r.SubTotal),
                Cantidad: fmtN(r.Cantidad),
            });
        });
        return arr;
    }
    function obtenerSubrecetas(grd) {
        const arr = [];
        grd.rows().every(function () {
            const r = this.data();
            arr.push({
                IdSubrecetaHija: parseInt(r.IdSubrecetaHija),
                Id: r.Id ? parseInt(r.Id) : 0,
                Nombre: r.Nombre,
                CostoUnitario: fmtN(r.CostoUnitario),
                SubTotal: fmtN(r.SubTotal),
                Cantidad: fmtN(r.Cantidad),
            });
        });
        return arr;
    }

    const ins = obtenerInsumos(gridInsumos);
    const subs = obtenerSubrecetas(gridSubrecetas);

    if (ins.length === 0 && subs.length === 0) {
        advertenciaModal("Debes agregar al menos un insumo o Subreceta.");
        return;
    }

    const nuevoModelo = {
        Id: idSubreceta !== "" ? parseInt(idSubreceta) : 0,
        IdUnidadNegocio: parseInt($("#UnidadesNegocio").val()),
        Descripcion: $("#descripcion").val(),
        Sku: $("#sku").val(),
        IdCategoria: parseInt($("#Categorias").val()),
        IdUnidadMedida: parseInt($("#UnidadMedidas").val()),
        CostoPorcion: toNumberFromMoney($("#CostoPorcion").val()),
        Rendimiento: fmtN($("#Rendimiento").val()),
        CostoUnitario: toNumberFromMoney($("#CostoUnitario").val()),
        CostoSubrecetas: toNumberFromMoney($("#costoSubrecetas").val()),
        CostoInsumos: toNumberFromMoney($("#costoInsumos").val()),
        SubrecetasInsumos: ins,
        SubrecetasSubrecetaIdSubrecetaPadreNavigations: subs
    };

    const isNew = idSubreceta === "";
    const url = isNew ? "/Subrecetas/Insertar" : "/Subrecetas/Actualizar";
    const method = isNew ? "POST" : "PUT";

    fetch(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json;charset=utf-8' }),
        body: JSON.stringify(nuevoModelo)
    })
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(dataJson => {
            if (dataJson.valor) {
                exitoModal(isNew ? "Subreceta registrada correctamente" : "Subreceta modificada correctamente");
                window.location.href = "/Subrecetas/Index";
            } else {
                errorModal(isNew ? "Ha ocurrido un error al crear la Subreceta" : "Ha ocurrido un error al modificar la Subreceta");
            }
        })
        .catch(err => {
            console.error(err);
            errorModal("Ha ocurrido un error al guardar la Subreceta.");
        });
}
