/********************  OrdenesComprasNuevoModif.js (COMPLETO)  ********************/
let gridDetalleOC = null;
let detalleOC = []; // líneas de OrdenesComprasInsumo

// === ESTADO PENDIENTE ===
let ESTADO_PENDIENTE_ID = null;

const _num = v => Number(v ?? 0);
const fmtARS = v => new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
}).format(_num(v));
const fmtDec = v => new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 4
}).format(_num(v));

/** Convierte "$ 12.000,00" / "12000,5" / "12000.50" a Number */
function parseMoneda(v) {
    if (v == null) return 0;
    let s = String(v).trim();
    if (!s) return 0;

    // dejamos sólo dígitos, coma, punto y signo menos
    s = s.replace(/[^\d,.,,-]/g, '');

    // Caso "12.000,50" (., miles / , decimal)
    if (s.includes('.') && s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',') && !s.includes('.')) {
        // "12000,50" -> "12000.50"
        s = s.replace(',', '.');
    }

    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
}

/* ================== AUTH / FETCH HELPERS ================== */
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

/* ===== Flags de validación programática ===== */
let suspendValidacionDetalleChange = false;
let suspendValidacionCabeceraChange = false;

/* ================== INIT ================== */
$(document).ready(async () => {
    try {
        await cargarCombosCabecera();
        await inicializarTablaDetalle();
        await cargarDesdeOrdenCompraData();

        // Select2 cabecera
        $('#UnidadesNegocio, #Locales, #Proveedores, #Estados').select2({
            width: '100%'
        });

        // Select2 insumo modal
        $('#InsumoSelect').select2({
            dropdownParent: $('#detalleModal'),
            width: '100%',
            placeholder: 'Seleccionar un Insumo',
            allowClear: true
        });

        // Forzamos PrecioUnitario como texto para poder mostrar moneda
        const $precio = $('#PrecioUnitario');
        if ($precio.attr('type') === 'number') {
            $precio.attr('type', 'text');
        }

        // Validación “en vivo” de cabecera y modal (input/change)
        inicializarValidacionEnVivoCabecera();
        inicializarValidacionEnVivoDetalleModal();

        // cambio de UN → carga locales + limpia detalle + controla botón
        $('#UnidadesNegocio').on('change', async function () {
            const idUN = Number(this.value || 0);
            await poblarLocales(idUN);

            // al cambiar UN se limpia el detalle
            detalleOC = [];
            refrescarTablaDetalle();
            actualizarEstadoBotonDetalle();
        });

        // cambio de Proveedor → limpia detalle + controla botón
        $('#Proveedores').on('change', function () {
            detalleOC = [];
            refrescarTablaDetalle();
            actualizarEstadoBotonDetalle();
        });

        // recalcular subtotal modal + formato moneda en blur
        $('#PrecioUnitario')
            .on('input', function () {
                if (suspendValidacionDetalleChange) return;
                validarCampoDetalleIndividual(this);
                actualizarEstadoAlertDetalleModal();
            })
            .on('blur', function () {
                const n = parseMoneda(this.value);
                this.value = n ? fmtARS(n) : '';
                recalcularSubTotalModal();
            });

        $('#Cantidad').on('input', function () {
            if (suspendValidacionDetalleChange) return;
            validarCampoDetalleIndividual(this);
            actualizarEstadoAlertDetalleModal();
            recalcularSubTotalModal();
        });

        actualizarEstadoBotonDetalle();
    } catch (e) {
        console.error('Error en init OrdenesComprasNuevoModif:', e);
    }
});

/* ================== BOTÓN AÑADIR DETALLE ================== */
function obtenerBotonDetalle() {
    let btn = document.getElementById('btnAddDetalle');
    if (!btn) {
        btn = document.querySelector('button[onclick="abrirModalDetalle()"]');
    }
    return btn;
}

function actualizarEstadoBotonDetalle() {
    const btn = obtenerBotonDetalle();
    if (!btn) return;

    const idUN = Number($('#UnidadesNegocio').val() || 0);
    const idProv = Number($('#Proveedores').val() || 0);
    const enabled = idUN > 0 && idProv > 0;

    btn.disabled = !enabled;
    if (enabled) btn.classList.remove('disabled');
    else btn.classList.add('disabled');
}

