/* ================== SubRecetasNuevoModif.js (ADAPTADO + validaciones genéricas) ================== */

let gridInsumos = null, gridSubRecetas = null;
let insumosCache = [];       // cache del modal Insumos
let subRecetasCache = [];    // cache del modal SubRecetas

/* ===== Helpers de autenticación y UI ===== */
function authHeaders(extra = {}) {
    const t = (typeof token !== 'undefined' && token) ? token : '';
    return t ? { 'Authorization': 'Bearer ' + t, ...extra } : { ...extra };
}
async function fetchJson(url, options = {}) {
    const opts = { ...options, headers: authHeaders(options.headers || {}) };
    const r = await fetch(url, opts);
    if ((r.status === 401 || r.status === 403) && typeof advertenciaModal === 'function') {
        advertenciaModal('Sesión expirada o sin permisos.');
    }
    if (!r.ok) throw new Error(await r.text().catch(() => 'Error HTTP'));
    return await r.json();
}

/* ===== Formateo ===== */
const fmtN = n => Number(n || 0);
const fmtMon = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(n || 0));
const toNumberFromMoney = v => window.ccValidators.moneyToNumber(v);

/* ===== Helpers DataTable ===== */
function findRowIndex(dt, predicate) {
    if (!dt) return -1;
    let found = -1;
    dt.rows().every(function () { if (predicate(this.data())) { found = this.index(); return false; } });
    return found;
}
function updateRowByIndex(dt, rowIndex, newData) {
    if (!dt || rowIndex < 0) return;
    const row = dt.row(rowIndex);
    const cur = row.data() || {};
    row.data({ ...cur, ...newData }).draw(false);
}
function removeRowByIndex(dt, rowIndex) {
    if (!dt || rowIndex < 0) return;
    dt.row(rowIndex).remove().draw(false);
}

/* ===== INIT ===== */
$(document).ready(async () => {
    await listaUnidadesNegocio();
    await listaCategorias();
    await listaUnidadMedidas();

    if (typeof SubRecetaData !== 'undefined' && SubRecetaData && SubRecetaData > 0) {
        await cargarDatosSubReceta();
    } else {
        await configurarDataTableInsumos(null);
        await configurarDataTableSubRecetas(null);
        $("#tituloSubReceta").text("Nueva SubReceta");
    }

    // Listeners
    $('#UnidadesNegocio').on('change', function () {
        gridInsumos?.clear().draw();
        gridSubRecetas?.clear().draw();
        calcularDatosSubReceta();
    });

    // Select2 en modales
    $("#SubRecetaSelect").select2({ dropdownParent: $("#SubRecetasModal"), width: "100%", placeholder: "Selecciona una opción", allowClear: false });
    $("#insumoSelect").select2({ dropdownParent: $("#insumosModal"), width: "100%", placeholder: "Selecciona una opción", allowClear: false });

    // Bind validaciones blur para FORM pantalla (idéntico a Recetas)
    ccValidators.bindBlurValidation(document.getElementById('frmSubReceta'));

    ccValidators.autoHideOnInput(
        document.getElementById('frmSubReceta'),
        document.getElementById('alertRequeridos')
    );

    // — INSUMOS —
    $('#insumosModal').on('shown.bs.modal', () => {
        const f = document.getElementById('formInsumo');
        const a = document.getElementById('modalAlertInsumo');
        ccValidators.clearGroup(f, a);
        ccValidators.bindBlurValidation(f);
        ccValidators.autoHideOnInput(f, a);
    });

    // — SUBRecetaS —
    $('#SubRecetasModal').on('shown.bs.modal', () => {
        const f = document.getElementById('formSubReceta');
        const a = document.getElementById('modalAlertSub');
        ccValidators.clearGroup(f, a);
        ccValidators.bindBlurValidation(f);
        ccValidators.autoHideOnInput(f, a);
    });
});

