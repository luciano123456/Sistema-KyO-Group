/* ================== RecetasNuevoModif.js (ADAPTADO + validaciones genéricas) ================== */

let gridInsumos = null, gridRecetas = null;
let insumosCache = [];     // cache del modal Insumos
let subRecetasCache = [];  // cache del modal SubRecetas

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

function repoblarModalSelect(sel) {
    if (!sel) return;
    const $el = $(sel);
    if ($el.data('select2')) $el.select2('destroy');
    if (window.KyoSelect2?.init) window.KyoSelect2.init(sel);
    else $el.select2({ width: '100%', dropdownParent: $el.closest('.modal').length ? $el.closest('.modal') : $(document.body) });
}

/* ===== INIT ===== */
$(document).ready(async () => {
    try {
        await listaUnidadesNegocio();
        await listaCategorias();
        await listaUnidadMedidas();

        const duplicarId = typeof kyoQueryInt === 'function' ? kyoQueryInt('duplicar') : 0;
        const recetaId = Number(RecetaData);
        if (duplicarId > 0) {
            await cargarDatosRecetaComoCopia(duplicarId);
        } else if (!Number.isNaN(recetaId) && recetaId > 0) {
            await cargarDatosReceta();
        } else {
            await configurarDataTableInsumos(null);
            await configurarDataTableSubRecetas(null);
            $("#tituloReceta").text("Nueva Receta");
        }
    } catch (err) {
        console.error(err);
        if (typeof errorModal === 'function') errorModal('Error al cargar la pantalla. Recargá con Ctrl+F5.');
    }

    // Listeners
    $('#UnidadesNegocio').on('change', function () {
        gridInsumos?.clear().draw();
        gridRecetas?.clear().draw();
        calcularDatosReceta();
    });
    // Select2 en modales: inicializado globalmente por site-select2.js

    // Bind validaciones blur para FORM pantalla
    ccValidators.bindBlurValidation(document.getElementById('frmReceta'));
    ccValidators.autoHideOnInput(
        document.getElementById('frmReceta'),
        document.getElementById('alertRequeridos')
    );

    // → INSUMOS →
    $('#insumosModal').on('shown.bs.modal', () => {
        const f = document.getElementById('formInsumo');
        const a = document.getElementById('modalAlertInsumo');
        a?.classList.add('d-none');
        ccValidators.clearGroup(f, a);
        ccValidators.bindBlurValidation(f);
        ccValidators.autoHideOnInput(f, a);
    });

    // → SUBRecetaS → (IDs del HTML actual: #RecetasModal + #formSubReceta)
    $('#RecetasModal').on('shown.bs.modal', () => {
        const f = document.getElementById('formSubReceta');
        const a = document.getElementById('modalAlertSub');
        a?.classList.add('d-none');
        ccValidators.clearGroup(f, a);
        ccValidators.bindBlurValidation(f);
        ccValidators.autoHideOnInput(f, a);
    });

    $('#insumosModal').on('hidden.bs.modal', () => {
        $('#insumoSelect').prop('disabled', false);
    });
    $('#RecetasModal').on('hidden.bs.modal', () => {
        $('#RecetaSelect').prop('disabled', false);
    });
});

/* ===== CARGA / EDICIÓN ===== */
function unwrapJsonList(data) {
    if (data == null) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.$values)) return data.$values;
    if (Array.isArray(data.values)) return data.values;
    return [];
}

async function ObtenerDatosReceta(id) {
    return await fetchJson(`/Recetas/EditarInfo?id=${id}`);
}
async function cargarDatosReceta() {
    const recetaId = Number(RecetaData);
    if (Number.isNaN(recetaId) || recetaId <= 0) return;
    const datosReceta = await ObtenerDatosReceta(RecetaData);
    const payload = (typeof datosReceta === 'string') ? JSON.parse(datosReceta) : datosReceta;

    await insertarDatosReceta(payload.Receta || payload.receta || {});
    await configurarDataTableInsumos(unwrapJsonList(payload.Insumos || payload.insumos));
    await configurarDataTableSubRecetas(unwrapJsonList(payload.SubRecetas || payload.subRecetas));
    calcularDatosReceta();
}

