/* ================== RecetasNuevoModif.js (ADAPTADO + validaciones genéricas) ================== */

let gridInsumos = null, gridRecetas = null;
let insumosCache = [];     // cache del modal Insumos
let subrecetasCache = [];  // cache del modal Subrecetas

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

    if (typeof RecetaData !== 'undefined' && RecetaData && RecetaData > 0) {
        await cargarDatosReceta();
    } else {
        await configurarDataTableInsumos(null);
        await configurarDataTableSubrecetas(null);
        $("#tituloReceta").text("Nueva Receta");
    }

    // Listeners
    $('#UnidadesNegocio').on('change', function () {
        gridInsumos?.clear().draw();
        gridRecetas?.clear().draw();
        calcularDatosReceta();
    });

    // Select2 en modales
    $("#RecetaSelect").select2({ dropdownParent: $("#RecetasModal"), width: "100%", placeholder: "Selecciona una opción", allowClear: false });
    $("#insumoSelect").select2({ dropdownParent: $("#insumosModal"), width: "100%", placeholder: "Selecciona una opción", allowClear: false });

    // Bind validaciones blur para FORM pantalla
    ccValidators.bindBlurValidation(document.getElementById('frmReceta'));
    ccValidators.autoHideOnInput(
        document.getElementById('frmReceta'),
        document.getElementById('alertRequeridos')
    );

    // — INSUMOS —
    $('#insumosModal').on('shown.bs.modal', () => {
        const f = document.getElementById('formInsumo');
        const a = document.getElementById('modalAlertInsumo');
        a?.classList.add('d-none');
        ccValidators.clearGroup(f, a);
        ccValidators.bindBlurValidation(f);
        ccValidators.autoHideOnInput(f, a);
    });

    // — SUBRECETAS — (IDs del HTML actual: #RecetasModal + #formSubreceta)
    $('#RecetasModal').on('shown.bs.modal', () => {
        const f = document.getElementById('formSubreceta');
        const a = document.getElementById('modalAlertSub');
        a?.classList.add('d-none');
        ccValidators.clearGroup(f, a);
        ccValidators.bindBlurValidation(f);
        ccValidators.autoHideOnInput(f, a);
    });
});

/* ===== CARGA / EDICIÓN ===== */
async function ObtenerDatosReceta(id) {
    return await fetchJson(`/Recetas/EditarInfo?id=${id}`);
}
async function cargarDatosReceta() {
    if (!(typeof RecetaData !== 'undefined' && RecetaData && RecetaData > 0)) return;
    const datosReceta = await ObtenerDatosReceta(RecetaData);
    const payload = (typeof datosReceta === 'string') ? JSON.parse(datosReceta) : datosReceta;

    await insertarDatosReceta(payload.receta || payload.receta || {});
    await configurarDataTableInsumos(payload.Insumos || []);
    await configurarDataTableSubrecetas(payload.Subrecetas || []);
    calcularDatosReceta();
}
async function insertarDatosReceta(datos) {
    $("#idReceta").val(datos.Id);
    $("#UnidadesNegocio").val(datos.IdUnidadNegocio);
    $("#descripcion").val(datos.Descripcion);
    $("#sku").val(datos.Sku);
    $("#Categorias").val(datos.IdCategoria);
    $("#UnidadMedidas").val(datos.IdUnidadMedida);

    $("#costoInsumos").val(fmtMon(datos.CostoInsumos ?? 0));
    $("#costoRecetas").val(fmtMon(datos.CostoSubRecetas ?? datos.CostoRecetas ?? 0));
    $("#CostoPorcion").val(fmtMon(datos.CostoPorcion ?? 0));
    $("#Rendimiento").val(datos.Rendimiento ?? 0);
    $("#CostoUnitario").val(fmtMon(datos.CostoUnitario ?? 0));

    $("#btnNuevoModificar").text("Guardar");
    $("#tituloReceta").text("Editar Receta");
}