/* ===== CARGA / EDICIÓN ===== */
async function ObtenerDatosSubReceta(id) {
    return await fetchJson(`/SubRecetas/EditarInfo?id=${id}`);
}
async function cargarDatosSubReceta() {
    if (!(typeof SubRecetaData !== 'undefined' && SubRecetaData && SubRecetaData > 0)) return;
    const datos = await ObtenerDatosSubReceta(SubRecetaData);
    const payload = (typeof datos === 'string') ? JSON.parse(datos) : datos;

    await insertarDatosSubReceta(payload.SubReceta || payload.subReceta || {});
    await configurarDataTableInsumos(payload.Insumos || []);
    await configurarDataTableSubRecetas(payload.SubRecetas || []);
    calcularDatosSubReceta();
}
async function insertarDatosSubReceta(d) {
    $("#idSubReceta").val(d.Id);
    $("#UnidadesNegocio").val(d.IdUnidadNegocio);
    $("#descripcion").val(d.Descripcion);
    $("#sku").val(d.Sku);
    $("#Categorias").val(d.IdCategoria);
    $("#UnidadMedidas").val(d.IdUnidadMedida);

    $("#costoInsumos").val(fmtMon(d.CostoInsumos ?? 0));
    $("#costoSubRecetas").val(fmtMon(d.CostoSubRecetas ?? 0));
    $("#CostoPorcion").val(fmtMon(d.CostoPorcion ?? 0));
    $("#Rendimiento").val(d.Rendimiento ?? 0);
    $("#CostoUnitario").val(fmtMon(d.CostoUnitario ?? 0));

    $("#btnNuevoModificar").text("Guardar");
    $("#tituloSubReceta").text("Editar SubReceta");
}