async function cargarDatosRecetaComoCopia(idOrigen) {
    const datosReceta = await ObtenerDatosReceta(idOrigen);
    const payload = (typeof datosReceta === 'string') ? JSON.parse(datosReceta) : datosReceta;
    const receta = { ...(payload.Receta || payload.receta || {}) };
    const sku = String(receta.Sku || '').trim();

    receta.Id = 0;
    receta.Descripcion = typeof kyoTextoCopia === 'function'
        ? kyoTextoCopia(receta.Descripcion)
        : `${(receta.Descripcion || '').trim()} (copia)`.trim();
    receta.Sku = sku ? `${sku}-COPIA` : '';

    const insumos = unwrapJsonList(payload.Insumos || payload.insumos)
        .map(x => ({ ...x, Id: 0, IdReceta: 0 }));
    const subRecetas = unwrapJsonList(payload.SubRecetas || payload.subRecetas)
        .map(x => ({ ...x, Id: 0, IdReceta: 0 }));

    await insertarDatosReceta(receta);
    $("#idReceta").val("");
    $("#btnNuevoModificar").html('<i class="fa fa-save"></i> Registrar');
    $("#tituloReceta").text("Duplicar Receta");

    await configurarDataTableInsumos(insumos);
    await configurarDataTableSubRecetas(subRecetas);
    calcularDatosReceta();
}
async function insertarDatosReceta(datos) {
    $("#idReceta").val(datos.Id);
    if (window.KyoSelect2?.setValue) {
        KyoSelect2.setValue(document.getElementById('UnidadesNegocio'), datos.IdUnidadNegocio);
        KyoSelect2.setValue(document.getElementById('Categorias'), datos.IdCategoria);
        KyoSelect2.setValue(document.getElementById('UnidadMedidas'), datos.IdUnidadMedida);
    } else {
        $("#UnidadesNegocio").val(datos.IdUnidadNegocio);
        $("#Categorias").val(datos.IdCategoria);
        $("#UnidadMedidas").val(datos.IdUnidadMedida);
    }
    $("#descripcion").val(datos.Descripcion);
    $("#sku").val(datos.Sku);

    $("#costoInsumos").val(fmtMon(datos.CostoInsumos ?? 0));
    $("#costoRecetas").val(fmtMon(datos.CostoSubRecetas ?? datos.CostoRecetas ?? 0));
    $("#CostoPorcion").val(fmtMon(datos.CostoPorcion ?? 0));
    $("#Rendimiento").val(datos.Rendimiento ?? 0);
    $("#CostoUnitario").val(fmtMon(datos.CostoUnitario ?? 0));

    const kpiRend = document.getElementById('rmKpiRendimiento');
    if (kpiRend) kpiRend.value = (datos.Rendimiento ?? 0) > 0 ? String(datos.Rendimiento) : '—';

    $("#btnNuevoModificar").html('<i class="fa fa-save"></i> Guardar');
    $("#tituloReceta").text("Editar Receta");
}