/* ===== TABLAS ===== */
async function configurarDataTableSubrecetas(data) {
    const rows = data != null && data.$values ? data.$values : (data || []);
    if (!gridRecetas) {
        gridRecetas = $('#grd_Subrecetas').DataTable({
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
<button class='btn btn-sm btneditar btnacciones' type='button' onclick='editarSubreceta(${row.IdSubReceta})' title='Editar'>
    <i class='fa fa-pencil-square-o fa-lg text-white'></i>
</button>
<button class='btn btn-sm btneditar btnacciones' type='button' onclick='eliminarSubreceta(${row.IdSubReceta})' title='Eliminar'>
    <i class='fa fa-trash-o fa-lg text-danger'></i>
</button>`
                }
            ],
            orderCellsTop: true,
            fixedHeader: true,
            initComplete: function () { setTimeout(() => gridRecetas.columns.adjust(), 10); }
        });
    } else {
        gridRecetas.clear().rows().add(rows).draw();
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

    const $sel = $("#insumoSelect");
    $sel.off('change').empty();

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
    const form = document.getElementById('formInsumo');
    const alert = document.getElementById('modalAlertInsumo');

    // oculto antes de validar
    alert?.classList.add('d-none');

    const ok = ccValidators.validateGroup(form, alert);
    if (!ok) {
        alert?.classList.remove('d-none');                  // <-- muestra banner
        form.querySelector('.is-invalid')?.focus();         // foco al primer error
        return;
    }

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
    calcularDatosReceta();
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
    calcularDatosReceta();
}

/* =========================================================================
 * CRUD — SUBRECETAS
 * ========================================================================= */
async function anadirSubreceta() {
    const IdUnidadNegocio = $("#UnidadesNegocio").val();
    subrecetasCache = await obtenerSubrecetasUnidadNegocio(IdUnidadNegocio);

    const yaAgregadas = new Set();
    gridRecetas?.rows().every(function () { yaAgregadas.add(Number(this.data().IdSubReceta)); });

    const $sel = $("#RecetaSelect").off('change').empty();

    let firstId = null;
    subrecetasCache.forEach(p => {
        if (!yaAgregadas.has(p.Id)) {
            if (firstId === null) firstId = p.Id;
            $sel.append(new Option(p.Descripcion, p.Id));
        }
    });

    if (firstId === null) { advertenciaModal("¡Ya agregaste todas las subrecetas de esta unidad de negocio!"); return; }

    $sel.val(firstId).trigger('change');

    $sel.off('change').on('change', function () {
        const selId = parseInt(this.value);
        const p = subrecetasCache.find(x => x.Id === selId) || { CostoUnitario: 0 };
        $("#cantidadRecetaInput").val(1);
        $("#precioSubrecetaInput").val(fmtMon(p.CostoUnitario));
        $("#totalRecetaInput").val(fmtMon(p.CostoUnitario));
    }).trigger('change');

    $("#precioSubrecetaInput").off('input blur').on('input', calcularTotalReceta).on('blur', function () {
        this.value = formatMoneda(convertirMonedaAFloat(this.value));
        calcularTotalReceta();
    });
    $("#cantidadRecetaInput").off('input').on('input', calcularTotalReceta);

    const $modal = $('#RecetasModal');
    $modal.data('edit-index', -1);
    $modal.data('edit-key', null);
    $('#btnGuardarReceta').text('Añadir');
    $('#modalAlertSub').addClass('d-none');
    ccValidators.clearGroup($('#formSubreceta')[0], $('#modalAlertSub')[0]);
    $modal.modal('show');
}
function calcularTotalReceta() {
    const precio = toNumberFromMoney($('#precioSubrecetaInput').val());
    const cant = fmtN($('#cantidadRecetaInput').val());
    $('#totalRecetaInput').val(fmtMon(precio * cant));
}
function upsertSubreceta({ IdSubReceta, Nombre, CostoUnitario, Cantidad }) {
    const idx = findRowIndex(gridRecetas, r => Number(r.IdSubReceta) === Number(IdSubReceta));
    const subTotal = fmtN(CostoUnitario) * fmtN(Cantidad);

    if (idx >= 0) {
        updateRowByIndex(gridRecetas, idx, {
            Nombre,
            CostoUnitario: fmtN(CostoUnitario),
            Cantidad: fmtN(Cantidad),
            SubTotal: subTotal
        });
    } else {
        gridRecetas.row.add({
            Id: 0,
            IdSubReceta: Number(IdSubReceta),
            Nombre,
            CostoUnitario: fmtN(CostoUnitario),
            Cantidad: fmtN(Cantidad),
            SubTotal: subTotal,
            __keyTempId: Date.now()
        }).draw(false);
    }
}
async function guardarSubreceta() {
    const form = document.getElementById('formSubreceta');
    const alert = document.getElementById('modalAlertSub');

    alert?.classList.add('d-none');

    const ok = ccValidators.validateGroup(form, alert);
    if (!ok) {
        alert?.classList.remove('d-none');
        form.querySelector('.is-invalid')?.focus();
        return;
    }
    const id = Number($('#RecetaSelect').val());
    const nombre = $('#RecetaSelect option:selected').text();
    const precio = toNumberFromMoney($('#precioSubrecetaInput').val());
    const cant = fmtN($('#cantidadRecetaInput').val() || 1);

    const modal = $('#RecetasModal');
    const editIndex = Number(modal.data('edit-index') ?? -1);

    if (editIndex >= 0) {
        updateRowByIndex(gridRecetas, editIndex, {
            IdSubReceta: id,
            Nombre: nombre,
            CostoUnitario: precio,
            Cantidad: cant,
            SubTotal: precio * cant
        });
    } else {
        // merge si ya existe
        let merged = false;
        gridRecetas.rows().every(function () {
            const d = this.data();
            if (parseInt(d.IdSubReceta) === id) {
                d.Cantidad = fmtN(cant);
                d.CostoUnitario = precio;
                d.SubTotal = precio * d.Cantidad;
                this.data(d).draw();
                merged = true;
            }
        });
        if (!merged) upsertSubreceta({ IdSubReceta: id, Nombre: nombre, CostoUnitario: precio, Cantidad: cant });
    }

    modal.modal('hide').data({ 'edit-index': '', 'edit-key': '', 'data-editing': false });
    calcularDatosReceta();
}
async function editarSubreceta(id) {
    const idx = findRowIndex(gridRecetas, r => Number(r.IdSubReceta) === Number(id));
    if (idx < 0) { advertenciaModal("No se encontró la subreceta a editar."); return; }

    const row = gridRecetas.row(idx).data();
    const IdUnidadNegocio = parseInt($("#UnidadesNegocio").val());
    subrecetasCache = await obtenerSubrecetasUnidadNegocio(IdUnidadNegocio);

    const $sel = $("#RecetaSelect").off('change').empty();
    const actual = subrecetasCache.find(x => x.Id === Number(row.IdSubReceta));
    if (actual) $sel.append(new Option(actual.Descripcion, actual.Id, true, true));

    $("#RecetaSelect").prop("disabled", true);
    $("#cantidadRecetaInput").val(row.Cantidad);
    $("#precioSubrecetaInput").val(fmtMon(row.CostoUnitario));
    $("#totalRecetaInput").val(fmtMon(row.SubTotal));

    $("#precioSubrecetaInput").off('input blur').on('input', calcularTotalReceta).on('blur', function () {
        this.value = formatMoneda(convertirMonedaAFloat(this.value));
        calcularTotalReceta();
    });
    $("#cantidadRecetaInput").off('input').on('input', calcularTotalReceta);

    const $modal = $('#RecetasModal');
    $modal.data('edit-index', idx);
    $modal.data('edit-key', row.__keyTempId || null);
    $('#btnGuardarReceta').text('Editar');
    $('#modalAlertSub').addClass('d-none');
    ccValidators.clearGroup($('#formSubreceta')[0], $('#modalAlertSub')[0]);
    $modal.modal('show');
}
function eliminarSubreceta(id) {
    const idx = findRowIndex(gridRecetas, r => Number(r.IdSubReceta) === Number(id));
    removeRowByIndex(gridRecetas, idx);
    calcularDatosReceta();
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
    const data = await fetchJson(`/RecetasCategoria/Lista`, { headers: authHeaders() });
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
async function obtenerSubrecetasUnidadNegocio(id) {
    const data = await fetchJson(`/Subrecetas/Lista?IdUnidadNegocio=${id}`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Descripcion: x.Descripcion, CostoUnitario: x.CostoUnitario }));
}

/* ===== Tabs: ajustar columnas ===== */
document.addEventListener('shown.bs.tab', (ev) => {
    const targetId = ev.target?.getAttribute('href');
    if (targetId === '#insumos' && gridInsumos) setTimeout(() => gridInsumos.columns.adjust(), 10);
    if (targetId === '#Recetas' && gridRecetas) setTimeout(() => gridRecetas.columns.adjust(), 10);
});

/* ===== Cálculos totales ===== */
document.getElementById('Rendimiento')?.addEventListener('blur', calcularDatosReceta);
async function calcularDatosReceta() {
    let insumoTotal = 0, subTotal = 0;

    if (gridInsumos && gridInsumos.rows().count() > 0) {
        gridInsumos.rows().every(function () { insumoTotal += fmtN(this.data().SubTotal || 0); });
    }
    if (gridRecetas && gridRecetas.rows().count() > 0) {
        gridRecetas.rows().every(function () { subTotal += fmtN(this.data().SubTotal || 0); });
    }

    const costoPorcion = subTotal + insumoTotal;
    const rendimiento = parseFloat(document.getElementById("Rendimiento").value) || 1;
    const costoUnitario = +(costoPorcion / (rendimiento || 1)).toFixed(2);

    $("#CostoUnitario").val(fmtMon(costoUnitario));
    $("#CostoPorcion").val(fmtMon(costoPorcion));
    $("#costoInsumos").val(fmtMon(insumoTotal));
    $("#costoRecetas").val(fmtMon(subTotal));
}

/* ===== Guardar ===== */
function guardarCambios() {
    // Validación de pantalla (form principal)
    const form = document.getElementById('frmReceta');
    const alert = document.getElementById('alertRequeridos');
    const ok = ccValidators.validateGroup(form, alert);
    if (!ok) { return; }

    const idReceta = $("#idReceta").val();

    function obtenerInsumos(grd) {
        const out = [];
        grd.rows().every(function () {
            const x = this.data();
            out.push({
                "IdReceta": idReceta ? parseInt(idReceta) : 0,
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
    function obtenerSubrecetas(grd) {
        const out = [];
        grd.rows().every(function () {
            const s = this.data();
            out.push({
                "IdSubReceta": parseInt(s.IdSubReceta),
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
    const subrecetas = obtenerSubrecetas(gridRecetas);

    if (insumos.length === 0 && subrecetas.length === 0) {
        advertenciaModal("Debes agregar al menos un insumo o subreceta.");
        return;
    }

    const payload = {
        "Id": idReceta ? parseInt(idReceta) : 0,
        "IdUnidadNegocio": parseInt($("#UnidadesNegocio").val()),
        "Descripcion": $("#descripcion").val(),
        "Sku": $("#sku").val(),
        "IdCategoria": parseInt($("#Categorias").val()),
        "IdUnidadMedida": parseInt($("#UnidadMedidas").val()),
        "CostoPorcion": toNumberFromMoney($("#CostoPorcion").val()),
        "Rendimiento": parseFloat($("#Rendimiento").val()),
        "CostoUnitario": toNumberFromMoney($("#CostoUnitario").val()),
        "CostoSubRecetas": toNumberFromMoney($("#costoRecetas").val()),
        "CostoInsumos": toNumberFromMoney($("#costoInsumos").val()),
        "RecetasInsumos": insumos,
        "RecetasSubreceta": subrecetas
    };

    const url = payload.Id ? "/Recetas/Actualizar" : "/Recetas/Insertar";
    const method = payload.Id ? "PUT" : "POST";

    fetch(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json;charset=utf-8' }),
        body: JSON.stringify(payload)
    })
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(res => {
            if (res.valor) {
                exitoModal(payload.Id ? "Receta modificada correctamente" : "Receta registrada correctamente");
                window.location.href = "/Recetas/Index";
            } else {
                errorModal(res.mensaje || (payload.Id ? "Error al modificar la Receta" : "Error al crear la Receta"));
            }
        })
        .catch(err => {
            console.error(err);
            errorModal("Ha ocurrido un error al guardar la Receta.");
        });
}



async function recargarCategoriasSubrecetaYSeleccionar(idSeleccionar = null) {
    const sel = document.getElementById('Categorias');
    if (!sel) return;

    let data;
    try { data = await fetchJson('/RecetasCategoria/Lista'); } catch { data = []; }
    if (!Array.isArray(data)) data = [];

    // Limpiar y volver a poner placeholder
    sel.innerHTML = '';
    const opt0 = new Option('Seleccionar...', '', false, false);
    opt0.disabled = true; opt0.selected = true;
    sel.add(opt0);

    // Normalizo claves: { id, text } (select2) o { Id, Nombre } etc.
    const norm = (data || []).map(x => {
        const id = x.id ?? x.Id ?? x.ID ?? x.IdCategoria ?? x.IdSubrecetaCategoria ?? x.IdCategoriaSubreceta;
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
        // Abrí tu pantalla de configuraciones en la sección de categorías de subrecetas
        await openConfigAndWait({ nombre: 'Categorías de Subrecetas', controller: 'RecetasCategoria' });
    } catch (_) {
        // usuario canceló: no hacemos nada
    } finally {
        // Siempre actualizar lista y seleccionar el último
        await recargarCategoriasSubrecetaYSeleccionar();
    }
});


async function recargarUnidadMedidaSubrecetaYSeleccionar(idSeleccionar = null) {
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
        await recargarUnidadMedidaSubrecetaYSeleccionar();
    }
});