/* ================== COMBOS CABECERA ================== */
async function listaUnidadesNegocioFilter() {
    const data = await fetchJson(`/UnidadesNegocio/ListaUsuario`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaLocalesFilter(idUnidadNegocio = -1) {
    try {
        const data = await fetchJson(`/Locales/ListaPorUnidad?IdUnidadNegocio=${idUnidadNegocio}`, { headers: authHeaders() });
        return data.map(x => ({ Id: x.Id, Nombre: x.Nombre, IdUnidadNegocio: x.IdUnidadNegocio }));
    } catch {
        const data = await fetchJson(`/Locales/Lista`, { headers: authHeaders() });
        const arr = data.map(x => ({ Id: x.Id, Nombre: x.Nombre, IdUnidadNegocio: x.IdUnidadNegocio }));
        return idUnidadNegocio > 0 ? arr.filter(x => (x.IdUnidadNegocio ?? -999) === idUnidadNegocio) : arr;
    }
}
async function listaProveedoresFilter() {
    const data = await fetchJson(`/Proveedores/Lista`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}
async function listaOrdenesComprasEstadoFilter() {
    const data = await fetchJson(`/OrdenesComprasEstado/Lista`, { headers: authHeaders() });
    return data.map(x => ({ Id: x.Id, Nombre: x.Nombre }));
}

// Insumos por Unidad de Negocio + Proveedor
async function listaInsumosFilter(idUnidadNegocio, idProveedor) {
    if (!(idUnidadNegocio > 0) || !(idProveedor > 0)) return [];

    const url = `/Insumos/ListaPorUnidadYProveedor?IdUnidadNegocio=${idUnidadNegocio}&IdProveedor=${idProveedor}`;
    const data = await fetchJson(url, { headers: authHeaders() });

    return data.map(x => {
        const costo = _num(
            x.CostoUnitario ?? x.costoUnitario ??
            x.PrecioUnitario ?? x.precioUnitario ??
            x.PrecioLista ?? x.precioLista ?? 0
        );

        return {
            Id: x.Id ?? x.id ?? '',
            Nombre: x.Descripcion ?? x.descripcion ?? x.Nombre ?? x.nombre ?? '',
            CostoUnitario: costo,
            IdProveedorLista: x.IdProveedorLista ?? x.idProveedorLista ?? 0
        };
    });
}

async function cargarCombosCabecera() {
    const [unidades, proveedores, estados] = await Promise.all([
        listaUnidadesNegocioFilter(),
        listaProveedoresFilter(),
        listaOrdenesComprasEstadoFilter()
    ]);

    const selUN = document.getElementById('UnidadesNegocio');
    const selLoc = document.getElementById('Locales');
    const selPrv = document.getElementById('Proveedores');
    const selEst = document.getElementById('Estados');

    if (selUN) {
        selUN.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
        unidades.forEach(u => {
            const o = document.createElement('option');
            o.value = u.Id;
            o.text = u.Nombre;
            selUN.appendChild(o);
        });
    }

    if (selLoc) {
        selLoc.innerHTML = '<option value="" disabled selected>Seleccione UN...</option>';
        selLoc.disabled = true;
    }

    if (selPrv) {
        selPrv.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
        proveedores.forEach(p => {
            const o = document.createElement('option');
            o.value = p.Id;
            o.text = p.Nombre;
            selPrv.appendChild(o);
        });
    }

    if (selEst) {
        selEst.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
        estados.forEach(e => {
            const o = document.createElement('option');
            o.value = e.Id;
            o.text = e.Nombre;
            selEst.appendChild(o);
        });

        // === ESTADO PENDIENTE: guardo el Id para usarlo luego ===
        const pendiente = estados.find(e =>
            (e.Nombre || '').toLowerCase().trim() === 'pendiente'
        );
        ESTADO_PENDIENTE_ID = pendiente ? pendiente.Id : null;
    }
}

async function poblarLocales(idUnidadNegocio) {
    const selLoc = document.getElementById('Locales');
    if (!selLoc) return;

    suspendValidacionCabeceraChange = true;

    if (!(idUnidadNegocio > 0)) {
        selLoc.innerHTML = '<option value="" disabled selected>Seleccione UN...</option>';
        selLoc.disabled = true;
        $('#Locales').val(null).trigger('change');
        suspendValidacionCabeceraChange = false;
        return;
    }

    const locales = await listaLocalesFilter(idUnidadNegocio);
    selLoc.disabled = false;
    selLoc.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
    locales.forEach(l => {
        const o = document.createElement('option');
        o.value = l.Id;
        o.text = l.Nombre;
        selLoc.appendChild(o);
    });

    $('#Locales').val(null).trigger('change');

    suspendValidacionCabeceraChange = false;
}

/* ================== TABLA DETALLE ================== */
async function inicializarTablaDetalle() {
    gridDetalleOC = $('#grd_Detalle').DataTable({
        data: [],
        language: {
            sLengthMenu: "Mostrar MENU registros",
            url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json"
        },
        paging: false,
        searching: false,
        info: false,
        columns: [
            { data: 'nombreInsumo', title: 'Insumo' },
            {
                data: 'precioUnitario',
                title: 'Precio Unitario',
                render: d => fmtARS(d)
            },
            {
                data: 'cantidad',
                title: 'Cantidad',
                render: d => fmtDec(d)
            },
            {
                data: 'subTotal',
                title: 'SubTotal',
                render: d => fmtARS(d)
            },
            {
                data: null,
                title: 'Acciones',
                orderable: false,
                searchable: false,
                render: function (data, type, row, meta) {
                    const idx = meta.row;
                    return `
                        <button class="btn btn-sm btn-outline-light me-1" type="button" onclick="editarDetalle(${idx})" title="Editar">
                            <i class="fa fa-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarDetalle(${idx})" title="Eliminar">
                            <i class="fa fa-trash"></i>
                        </button>`;
                }
            }
        ]
    });
}

function refrescarTablaDetalle() {
    if (!gridDetalleOC) return;
    gridDetalleOC.clear();
    gridDetalleOC.rows.add(detalleOC).draw();
    recalcularCostoTotal();
}

function recalcularCostoTotal() {
    const total = detalleOC.reduce((a, r) => a + _num(r.subTotal), 0);
    $('#CostoTotal').val(fmtARS(total));
}

/* ================== MODAL DETALLE ================== */

function getDetalleIndexInput() {
    let el = document.getElementById('detalleIndex');
    if (!el) {
        const form = document.getElementById('formDetalle');
        if (!form) return null;
        el = document.createElement('input');
        el.type = 'hidden';
        el.id = 'detalleIndex';
        form.appendChild(el);
    }
    return el;
}

async function abrirModalDetalle(indice = null) {
    const idUN = Number($('#UnidadesNegocio').val() || 0);
    const idProv = Number($('#Proveedores').val() || 0);

    if (!(idUN > 0) || !(idProv > 0)) {
        const msg = 'Debes seleccionar una Unidad de Negocio y un Proveedor antes de añadir insumos.';
        if (typeof advertenciaModal === 'function') advertenciaModal(msg);
        else alert(msg);
        return;
    }

    try {
        await poblarInsumosModal(idUN, idProv);

        const alert = document.getElementById('modalAlert');
        alert?.classList.add('d-none');

        // limpiar errores del modal
        $('#formDetalle .is-invalid').removeClass('is-invalid');
        $('#formDetalle .invalid-feedback').addClass('d-none');

        const idxInput = getDetalleIndexInput();
        const titulo = document.getElementById('detalleModalTitle') || document.querySelector('#detalleModal .modal-title');
        const btnGuardar = document.getElementById('btnGuardarDetalle') || document.querySelector('#detalleModal .btn-new');

        suspendValidacionDetalleChange = true;

        if (indice != null && detalleOC[indice]) {
            const item = detalleOC[indice];

            if (idxInput) idxInput.value = indice;
            if (titulo) titulo.textContent = 'Editar Insumo';
            if (btnGuardar) btnGuardar.innerHTML = '<i class="fa fa-check"></i> Guardar';

            $('#InsumoSelect').prop('disabled', true);
            $('#InsumoSelect').val(item.idInsumo).trigger('change');

            $('#PrecioUnitario').val(item.precioUnitario ? fmtARS(item.precioUnitario) : '');
            $('#Cantidad').val(item.cantidad || 1);
            $('#SubTotal').val(item.subTotal ? fmtARS(item.subTotal) : '');
        } else {
            if (idxInput) idxInput.value = '';
            if (titulo) titulo.textContent = 'Agregar Insumo';
            if (btnGuardar) btnGuardar.innerHTML = '<i class="fa fa-check"></i> Registrar';

            $('#InsumoSelect').prop('disabled', false);
            $('#InsumoSelect').val('').trigger('change');

            $('#PrecioUnitario').val('');
            $('#Cantidad').val('1');
            $('#SubTotal').val('');
        }

        suspendValidacionDetalleChange = false;

        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('detalleModal'));
        modal.show();
    } catch (e) {
        console.error('Error abrirModalDetalle:', e);
    }
}

async function poblarInsumosModal(idUnidadNegocio, idProveedor) {
    const sel = document.getElementById('InsumoSelect');
    if (!sel) return;

    const insumos = await listaInsumosFilter(idUnidadNegocio, idProveedor);

    suspendValidacionDetalleChange = true;

    // limpiamos y agregamos placeholder
    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.text = 'Seleccionar un Insumo';
    placeholder.disabled = true;
    placeholder.selected = true;
    sel.appendChild(placeholder);

    // opciones
    insumos.forEach(i => {
        const o = document.createElement('option');
        o.value = i.Id;
        o.text = i.Nombre;
        o.dataset.costo = i.CostoUnitario || 0;
        o.dataset.idprovlista = i.IdProveedorLista || 0;
        sel.appendChild(o);
    });

    const $precio = $('#PrecioUnitario');

    $('#InsumoSelect')
        .off('change.OC')
        .on('change.OC', function () {
            if (suspendValidacionDetalleChange) return;

            const opt = this.options[this.selectedIndex];
            const costo = _num(opt?.dataset?.costo || 0);

            if (costo > 0) {
                $precio.val(fmtARS(costo));

                if (!_num($('#Cantidad').val())) {
                    $('#Cantidad').val('1');
                }
                recalcularSubTotalModal();
            }

            validarCampoDetalleIndividual(this);
            actualizarEstadoAlertDetalleModal();
        });

    // mostrar placeholder
    $('#InsumoSelect').val('').trigger('change');

    suspendValidacionDetalleChange = false;
}

function recalcularSubTotalModal() {
    const precio = parseMoneda($('#PrecioUnitario').val());
    const cant = _num($('#Cantidad').val());
    const sub = precio * cant;
    $('#SubTotal').val(sub ? fmtARS(sub) : '');
}

/* ===== Validación modal detalle (en vivo) ===== */
function inicializarValidacionEnVivoDetalleModal() {
    $('#formDetalle [data-required="true"]').each(function () {
        const el = this;
        const ev = (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'number' || el.type === 'text') ? 'change' : 'input';
        $(el).on(ev, function () {
            if (suspendValidacionDetalleChange) return;
            validarCampoDetalleIndividual(el);
            actualizarEstadoAlertDetalleModal();
        });
    });
}

function validarCampoDetalleIndividual(el) {
    const val = (el.value ?? '').toString().trim();
    const fb = el.parentElement.querySelector('.invalid-feedback');
    const min = parseFloat(el.getAttribute('data-min') || '0');
    let msg = '';

    if (!val) {
        msg = fb?.getAttribute('data-msg-required') || fb?.dataset.msgRequired || 'Campo requerido';
    } else if (!Number.isNaN(min) && min > 0) {
        let numericVal = Number(val);
        if (el.id === 'PrecioUnitario') numericVal = parseMoneda(val);
        if (numericVal <= 0) {
            msg = fb?.getAttribute('data-msg-min') || fb?.dataset.msgMin || 'Debe ser mayor que 0';
        }
    }

    if (msg) {
        el.classList.add('is-invalid');
        if (fb) {
            fb.textContent = msg;
            fb.classList.remove('d-none');
        }
        return false;
    } else {
        el.classList.remove('is-invalid');
        if (fb) fb.classList.add('d-none');
        return true;
    }
}

function camposDetalleModalValidos() {
    let ok = true;
    $('#formDetalle [data-required="true"]').each(function () {
        const el = this;
        const val = (el.value ?? '').toString().trim();
        const min = parseFloat(el.getAttribute('data-min') || '0');

        if (!val) { ok = false; return false; }

        if (!Number.isNaN(min) && min > 0) {
            let numericVal = Number(val);
            if (el.id === 'PrecioUnitario') numericVal = parseMoneda(val);
            if (numericVal <= 0) { ok = false; return false; }
        }
    });
    return ok;
}

function actualizarEstadoAlertDetalleModal() {
    const alert = document.getElementById('modalAlert');
    if (!alert) return;
    if (camposDetalleModalValidos()) {
        alert.classList.add('d-none');
    }
}

function validarDetalleModal() {
    let ok = true;

    $('#formDetalle [data-required="true"]').each(function () {
        if (!validarCampoDetalleIndividual(this)) ok = false;
    });

    const alert = document.getElementById('modalAlert');
    if (!ok) alert?.classList.remove('d-none'); else alert?.classList.add('d-none');

    return ok;
}

function guardarDetalle() {
    if (!validarDetalleModal()) return;

    const idxInput = getDetalleIndexInput();
    const idx = idxInput ? idxInput.value : '';

    const idInsumo = $('#InsumoSelect').val();
    const nombreInsumo = $('#InsumoSelect option:selected').text();
    const precio = parseMoneda($('#PrecioUnitario').val());
    const cant = _num($('#Cantidad').val());
    const sub = precio * cant;

    // IdProveedorLista del option seleccionado
    let idProveedorLista = 0;
    const opt = document.querySelector('#InsumoSelect option:checked');
    if (opt) {
        idProveedorLista = _num(opt.dataset.idprovlista || 0);
    }
    if (!idProveedorLista && idx !== '' && detalleOC[idx]) {
        idProveedorLista = detalleOC[idx].idProveedorLista || 0;
    }

    const item = {
        id: (idx !== '' && detalleOC[idx]) ? (detalleOC[idx].id || 0) : 0,
        idInsumo,
        nombreInsumo,
        precioUnitario: precio,
        cantidad: cant,
        subTotal: sub,
        idProveedorLista,
        // campos para el repo (si no se cargan acá quedan en 0)
        cantidadEntregada: (idx !== '' && detalleOC[idx]) ? _num(detalleOC[idx].cantidadEntregada) : 0,
        cantidadRestante: (idx !== '' && detalleOC[idx]) ? _num(detalleOC[idx].cantidadRestante) : cant,
        idEstado: (idx !== '' && detalleOC[idx]) ? _num(detalleOC[idx].idEstado) : 1,
        nota: (idx !== '' && detalleOC[idx]) ? (detalleOC[idx].nota || '') : ''
    };

    if (idx !== '' && detalleOC[idx]) {
        // EDITAR: reemplazamos sólo esa fila
        detalleOC[idx] = item;
    } else {
        // NUEVO: si ya existe una línea con ese insumo, sumamos cantidades
        const existingIndex = detalleOC.findIndex(d =>
            String(d.idInsumo) === String(idInsumo)
        );

        if (existingIndex >= 0) {
            const existente = detalleOC[existingIndex];

            const cantidadAnterior = _num(existente.cantidad);
            const nuevaCantidad = cantidadAnterior + cant;

            existente.cantidad = nuevaCantidad;
            existente.precioUnitario = precio;          // dejamos el último precio
            existente.subTotal = precio * nuevaCantidad; // recalculamos subtotal
        } else {
            detalleOC.push(item);
        }
    }

    refrescarTablaDetalle();

    const modal = bootstrap.Modal.getInstance(document.getElementById('detalleModal'));
    modal?.hide();
}

function editarDetalle(indice) {
    abrirModalDetalle(indice);
}

function eliminarDetalle(indice) {
    if (!detalleOC[indice]) return;
    const ok = window.confirm('¿Desea eliminar este insumo del detalle?');
    if (!ok) return;
    detalleOC.splice(indice, 1);
    refrescarTablaDetalle();
}

/* ================== VALIDACIÓN CABECERA ================== */

// valida 1 campo de cabecera (input/select) y muestra/oculta el mensaje del campo
function validarCampoCabeceraIndividual(el) {
    const val = (el.value ?? '').toString().trim();
    const fb = el.parentElement.querySelector('.invalid-feedback');
    let msg = '';

    if (!val) {
        msg = fb?.getAttribute('data-msg-required') || fb?.dataset.msgRequired || 'Campo requerido';
    }

    if (msg) {
        el.classList.add('is-invalid');
        if (fb) {
            fb.textContent = msg;
            fb.classList.remove('d-none');
        }
        return false;
    } else {
        el.classList.remove('is-invalid');
        if (fb) fb.classList.add('d-none');
        return true;
    }
}

// sólo chequea si lógicamente está bien (para saber si ocultar alerta global)
function campoCabeceraLogicamenteValido(el) {
    const val = (el.value ?? '').toString().trim();
    if (!val) return false;
    const min = parseFloat(el.getAttribute('data-min') || '0');
    if (!Number.isNaN(min) && min > 0 && Number(val) <= 0) return false;
    return true;
}

function camposCabeceraValidos() {
    const root = document.getElementById('frmCabeceraOC') || document;
    let ok = true;
    $(root).find('[data-required="true"]').each(function () {
        if (!campoCabeceraLogicamenteValido(this)) { ok = false; return false; }
    });
    return ok;
}

function inicializarValidacionEnVivoCabecera() {
    const root = document.getElementById('frmCabeceraOC') || document;
    $(root).find('[data-required="true"]').each(function () {
        const el = this;
        const ev = (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'number' || el.type === 'text') ? 'change' : 'input';
        $(el).on(ev, function () {
            if (suspendValidacionCabeceraChange) return;
            validarCampoCabeceraIndividual(el);
            if (camposCabeceraValidos()) {
                const alert = document.getElementById('alertRequeridos');
                alert?.classList.add('d-none');
            }
        });
    });
}

function validarCabeceraOC() {
    let ok = true;
    const root = document.getElementById('frmCabeceraOC') || document;

    $(root).find('[data-required="true"]').each(function () {
        if (!validarCampoCabeceraIndividual(this)) ok = false;
    });

    const alert = document.getElementById('alertRequeridos');
    if (!ok) alert?.classList.remove('d-none'); else alert?.classList.add('d-none');

    return ok;
}

function validarDetalleOC() {
    const alert = document.getElementById('alertDetalle');
    if (!detalleOC.length) {
        alert?.classList.remove('d-none');
        return false;
    }
    alert?.classList.add('d-none');
    return true;
}

/* ================== CARGA INICIAL DESDE EditarInfo ================== */

async function ObtenerDatosOrdenCompra(id) {
    return await fetchJson(`/OrdenesCompras/EditarInfo?id=${id}`);
}

async function cargarDesdeOrdenCompraData() {
    // En la vista tenés:
    // var OrdenCompraData = ...;
    const raw = window.OrdenCompraData;

    let cab = {};
    if (typeof raw === 'number' && raw > 0) {
        // igual que SubRecetas: si viene el Id, voy a EditarInfo
        cab = await ObtenerDatosOrdenCompra(raw);
    } else if (raw && typeof raw === 'object') {
        cab = raw;
    } else {
        cab = {};
    }

    const id = _num(cab.Id ?? cab.id ?? 0);

    const titulo = document.getElementById('tituloOC');
    const btn = document.getElementById('btnNuevoModificarOC');

    if (id > 0) {
        // ---- Modo EDICIÓN ----
        $('#IdOC').val(id);

        if (titulo) titulo.textContent = `Editar Orden de Compra #${id}`;
        if (btn) btn.innerHTML = `<i class="fa fa-save me-1"></i> Guardar`;

        // Cabecera (VMOrdenCompra)
        const idUN = _num(cab.IdUnidadNegocio ?? cab.idUnidadNegocio ?? 0);
        const idLocal = _num(cab.IdLocal ?? cab.idLocal ?? 0);
        const idProv = _num(cab.IdProveedor ?? cab.idProveedor ?? 0);
        const idEst = _num(cab.IdEstado ?? cab.idEstado ?? 0);

        if (idUN) {
            $('#UnidadesNegocio').val(idUN);
            await poblarLocales(idUN);
        }

        if (idLocal) $('#Locales').val(idLocal);
        if (idProv) $('#Proveedores').val(idProv);
        if (idEst) $('#Estados').val(idEst);

        $('#UnidadesNegocio').trigger('change');
        $('#Locales').trigger('change');
        $('#Proveedores').trigger('change');
        $('#Estados').trigger('change');

        // === ESTADO PENDIENTE: bloquear siempre el combo, mostrando el valor real ===
        $('#Estados').prop('disabled', true).trigger('change.select2');

        // Fechas
        const fechaEmision = cab.FechaEmision ?? cab.fechaEmision;
        const fechaEntrega = cab.FechaEntrega ?? cab.fechaEntrega;

        if (fechaEmision) {
            const d = new Date(fechaEmision);
            if (!isNaN(d)) {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                $('#FechaEmision').val(`${yyyy}-${mm}-${dd}`);
            }
        }

        if (fechaEntrega) {
            const d2 = new Date(fechaEntrega);
            if (!isNaN(d2)) {
                const yyyy = d2.getFullYear();
                const mm = String(d2.getMonth() + 1).padStart(2, '0');
                const dd = String(d2.getDate()).padStart(2, '0');
                $('#FechaEntrega').val(`${yyyy}-${mm}-${dd}`);
            }
        }

        const nota = cab.NotaInterna ?? cab.notaInterna ?? '';
        if (nota) $('#NotaInterna').val(nota);

        const costoTotal = cab.CostoTotal ?? cab.costoTotal ?? 0;
        if (costoTotal) $('#CostoTotal').val(fmtARS(costoTotal));

        // ---- Detalle ----
        const detRaw = cab.OrdenesComprasInsumos ?? cab.ordenesComprasInsumos ?? [];
        const detArray = Array.isArray(detRaw) ? detRaw : [];

        detalleOC = detArray.map(d => ({
            id: _num(d.Id ?? d.id ?? 0),
            idInsumo: d.IdInsumo ?? d.idInsumo ?? '',
            nombreInsumo:
                d.Nombre ?? d.nombre ??
                d.NombreInsumo ?? d.nombreInsumo ??
                d.Insumo ?? d.insumo ??
                d.DescripcionInsumo ?? d.descripcionInsumo ?? '',
            precioUnitario: _num(
                d.PrecioLista ?? d.precioLista ??
                d.PrecioUnitario ?? d.precioUnitario ??
                d.Precio ?? d.precio ?? 0
            ),
            cantidad: _num(
                d.CantidadPedida ?? d.cantidadPedida ??
                d.Cantidad ?? d.cantidad ?? 0
            ),
            subTotal: _num(
                d.SubTotal ?? d.subTotal ??
                d.Subtotal ?? d.subtotal ??
                d.CostoTotal ?? d.costoTotal ?? 0
            ),
            idProveedorLista: _num(d.IdProveedorLista ?? d.idProveedorLista ?? 0),
            cantidadEntregada: _num(d.CantidadEntregada ?? d.cantidadEntregada ?? 0),
            cantidadRestante: _num(d.CantidadRestante ?? d.cantidadRestante ??
                (d.CantidadPedida ?? d.cantidadPedida ?? 0) -
                (d.CantidadEntregada ?? d.cantidadEntregada ?? 0)),
            idEstado: _num(d.IdEstado ?? d.idEstado ?? 1),
            nota: d.NotaInterna ?? d.notaInterna ?? ''
        }));

        // Si vino sin nombre (o vino el Id como texto), intento resolverlo
        // con la lista de insumos por UN + Proveedor:
        if (idUN > 0 && idProv > 0 && detalleOC.length) {
            try {
                const listaInsumos = await listaInsumosFilter(idUN, idProv);
                const mapNombres = new Map();
                listaInsumos.forEach(i => {
                    mapNombres.set(String(i.Id), i.Nombre);
                });

                detalleOC.forEach(d => {
                    const nombreActual = (d.nombreInsumo || '').trim();
                    if (!nombreActual || nombreActual === String(d.idInsumo)) {
                        const nom = mapNombres.get(String(d.idInsumo));
                        if (nom) {
                            d.nombreInsumo = nom;
                        } else if (!nombreActual) {
                            d.nombreInsumo = String(d.idInsumo || '');
                        }
                    }
                });
            } catch (e) {
                console.warn('No se pudo mapear nombre de insumos desde listaInsumosFilter:', e);
            }
        }

        refrescarTablaDetalle();
    } else {
        // ---- Modo NUEVA OC ----
        if (titulo) titulo.textContent = 'Nueva Orden de Compra';
        if (btn) btn.innerHTML = `<i class="fa fa-save me-1"></i> Registrar`;

        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        $('#FechaEmision').val(`${yyyy}-${mm}-${dd}`);

        // === ESTADO PENDIENTE por defecto y bloqueado ===
        if (ESTADO_PENDIENTE_ID != null) {
            $('#Estados').val(ESTADO_PENDIENTE_ID).trigger('change');
        }
        $('#Estados').prop('disabled', true).trigger('change.select2');

        detalleOC = [];
        refrescarTablaDetalle();
    }

    actualizarEstadoBotonDetalle();
}

/* ================== GUARDAR (Insertar / Actualizar) ================== */
async function guardarOC() {
    try {
        if (!validarCabeceraOC()) return;
        if (!validarDetalleOC()) return;

        const idOC = $('#IdOC').val();
        const id = idOC ? Number(idOC) : 0;

        const idUN = _num($('#UnidadesNegocio').val());
        const idLocal = _num($('#Locales').val());
        const idProv = _num($('#Proveedores').val());
        const idEstado = _num($('#Estados').val());
        const fechaEmision = $('#FechaEmision').val();
        const fechaEntrega = $('#FechaEntrega').val() || null;
        const notaInterna = $('#NotaInterna').val() || '';

        const totalCalc = detalleOC.reduce((a, r) => a + _num(r.subTotal), 0);

        const modelo = {
            Id: id,
            IdUnidadNegocio: idUN,
            IdLocal: idLocal,
            IdProveedor: idProv,
            FechaEmision: fechaEmision,
            FechaEntrega: fechaEntrega,
            CostoTotal: totalCalc,
            IdEstado: idEstado,
            NotaInterna: notaInterna,
            OrdenesComprasInsumos: detalleOC.map(d => ({
                Id: d.id || 0,
                IdOrdenCompra: id || 0,
                IdInsumo: d.idInsumo,
                IdProveedorLista: d.idProveedorLista || null,
                CantidadPedida: d.cantidad,
                CantidadEntregada: d.cantidadEntregada || 0,
                CantidadRestante: d.cantidadRestante || (d.cantidad - (d.cantidadEntregada || 0)),
                PrecioLista: d.precioUnitario,
                Subtotal: d.subTotal,
                IdEstado: d.idEstado || idEstado || 1,
                NotaInterna: d.nota || ''
            }))
        };

        const url = id === 0 ? "/OrdenesCompras/Insertar" : "/OrdenesCompras/Actualizar";
        const method = id === 0 ? "POST" : "PUT";

        const r = await fetch(url, {
            method: method,
            headers: authHeaders({ 'Content-Type': 'application/json;charset=utf-8' }),
            body: JSON.stringify(modelo)
        });

        if (!r.ok) throw new Error(await r.text().catch(() => 'Error HTTP'));
        const j = await r.json().catch(() => ({}));

        const mensajeOK = id === 0
            ? "Orden de compra registrada correctamente"
            : "Orden de compra modificada correctamente";

        if (j && j.valor === false) {
            if (typeof advertenciaModal === 'function') advertenciaModal(j.mensaje || 'No se pudo guardar la orden de compra.');
            else alert(j.mensaje || 'No se pudo guardar la orden de compra.');
            return;
        }

        if (typeof exitoModal === 'function') {
            exitoModal(j.mensaje || mensajeOK);
        } else {
            alert(mensajeOK);
        }

        const nuevoId = j.id || j.Id || id;

        // Navegación post-guardar:
        // - Si es NUEVA OC: mantiene comportamiento anterior (queda en NuevoModif del nuevo Id)
        // - Si es MODIFICACIÓN: vuelve al listado de Ordenes de Compra
        if (id === 0) {
            if (nuevoId && nuevoId > 0) {
                window.location.href = '/OrdenesCompras/NuevoModif/' + nuevoId;
            } else {
                window.location.href = '/OrdenesCompras';
            }
        } else {
            window.location.href = '/OrdenesCompras';
        }

    } catch (e) {
        console.error('Error al guardar orden de compra:', e);
        if (typeof errorModal === 'function') errorModal('Error al guardar la orden de compra.');
        else alert('Error al guardar la orden de compra.');
    }
}
/********************  FIN OrdenesComprasNuevoModif.js  ********************/