/* ===== TABLAS ===== */
async function configurarDataTableSubRecetas(data) {
    const rows = data != null && data.$values ? data.$values : (data || []);
    if (!gridSubRecetas) {
        gridSubRecetas = $('#grd_SubRecetas').DataTable({
            data: rows,
            language: { url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json" },
            scrollX: "100px",
            scrollCollapse: true,
            columns: [
                { data: 'Nombre', title: 'Nombre' },
                { data: 'CostoUnitario', title: 'Costo Unitario', render: d => fmtMon(d) },
                { data: 'Cantidad', title: 'Cantidad', render: d => d },
                { data: 'SubTotal', title: 'SubTotal', render: d => fmtMon(d) },
                {
                    data: null, title: 'Acciones', orderable: false, searchable: false, render: (_, __, row) => `
<button class='btn btn-sm btneditar btnacciones' type='button' onclick='editarSubReceta(${row.IdSubRecetaHija})' title='Editar'>
    <i class='fa fa-pencil-square-o fa-lg text-white'></i>
</button>
<button class='btn btn-sm btneditar btnacciones' type='button' onclick='eliminarSubReceta(${row.IdSubRecetaHija})' title='Eliminar'>
    <i class='fa fa-trash-o fa-lg text-danger'></i>
</button>`
                }
            ],
            orderCellsTop: true,
            fixedHeader: true,
            initComplete: function () { setTimeout(() => gridSubRecetas.columns.adjust(), 10); }
        });
    } else {
        gridSubRecetas.clear().rows().add(rows).draw();
    }
}
async function configurarDataTableInsumos(data) {
    const rows = data != null && data.$values ? data.$values : (data || []);
    if (!gridInsumos) {
        gridInsumos = $('#grd_Insumos').DataTable({
            data: rows,
            language: { url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json" },
            scrollX: "100px",
            scrollCollapse: true,
            columns: [
                { data: 'Nombre', title: 'Nombre' },
                { data: 'CostoUnitario', title: 'Costo Unitario', render: d => fmtMon(d) },
                { data: 'Cantidad', title: 'Cantidad', render: d => d },
                { data: 'SubTotal', title: 'SubTotal', render: d => fmtMon(d) },
                {
                    data: null, title: 'Acciones', orderable: false, searchable: false, render: (_, __, row) => `
<button class='btn btn-sm btneditar btnacciones' type='button' onclick='editarInsumo(${row.IdInsumo})' title='Editar'>
    <i class='fa fa-pencil-square-o fa-lg text-white'></i>
</button>
<button class='btn btn-sm btneditar btnacciones' type='button' onclick='eliminarInsumo(${row.IdInsumo})' title='Eliminar'>
    <i class='fa fa-trash-o fa-lg text-danger'></i>
</button>`
                }
            ],
            orderCellsTop: true,
            fixedHeader: true,
            initComplete: function () { setTimeout(() => gridInsumos.columns.adjust(), 10); }
        });
    } else {
        gridInsumos.clear().rows().add(rows).draw();
    }
}

/* =========================================================================
 * CRUD — INSUMOS
 * ========================================================================= */
async function anadirInsumo() {
    const IdUnidadNegocio = $("#UnidadesNegocio").val();
    insumosCache = await obtenerInsumosUnidadNegocio(IdUnidadNegocio);

    const yaAgregados = new Set();
    gridInsumos?.rows().every(function () { yaAgregados.add(Number(this.data().IdInsumo)); });

    const $sel = $("#insumoSelect").off('change').empty();

    let firstId = null;
    insumosCache.forEach(p => {
        if (!yaAgregados.has(p.Id)) {
            if (firstId === null) firstId = p.Id;
            $sel.append(new Option(p.Descripcion, p.Id));
        }
    });

    if (firstId === null) { advertenciaModal("¡Ya agregaste todos los insumos de esta unidad de negocio!"); return; }

    $sel.val(firstId).trigger('change');

    $("#insumoSelect").off('change').on('change', function () {
        const selId = parseInt(this.value);
        const p = insumosCache.find(x => x.Id === selId) || { CostoUnitario: 0 };
        $("#cantidadInput").val(1);
        $("#precioInput").val(fmtMon(p.CostoUnitario));
        $("#totalInput").val(fmtMon(p.CostoUnitario));
    }).trigger('change');

    $("#precioInput").off('input blur').on('input', calcularTotalInsumo).on('blur', function () {
        this.value = formatMoneda(convertirMonedaAFloat(this.value));
        calcularTotalInsumo();
    });
    $("#cantidadInput").off('input').on('input', calcularTotalInsumo);

    const $modal = $('#insumosModal');
    $modal.data('edit-index', -1);
    $('#btnGuardarInsumo').text('Añadir');
    $('#modalAlertInsumo').addClass('d-none');
    ccValidators.clearGroup($('#formInsumo')[0], $('#modalAlertInsumo')[0]);
    $modal.modal('show');
}
function calcularTotalInsumo() {
    const precio = toNumberFromMoney($('#precioInput').val());
    const cant = fmtN($('#cantidadInput').val());
    $('#totalInput').val(fmtMon(precio * cant));
}
function upsertInsumo({ IdInsumo, Nombre, CostoUnitario, Cantidad }) {
    const idx = findRowIndex(gridInsumos, r => Number(r.IdInsumo) === Number(IdInsumo));
    const subTotal = fmtN(CostoUnitario) * fmtN(Cantidad);

    if (idx >= 0) {
        updateRowByIndex(gridInsumos, idx, {
            Nombre,
            CostoUnitario: fmtN(CostoUnitario),
            Cantidad: fmtN(Cantidad),
            SubTotal: subTotal
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
    const form = $('#formInsumo')[0];
    const alert = $('#modalAlertInsumo')[0];
    const ok = ccValidators.validateGroup(form, alert);
    if (!ok) return;

    const id = Number($('#insumoSelect').val());
    const nombre = $('#insumoSelect option:selected').text();
    const precio = toNumberFromMoney($('#precioInput').val());
    const cant = fmtN($('#cantidadInput').val() || 1);

    const $modal = $('#insumosModal');
    const editIndex = Number($modal.data('edit-index') ?? -1);

    if (editIndex >= 0) {
        updateRowByIndex(gridInsumos, editIndex, {
            IdInsumo: id,
            Nombre: nombre,
            CostoUnitario: precio,
            Cantidad: cant,
            SubTotal: precio * cant
        });
    } else {
        // merge si ya existe
        let merged = false;
        gridInsumos.rows().every(function () {
            const d = this.data();
            if (Number(d.IdInsumo) === id) {
                d.Cantidad = fmtN(cant);
                d.CostoUnitario = precio;
                d.SubTotal = precio * d.Cantidad;
                this.data(d).draw();
                merged = true;
            }
        });
        if (!merged) upsertInsumo({ IdInsumo: id, Nombre: nombre, CostoUnitario: precio, Cantidad: cant });
    }

    $modal.modal('hide');
    calcularDatosSubReceta();
}
async function editarInsumo(id) {
    const idx = findRowIndex(gridInsumos, r => Number(r.IdInsumo) === Number(id));
    if (idx < 0) { advertenciaModal("No se encontró el insumo a editar."); return; }

    const row = gridInsumos.row(idx).data();
    const IdUnidadNegocio = parseInt($("#UnidadesNegocio").val());
    insumosCache = await obtenerInsumosUnidadNegocio(IdUnidadNegocio);

    const $sel = $("#insumoSelect").off('change').empty();
    const actual = insumosCache.find(x => x.Id === Number(row.IdInsumo));
    if (actual) $sel.append(new Option(actual.Descripcion, actual.Id, true, true));

    $("#insumoSelect").prop("disabled", true);
    $("#cantidadInput").val(row.Cantidad);
    $("#precioInput").val(fmtMon(row.CostoUnitario));
    $("#totalInput").val(fmtMon(row.SubTotal));

    $("#precioInput").off('input blur').on('input', calcularTotalInsumo).on('blur', function () {
        this.value = formatMoneda(convertirMonedaAFloat(this.value));
        calcularTotalInsumo();
    });
    $("#cantidadInput").off('input').on('input', calcularTotalInsumo);

    const $modal = $('#insumosModal');
    $modal.data('edit-index', idx);
    $('#btnGuardarInsumo').text('Editar');
    $('#modalAlertInsumo').addClass('d-none');
    ccValidators.clearGroup($('#formInsumo')[0], $('#modalAlertInsumo')[0]);
    $modal.modal('show');
}
function eliminarInsumo(id) {
    const idx = findRowIndex(gridInsumos, r => Number(r.IdInsumo) === Number(id));
    removeRowByIndex(gridInsumos, idx);
    calcularDatosSubReceta();
}

/* =========================================================================
 * CRUD — SUBRecetaS
 * ========================================================================= */
async function anadirSubReceta() {
    const IdUnidadNegocio = $("#UnidadesNegocio").val();
    subRecetasCache = await obtenerSubRecetasUnidadNegocio(IdUnidadNegocio);

    const yaAgregadas = new Set();
    gridSubRecetas?.rows().every(function () { yaAgregadas.add(Number(this.data().IdSubRecetaHija)); });

    const $sel = $("#SubRecetaSelect").off('change').empty();

    let firstId = null;
    subRecetasCache.forEach(p => {
        if (!yaAgregadas.has(p.Id)) {
            if (firstId === null) firstId = p.Id;
            $sel.append(new Option(p.Descripcion, p.Id));
        }
    });

    if (firstId === null) { advertenciaModal("¡Ya agregaste todas las subRecetas de esta unidad de negocio!"); return; }

    $sel.val(firstId).trigger('change');

    $sel.off('change').on('change', function () {
        const selId = parseInt(this.value);
        const p = subRecetasCache.find(x => x.Id === selId) || { CostoUnitario: 0 };
        $("#cantidadSubRecetaInput").val(1);
        $("#precioSubRecetaInput").val(fmtMon(p.CostoUnitario));
        $("#totalSubRecetaInput").val(fmtMon(p.CostoUnitario));
    }).trigger('change');

    $("#precioSubRecetaInput").off('input blur').on('input', calcularTotalSubReceta).on('blur', function () {
        this.value = formatMoneda(convertirMonedaAFloat(this.value));
        calcularTotalSubReceta();
    });
    $("#cantidadSubRecetaInput").off('input').on('input', calcularTotalSubReceta);

    const $modal = $('#SubRecetasModal');
    $modal.data('edit-index', -1);
    $('#btnGuardarSubReceta').text('Añadir');
    $('#modalAlertSub').addClass('d-none');
    ccValidators.clearGroup($('#formSubReceta')[0], $('#modalAlertSub')[0]);
    $modal.modal('show');
}
function calcularTotalSubReceta() {
    const precio = toNumberFromMoney($('#precioSubRecetaInput').val());
    const cant = fmtN($('#cantidadSubRecetaInput').val());
    $('#totalSubRecetaInput').val(fmtMon(precio * cant));
}
function upsertSubReceta({ IdSubRecetaHija, Nombre, CostoUnitario, Cantidad }) {
    const idx = findRowIndex(gridSubRecetas, r => Number(r.IdSubRecetaHija) === Number(IdSubRecetaHija));
    const subTotal = fmtN(CostoUnitario) * fmtN(Cantidad);

    if (idx >= 0) {
        updateRowByIndex(gridSubRecetas, idx, {
            Nombre,
            CostoUnitario: fmtN(CostoUnitario),
            Cantidad: fmtN(Cantidad),
            SubTotal: subTotal
        });
    } else {
        gridSubRecetas.row.add({
            Id: 0,
            IdSubReceta: Number(IdSubRecetaHija),
            IdSubRecetaHija: Number(IdSubRecetaHija),
            Nombre,
            CostoUnitario: fmtN(CostoUnitario),
            Cantidad: fmtN(Cantidad),
            SubTotal: subTotal
        }).draw(false);
    }
}
async function guardarSubReceta() {
    const form = $('#formSubReceta')[0];
    const alert = $('#modalAlertSub')[0];
    const ok = ccValidators.validateGroup(form, alert);
    if (!ok) return;

    const id = Number($('#SubRecetaSelect').val());
    const nombre = $('#SubRecetaSelect option:selected').text();
    const precio = toNumberFromMoney($('#precioSubRecetaInput').val());
    const cant = fmtN($('#cantidadSubRecetaInput').val() || 1);

    const modal = $('#SubRecetasModal');
    const editIndex = Number(modal.data('edit-index') ?? -1);

    if (editIndex >= 0) {
        updateRowByIndex(gridSubRecetas, editIndex, {
            IdSubReceta: id,
            IdSubRecetaHija: id,
            Nombre: nombre,
            CostoUnitario: precio,
            Cantidad: cant,
            SubTotal: precio * cant
        });
    } else {
        // merge si ya existe
        let merged = false;
        gridSubRecetas.rows().every(function () {
            const d = this.data();
            if (parseInt(d.IdSubRecetaHija) === id) {
                d.Cantidad = fmtN(cant);
                d.CostoUnitario = precio;
                d.SubTotal = precio * d.Cantidad;
                this.data(d).draw();
                merged = true;
            }
        });
        if (!merged) upsertSubReceta({ IdSubRecetaHija: id, Nombre: nombre, CostoUnitario: precio, Cantidad: cant });
    }

    modal.modal('hide').data({ 'edit-index': '', 'data-editing': false });
    calcularDatosSubReceta();
}
async function editarSubReceta(id) {
    const idx = findRowIndex(gridSubRecetas, r => Number(r.IdSubRecetaHija) === Number(id));
    if (idx < 0) { advertenciaModal("No se encontró la subReceta a editar."); return; }

    const row = gridSubRecetas.row(idx).data();
    const IdUnidadNegocio = parseInt($("#UnidadesNegocio").val());
    subRecetasCache = await obtenerSubRecetasUnidadNegocio(IdUnidadNegocio);

    const $sel = $("#SubRecetaSelect").off('change').empty();
    const actual = subRecetasCache.find(x => x.Id === Number(row.IdSubRecetaHija));
    if (actual) $sel.append(new Option(actual.Descripcion, actual.Id, true, true));

    $("#SubRecetaSelect").prop("disabled", true);
    $("#cantidadSubRecetaInput").val(row.Cantidad);
    $("#precioSubRecetaInput").val(fmtMon(row.CostoUnitario));
    $("#totalSubRecetaInput").val(fmtMon(row.SubTotal));

    $("#precioSubRecetaInput").off('input blur').on('input', calcularTotalSubReceta).on('blur', function () {
        this.value = formatMoneda(convertirMonedaAFloat(this.value));
        calcularTotalSubReceta();
    });
    $("#cantidadSubRecetaInput").off('input').on('input', calcularTotalSubReceta);

    const $modal = $('#SubRecetasModal');
    $modal.data('edit-index', idx);
    $('#btnGuardarSubReceta').text('Editar');
    $('#modalAlertSub').addClass('d-none');
    ccValidators.clearGroup($('#formSubReceta')[0], $('#modalAlertSub')[0]);
    $modal.modal('show');
}
function eliminarSubReceta(id) {
    const idx = findRowIndex(gridSubRecetas, r => Number(r.IdSubRecetaHija) === Number(id));
    removeRowByIndex(gridSubRecetas, idx);
    calcularDatosSubReceta();
}

/* ===== LISTAS / combos ===== */
async function listaUnidadesNegocioFilter() {
    const data = await fetchJson(`/UnidadesNegocio/Lista`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaUnidadesNegocio() {
    const data = await listaUnidadesNegocioFilter();
    const sel = document.getElementById("UnidadesNegocio");
    sel.innerHTML = '';
    data.forEach(d => sel.appendChild(new Option(d.Nombre, d.Id)));
}
async function listaCategoriasFilter() {
    const data = await fetchJson(`/SubRecetasCategoria/Lista`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaCategorias() {
    const data = await listaCategoriasFilter();
    const sel = document.getElementById("Categorias");
    sel.innerHTML = '';
    data.forEach(d => sel.appendChild(new Option(d.Nombre, d.Id)));
}
async function listaUnidadMedidasFilter() {
    const data = await fetchJson(`/UnidadesMedida/Lista`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaUnidadMedidas() {
    const data = await listaUnidadMedidasFilter();
    const sel = document.getElementById("UnidadMedidas");
    sel.innerHTML = '';
    data.forEach(d => sel.appendChild(new Option(d.Nombre, d.Id)));
}
async function obtenerInsumosUnidadNegocio(id) {
    const data = await fetchJson(`/Insumos/Lista?IdUnidadNegocio=${id}`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Descripcion: x.Descripcion, CostoUnitario: x.CostoUnitario }));
}
async function obtenerSubRecetasUnidadNegocio(id) {
    const data = await fetchJson(`/SubRecetas/Lista?IdUnidadNegocio=${id}`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Descripcion: x.Descripcion, CostoUnitario: x.CostoUnitario }));
}

/* ===== Tabs: ajustar columnas ===== */
document.addEventListener('shown.bs.tab', (ev) => {
    const targetId = ev.target?.getAttribute('href');
    if (targetId === '#insumos' && gridInsumos) setTimeout(() => gridInsumos.columns.adjust(), 10);
    if (targetId === '#SubRecetasDetalle' && gridSubRecetas) setTimeout(() => gridSubRecetas.columns.adjust(), 10);
});

/* ===== Cálculos totales ===== */
document.getElementById('Rendimiento')?.addEventListener('blur', calcularDatosSubReceta);
async function calcularDatosSubReceta() {
    let insumoTotal = 0, subTotal = 0;

    if (gridInsumos && gridInsumos.rows().count() > 0) {
        gridInsumos.rows().every(function () { insumoTotal += fmtN(this.data().SubTotal || 0); });
    }
    if (gridSubRecetas && gridSubRecetas.rows().count() > 0) {
        gridSubRecetas.rows().every(function () { subTotal += fmtN(this.data().SubTotal || 0); });
    }

    const costoPorcion = subTotal + insumoTotal;
    const rendimiento = parseFloat(document.getElementById("Rendimiento").value) || 1;
    const costoUnitario = +(costoPorcion / (rendimiento || 1)).toFixed(2);

    $("#CostoUnitario").val(fmtMon(costoUnitario));
    $("#CostoPorcion").val(fmtMon(costoPorcion));
    $("#costoInsumos").val(fmtMon(insumoTotal));
    $("#costoSubRecetas").val(fmtMon(subTotal));
}

/* ===== Guardar ===== */
function guardarCambios() {
    // Validación de pantalla (form principal) — exactamente igual al de Recetas
    const form = document.getElementById('frmSubReceta');
    const alert = document.getElementById('alertRequeridos');
    const ok = ccValidators.validateGroup(form, alert);
    if (!ok) { return; }

    const idSub = $("#idSubReceta").val();

    function obtenerInsumos(grd) {
        const out = [];
        grd.rows().every(function () {
            const x = this.data();
            out.push({
                "IdSubReceta": idSub ? parseInt(idSub) : 0,
                "IdInsumo": parseInt(x.IdInsumo),
                "Id": x.Id ? parseInt(x.Id) : 0,
                "Nombre": x.Nombre,
                "CostoUnitario": parseFloat(x.CostoUnitario),
                "SubTotal": parseFloat(x.SubTotal),
                "Cantidad": parseFloat(x.Cantidad)
            });
        });
        return out;
    }
    function obtenerSubRecetas(grd) {
        const out = [];
        grd.rows().every(function () {
            const s = this.data();
            out.push({
                "IdSubRecetaHija": parseInt(s.IdSubRecetaHija),
                "Id": s.Id ? parseInt(s.Id) : 0,
                "Nombre": s.Nombre,
                "CostoUnitario": parseFloat(s.CostoUnitario),
                "SubTotal": parseFloat(s.SubTotal),
                "Cantidad": parseFloat(s.Cantidad)
            });
        });
        return out;
    }

    const insumos = obtenerInsumos(gridInsumos);
    const subRecetas = obtenerSubRecetas(gridSubRecetas);

    if (insumos.length === 0 && subRecetas.length === 0) {
        advertenciaModal("Debes agregar al menos un insumo o subReceta.");
        return;
    }

    const payload = {
        "Id": idSub ? parseInt(idSub) : 0,
        "IdUnidadNegocio": parseInt($("#UnidadesNegocio").val()),
        "Descripcion": $("#descripcion").val(),
        "Sku": $("#sku").val(),
        "IdCategoria": parseInt($("#Categorias").val()),
        "IdUnidadMedida": parseInt($("#UnidadMedidas").val()),
        "CostoPorcion": toNumberFromMoney($("#CostoPorcion").val()),
        "Rendimiento": parseFloat($("#Rendimiento").val()),
        "CostoUnitario": toNumberFromMoney($("#CostoUnitario").val()),
        "CostoSubRecetas": toNumberFromMoney($("#costoSubRecetas").val()),
        "CostoInsumos": toNumberFromMoney($("#costoInsumos").val()),
        "SubRecetasInsumos": insumos,
        "SubRecetasSubRecetaIdSubRecetaPadreNavigations": subRecetas
    };

    const url = payload.Id ? "/SubRecetas/Actualizar" : "/SubRecetas/Insertar";
    const method = payload.Id ? "PUT" : "POST";

    fetch(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json;charset=utf-8' }),
        body: JSON.stringify(payload)
    })
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(res => {
            if (res.valor) {
                exitoModal(payload.Id ? "SubReceta modificada correctamente" : "SubReceta registrada correctamente");
                window.location.href = "/SubRecetas/Index";
            } else {
                errorModal(res.mensaje || (payload.Id ? "Error al modificar la SubReceta" : "Error al crear la SubReceta"));
            }
        })
        .catch(err => {
            console.error(err);
            errorModal("Ha ocurrido un error al guardar la SubReceta.");
        });
}





async function recargarCategoriasSubRecetaYSeleccionar(idSeleccionar = null) {
    const sel = document.getElementById('Categorias');
    if (!sel) return;

    let data;
    try { data = await fetchJson('/SubRecetasCategoria/Lista'); } catch { data = []; }
    if (!Array.isArray(data)) data = [];

    // Limpiar y volver a poner placeholder
    sel.innerHTML = '';
    const opt0 = new Option('Seleccionar...', '', false, false);
    opt0.disabled = true; opt0.selected = true;
    sel.add(opt0);

    // Normalizo claves: { id, text } (select2) o { Id, Nombre } etc.
    const norm = (data || []).map(x => {
        const id = x.id ?? x.Id ?? x.ID ?? x.IdCategoria ?? x.IdSubRecetaCategoria ?? x.IdCategoriaSubReceta;
        const texto = x.text ?? x.nombre ?? x.Nombre ?? x.descripcion ?? x.Descripcion ?? '';
        return { id, texto: String(texto) };
    }).filter(x => x.id != null && x.texto?.length);

    // Agrego opciones
    norm.forEach(x => sel.add(new Option(x.texto, String(x.id))));

    // Selección
    if (idSeleccionar != null) {
        sel.value = String(idSeleccionar);
    } else if (sel.options.length > 1) {
        // último option real (ignora placeholder en 0)
        sel.value = sel.options[sel.options.length - 1].value;
    } else {
        sel.value = '';
    }

    // Disparar change (nativo y select2)
    sel.dispatchEvent(new Event('change'));
    try { $('#Categorias').trigger('change.select2'); } catch { }

    // Limpiar inválido si lo tuviera
    sel.classList.remove('is-invalid');
    const fb = sel.closest('.form-group')?.querySelector('.invalid-feedback');
    if (fb) fb.classList.add('d-none');
}

// Botón ➕ de Categorías (abre config y al volver recarga + selecciona último)
document.getElementById('btnAddCategoria')?.addEventListener('click', async () => {
    try {
        // Abrí tu pantalla de configuraciones en la sección de categorías de subRecetas
        await openConfigAndWait({ nombre: 'Categorías de SubRecetas', controller: 'SubRecetasCategoria' });
    } catch (_) {
        // usuario canceló: no hacemos nada
    } finally {
        // Siempre actualizar lista y seleccionar el último
        await recargarCategoriasSubRecetaYSeleccionar();
    }
});


async function recargarUnidadMedidaSubRecetaYSeleccionar(idSeleccionar = null) {
    const sel = document.getElementById('UnidadMedidas');
    if (!sel) return;

    // Traer datos
    let data;
    try { data = await fetchJson('/UnidadesMedida/Lista'); } catch { data = []; }
    if (!Array.isArray(data)) data = [];

    // Reset + placeholder
    sel.innerHTML = '';
    const opt0 = new Option('Seleccionar...', '', false, false);
    opt0.disabled = true; opt0.selected = true;
    sel.add(opt0);

    // Normalizar: admite {id,text} (select2) o {Id, Nombre, Abreviatura} etc.
    const norm = (data || []).map(x => {
        const id = x.id ?? x.Id ?? x.ID ?? x.IdUnidadMedida ?? x.idUnidadMedida;
        const nom = x.text ?? x.nombre ?? x.Nombre ?? x.descripcion ?? x.Descripcion ?? '';
        const abr = x.abreviatura ?? x.Abreviatura ?? x.sigla ?? x.Sigla ?? '';
        const texto = abr ? `${nom} (${abr})` : String(nom);
        return { id, texto };
    }).filter(x => x.id != null && x.texto);

    // Poblar
    norm.forEach(x => sel.add(new Option(x.texto, String(x.id))));

    // Selección
    if (idSeleccionar != null) {
        sel.value = String(idSeleccionar);
    } else if (sel.options.length > 1) {
        sel.value = sel.options[sel.options.length - 1].value; // último real
    } else {
        sel.value = '';
    }

    // Notificar cambios (nativo + select2)
    sel.dispatchEvent(new Event('change'));
    try { $('#UnidadMedidas').trigger('change.select2'); } catch { }

    // Quitar inválido si estaba
    sel.classList.remove('is-invalid');
    const fb = sel.closest('.form-group')?.querySelector('.invalid-feedback');
    if (fb) fb.classList.add('d-none');
}

// Botón ➕: abrir config y al volver recargar + seleccionar
document.getElementById('btnAddUMSub')?.addEventListener('click', async () => {
    try {
        await openConfigAndWait({ nombre: 'Unidades de Medida', controller: 'UnidadesMedida' });
    } catch (_) {
        // cancelado: nada
    } finally {
        await recargarUnidadMedidaSubRecetaYSeleccionar();
    }
});