/* ===== TABLAS ===== */
async function configurarDataTableSubRecetas(data) {
    const rows = data != null && data.$values ? data.$values : (data || []);
    if (!gridRecetas) {
        gridRecetas = $('#grd_SubRecetas').DataTable({
            data: rows,
            language: { url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json" },
            scrollX: false,
            scrollCollapse: true,
            columns: [
                { data: 'Nombre', title: 'Nombre' },
                { data: 'CostoUnitario', title: 'Costo Unitario', render: d => fmtMon(d) },
                { data: 'Cantidad', title: 'Cantidad', render: d => d },
                { data: 'SubTotal', title: 'SubTotal', render: d => fmtMon(d) },
                {
                    data: null, title: 'Acciones', orderable: false, searchable: false, render: (_, __, row) => `
<button class='btn btn-sm btneditar btnacciones' type='button' onclick='editarSubReceta(${row.IdSubReceta})' title='Editar'>
    <i class='fa fa-pencil-square-o fa-lg text-white'></i>
</button>
<button class='btn btn-sm btneditar btnacciones' type='button' onclick='eliminarSubReceta(${row.IdSubReceta})' title='Eliminar'>
    <i class='fa fa-trash-o fa-lg text-danger'></i>
</button>`
                }
            ],
            orderCellsTop: true,
            fixedHeader: false,
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
            scrollX: false,
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
            fixedHeader: false,
            initComplete: function () { setTimeout(() => gridInsumos.columns.adjust(), 10); }
        });
    } else {
        gridInsumos.clear().rows().add(rows).draw();
    }
}

/* =========================================================================
 * CRUD → INSUMOS
 * ========================================================================= */
async function anadirInsumo() {
    const IdUnidadNegocio = $("#UnidadesNegocio").val();
    if (!IdUnidadNegocio) {
        advertenciaModal("Seleccioná una unidad de negocio primero.");
        return;
    }
    insumosCache = await obtenerInsumosUnidadNegocio(IdUnidadNegocio);

    const yaAgregados = new Set();
    gridInsumos?.rows().every(function () { yaAgregados.add(Number(this.data().IdInsumo)); });

    const disponibles = insumosCache.filter(p => !yaAgregados.has(Number(p.Id)));
    if (!disponibles.length) {
        advertenciaModal("Ya agregaste todos los insumos de esta unidad de negocio.");
        return;
    }

    const conPrecio = disponibles.filter(p =>
        RpInsumoVinculo.tieneVinculo(p) && Number(p.CostoUnitario) > 0
    );
    if (!conPrecio.length) {
        advertenciaModal(
            "No tenés insumos vinculados a ningún proveedor con precio. " +
            "Primero vinculalos en Proveedores → Lista de precios (o Insumos de proveedores) y después volvé a agregarlos acá."
        );
        return;
    }

    const $sel = $("#insumoSelect");
    $sel.off('change').empty();
    conPrecio.forEach(p => $sel.append(new Option(p.Descripcion, p.Id)));
    const firstId = conPrecio[0].Id;

    repoblarModalSelect(document.getElementById('insumoSelect'));
    $("#insumoSelect").prop("disabled", false);

    $("#insumoSelect").off('change').on('change', function () {
        const selId = parseInt(this.value, 10);
        const p = insumosCache.find(x => x.Id === selId) || null;
        $("#cantidadInput").val(1);
        RpInsumoVinculo.aplicarSeleccionModal({
            insumo: p,
            alertEl: '#insumoSinVinculoAlert',
            precioEl: '#precioInput',
            totalEl: '#totalInput',
            btnEl: '#btnGuardarInsumo',
            cantidadEl: '#cantidadInput',
            fmtMon: fmtMon,
        });
        // Bloqueo extra: nunca permitir añadir con precio 0
        if (!p || Number(p.CostoUnitario) <= 0) {
            $('#btnGuardarInsumo').prop('disabled', true);
            $('#precioInput').val(fmtMon(0));
            $('#totalInput').val(fmtMon(0));
        }
    });

    $("#precioInput").off('input blur').on('input', calcularTotalInsumo).on('blur', function () {
        this.value = formatMoneda(convertirMonedaAFloat(this.value));
        calcularTotalInsumo();
    });
    $("#cantidadInput").off('input').on('input', calcularTotalInsumo);

    const $modal = $('#insumosModal');
    $modal.data('edit-index', -1);
    $('#btnGuardarInsumo').text('Añadir');
    $('#modalAlertInsumo').addClass('d-none');
    $('#insumoSinVinculoAlert').addClass('d-none');
    ccValidators.clearGroup($('#formInsumo')[0], $('#modalAlertInsumo')[0]);
    $sel.val(String(firstId)).trigger('change');
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
    const insumoSel = insumosCache.find(x => x.Id === id);
    const precio = toNumberFromMoney($('#precioInput').val());
    if (!RpInsumoVinculo.tieneVinculo(insumoSel) || precio <= 0) {
        RpInsumoVinculo.aplicarSeleccionModal({
            insumo: insumoSel,
            alertEl: '#insumoSinVinculoAlert',
            precioEl: '#precioInput',
            totalEl: '#totalInput',
            btnEl: '#btnGuardarInsumo',
            cantidadEl: '#cantidadInput',
            fmtMon: fmtMon,
        });
        advertenciaModal('No podés agregar un insumo sin precio. Vinculalo a un proveedor con precio primero.');
        return;
    }

    return withBusy("#btnGuardarInsumo", async () => {
        const nombre = $('#insumoSelect option:selected').text();
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
    }, { label: "Añadiendo..." });
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

    repoblarModalSelect(document.getElementById('insumoSelect'));
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
    $('#insumoSinVinculoAlert').addClass('d-none');
    $('#btnGuardarInsumo').prop('disabled', false);
    ccValidators.clearGroup($('#formInsumo')[0], $('#modalAlertInsumo')[0]);
    $modal.modal('show');
}
function eliminarInsumo(id) {
    const idx = findRowIndex(gridInsumos, r => Number(r.IdInsumo) === Number(id));
    removeRowByIndex(gridInsumos, idx);
    calcularDatosReceta();
}

/* =========================================================================
 * CRUD → SUBRecetaS
 * ========================================================================= */
async function anadirSubReceta() {
    const IdUnidadNegocio = $("#UnidadesNegocio").val();
    if (!IdUnidadNegocio) {
        advertenciaModal("Seleccioná una unidad de negocio primero.");
        return;
    }
    subRecetasCache = await obtenerSubRecetasUnidadNegocio(IdUnidadNegocio);

    const yaAgregadas = new Set();
    gridRecetas?.rows().every(function () { yaAgregadas.add(Number(this.data().IdSubReceta)); });

    const $sel = $("#RecetaSelect").off('change').empty();

    let firstId = null;
    subRecetasCache.forEach(p => {
        if (!yaAgregadas.has(p.Id)) {
            if (firstId === null) firstId = p.Id;
            $sel.append(new Option(p.Descripcion, p.Id));
        }
    });

    if (firstId === null) { advertenciaModal("Ya agregaste todas las sub-recetas de esta unidad de negocio."); return; }

    repoblarModalSelect(document.getElementById('RecetaSelect'));
    $("#RecetaSelect").prop("disabled", false);
    $sel.val(firstId).trigger('change');

    $sel.off('change').on('change', function () {
        const selId = parseInt(this.value);
        const p = subRecetasCache.find(x => x.Id === selId) || { CostoUnitario: 0 };
        $("#cantidadRecetaInput").val(1);
        $("#precioSubRecetaInput").val(fmtMon(p.CostoUnitario));
        $("#totalRecetaInput").val(fmtMon(p.CostoUnitario));
    }).trigger('change');

    $("#precioSubRecetaInput").off('input blur').on('input', calcularTotalReceta).on('blur', function () {
        this.value = formatMoneda(convertirMonedaAFloat(this.value));
        calcularTotalReceta();
    });
    $("#cantidadRecetaInput").off('input').on('input', calcularTotalReceta);

    const $modal = $('#RecetasModal');
    $modal.data('edit-index', -1);
    $modal.data('edit-key', null);
    $('#btnGuardarReceta').text('Añadir');
    $('#modalAlertSub').addClass('d-none');
    ccValidators.clearGroup($('#formSubReceta')[0], $('#modalAlertSub')[0]);
    $modal.modal('show');
}
function calcularTotalReceta() {
    const precio = toNumberFromMoney($('#precioSubRecetaInput').val());
    const cant = fmtN($('#cantidadRecetaInput').val());
    $('#totalRecetaInput').val(fmtMon(precio * cant));
}
function upsertSubReceta({ IdSubReceta, Nombre, CostoUnitario, Cantidad }) {
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
async function guardarSubReceta() {
    const form = document.getElementById('formSubReceta');
    const alert = document.getElementById('modalAlertSub');

    alert?.classList.add('d-none');

    const ok = ccValidators.validateGroup(form, alert);
    if (!ok) {
        alert?.classList.remove('d-none');
        form.querySelector('.is-invalid')?.focus();
        return;
    }

    return withBusy("#btnGuardarReceta", async () => {
        const id = Number($('#RecetaSelect').val());
        const nombre = $('#RecetaSelect option:selected').text();
        const precio = toNumberFromMoney($('#precioSubRecetaInput').val());
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
            if (!merged) upsertSubReceta({ IdSubReceta: id, Nombre: nombre, CostoUnitario: precio, Cantidad: cant });
        }

        modal.modal('hide').data({ 'edit-index': '', 'edit-key': '', 'data-editing': false });
        calcularDatosReceta();
    }, { label: "Añadiendo..." });
}
async function editarSubReceta(id) {
    const idx = findRowIndex(gridRecetas, r => Number(r.IdSubReceta) === Number(id));
    if (idx < 0) { advertenciaModal("No se encontró la subReceta a editar."); return; }

    const row = gridRecetas.row(idx).data();
    const IdUnidadNegocio = parseInt($("#UnidadesNegocio").val());
    subRecetasCache = await obtenerSubRecetasUnidadNegocio(IdUnidadNegocio);

    const $sel = $("#RecetaSelect").off('change').empty();
    const actual = subRecetasCache.find(x => x.Id === Number(row.IdSubReceta));
    if (actual) $sel.append(new Option(actual.Descripcion, actual.Id, true, true));

    repoblarModalSelect(document.getElementById('RecetaSelect'));
    $("#RecetaSelect").prop("disabled", true);
    $("#cantidadRecetaInput").val(row.Cantidad);
    $("#precioSubRecetaInput").val(fmtMon(row.CostoUnitario));
    $("#totalRecetaInput").val(fmtMon(row.SubTotal));

    $("#precioSubRecetaInput").off('input blur').on('input', calcularTotalReceta).on('blur', function () {
        this.value = formatMoneda(convertirMonedaAFloat(this.value));
        calcularTotalReceta();
    });
    $("#cantidadRecetaInput").off('input').on('input', calcularTotalReceta);

    const $modal = $('#RecetasModal');
    $modal.data('edit-index', idx);
    $modal.data('edit-key', row.__keyTempId || null);
    $('#btnGuardarReceta').text('Editar');
    $('#modalAlertSub').addClass('d-none');
    ccValidators.clearGroup($('#formSubReceta')[0], $('#modalAlertSub')[0]);
    $modal.modal('show');
}
function eliminarSubReceta(id) {
    const idx = findRowIndex(gridRecetas, r => Number(r.IdSubReceta) === Number(id));
    removeRowByIndex(gridRecetas, idx);
    calcularDatosReceta();
}

/* ===== LISTAS / combos ===== */
function repoblarSelectConSelect2(sel, items, { placeholder = 'Seleccionar...', autoSelectSingle = true } = {}) {
    if (!sel) return;
    const $el = $(sel);
    if ($el.data('select2')) $el.select2('destroy');

    sel.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    ph.disabled = true;
    ph.selected = true;
    sel.appendChild(ph);

    (items || []).forEach(d => sel.appendChild(new Option(d.Nombre, d.Id)));

    if (window.KyoSelect2?.init) window.KyoSelect2.init(sel);
    else $el.select2({ width: '100%', placeholder, allowClear: false });

    if (autoSelectSingle && items?.length === 1) {
        sel.value = String(items[0].Id);
        $el.trigger('change.select2');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

async function listaUnidadesNegocioFilter() {
    const data = await fetchJson(`/UnidadesNegocio/ListaUsuario`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaUnidadesNegocio() {
    const data = await listaUnidadesNegocioFilter();
    repoblarSelectConSelect2(document.getElementById('UnidadesNegocio'), data);
}
async function listaCategoriasFilter() {
    const data = await fetchJson(`/RecetasCategoria/Lista`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaCategorias() {
    const data = await listaCategoriasFilter();
    repoblarSelectConSelect2(document.getElementById('Categorias'), data, { autoSelectSingle: false });
}
async function listaUnidadMedidasFilter() {
    const data = await fetchJson(`/UnidadesMedida/Lista`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaUnidadMedidas() {
    const data = await listaUnidadMedidasFilter();
    repoblarSelectConSelect2(document.getElementById('UnidadMedidas'), data, { autoSelectSingle: false });
}
async function obtenerInsumosUnidadNegocio(id) {
    const data = await fetchJson(`/Insumos/Lista?IdUnidadNegocio=${id}`, { headers: authHeaders() });
    return (data || []).map(x => RpInsumoVinculo.normalizar(x));
}
async function obtenerSubRecetasUnidadNegocio(id) {
    const data = await fetchJson(`/SubRecetas/Lista?IdUnidadNegocio=${id}`, { headers: authHeaders() });
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
document.getElementById('Rendimiento')?.addEventListener('input', calcularDatosReceta);
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

    const kpiRend = document.getElementById('rmKpiRendimiento');
    if (kpiRend) kpiRend.value = rendimiento > 0 ? String(rendimiento) : '—';
}

/* ===== Guardar ===== */
function guardarCambios() {
    const form = document.getElementById('frmReceta');
    const alert = document.getElementById('alertRequeridos');
    alert?.classList.add('d-none');
    const ok = ccValidators.validateGroup(form, alert);
    if (!ok) {
        alert?.classList.remove('d-none');
        form.querySelector('.is-invalid')?.focus();
        return;
    }

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
    function obtenerSubRecetas(grd) {
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
    const subRecetas = obtenerSubRecetas(gridRecetas);

    if (insumos.length === 0 && subRecetas.length === 0) {
        advertenciaModal("Debes agregar al menos un insumo o subReceta.");
        return;
    }

    return withBusy("#btnNuevoModificar", () => {
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
            "RecetasSubReceta": subRecetas
        };

        const url = payload.Id ? "/Recetas/Actualizar" : "/Recetas/Insertar";
        const method = payload.Id ? "PUT" : "POST";

        return fetch(url, {
            method,
            headers: authHeaders({ 'Content-Type': 'application/json;charset=utf-8' }),
            body: JSON.stringify(payload)
        })
            .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
            .then(res => {
                if (res.valor) {
                    exitoModal(res.mensaje || (payload.Id ? "Receta modificada correctamente" : "Receta registrada correctamente"));
                    window.location.href = "/Recetas/Index";
                } else {
                    errorModal(res.mensaje || (payload.Id ? "Error al modificar la Receta" : "Error al crear la Receta"));
                }
            })
            .catch(err => {
                console.error(err);
                errorModal("Ha ocurrido un error al guardar la Receta.");
            });
    });
}
