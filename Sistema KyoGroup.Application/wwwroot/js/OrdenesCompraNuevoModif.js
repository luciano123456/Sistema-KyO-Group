/********************  OrdenesComprasNuevoModif.js (COMPLETO)  ********************/
let gridDetalleOC = null;
let detalleOC = []; // líneas de OrdenesComprasInsumo

// === ESTADO PENDIENTE ===
let ESTADO_PENDIENTE_ID = null;

// === MODO BLOQUEADO POR COMPRAS ASOCIADAS ===
let OC_BLOQUEADA = false;
let OC_ResumenCompras = [];   // array que TIENE que venir del backend con precios reales
let OC_DetalleOriginal = [];  // detalle crudo de la OC (OrdenesComprasInsumos)
let insumosModalCache = [];

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

        // Select2: inicializado globalmente por site-select2.js

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

            if (!OC_BLOQUEADA) {
                detalleOC = [];
                refrescarTablaDetalle();
            }
            actualizarEstadoBotonDetalle();
        });

        // cambio de Proveedor → limpia detalle + controla botón
        $('#Proveedores').on('change', function () {
            if (!OC_BLOQUEADA) {
                detalleOC = [];
                refrescarTablaDetalle();
            }
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
        actualizarVisibilidadPanelDetalle();

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

    if (OC_BLOQUEADA) {
        btn.disabled = true;
        btn.classList.add('disabled');
        return;
    }

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
        return data.map(x => ({ Id: x.Id, Nombre: x.Nombre, IdUnidadNegocio: x.IdUnidadNegocio ?? x.IdCombo }));
    } catch {
        const data = await fetchJson(`/Locales/Lista`, { headers: authHeaders() });
        const arr = data.map(x => ({ Id: x.Id, Nombre: x.Nombre, IdUnidadNegocio: x.IdUnidadNegocio ?? x.IdCombo }));
        return idUnidadNegocio > 0 ? arr.filter(x => Number(x.IdUnidadNegocio ?? -999) === idUnidadNegocio) : arr;
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

async function listaInsumosFilter(idUnidadNegocio, idProveedor) {
    if (!(idUnidadNegocio > 0) || !(idProveedor > 0)) return [];

    // Preferir lista de precios del proveedor (todos los ítems, con o sin precio)
    let raw = null;
    try {
        raw = await fetchJson(
            `/ProveedoresInsumos/ListaParaOrdenCompra?IdProveedor=${idProveedor}&IdUnidadNegocio=${idUnidadNegocio}`,
            { headers: authHeaders() }
        );
    } catch {
        raw = await fetchJson(
            `/Insumos/ListaPorUnidadYProveedor?IdUnidadNegocio=${idUnidadNegocio}&IdProveedor=${idProveedor}`,
            { headers: authHeaders() }
        );
    }
    const data = Array.isArray(raw) ? raw : (raw?.$values || []);

    return data.map(x => {
        const costo = _num(
            x.CostoUnitario ?? x.costoUnitario ??
            x.PrecioUnitario ?? x.precioUnitario ??
            x.PrecioLista ?? x.precioLista ?? 0
        );
        const idLista = _num(x.IdProveedorLista ?? x.idProveedorLista ?? 0);
        const idInsumo = _num(x.Id ?? x.id ?? 0);
        const cantProv = _num(x.CantidadProveedores ?? x.cantidadProveedores ?? (idLista > 0 ? 1 : 0));

        return {
            Id: idInsumo > 0 ? idInsumo : (idLista > 0 ? `L${idLista}` : ''),
            Nombre: x.Descripcion ?? x.descripcion ?? x.Nombre ?? x.nombre ?? '',
            CostoUnitario: costo,
            IdProveedorLista: idLista,
            CantidadProveedores: cantProv,
            IdInsumoCatalogo: idInsumo
        };
    }).filter(x => x.Id !== '');
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

                    if (OC_BLOQUEADA) {
                        return `<span class="badge bg-secondary">Bloqueado</span>`;
                    }

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
    if (OC_BLOQUEADA) return;

    const idUN = Number($('#UnidadesNegocio').val() || 0);
    const idProv = Number($('#Proveedores').val() || 0);

    if (!(idUN > 0) || !(idProv > 0)) {
        advertenciaModal('Debes seleccionar una Unidad de Negocio y un Proveedor antes de añadir insumos.');
        return;
    }

    try {
        await poblarInsumosModal(idUN, idProv);

        const alert = document.getElementById('modalAlert');
        alert?.classList.add('d-none');
        $('#insumoSinVinculoAlertOC').addClass('d-none');

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
            $('#insumoSinVinculoAlertOC').addClass('d-none');
            $('#btnGuardarDetalle').prop('disabled', false);
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

        bootstrap.Modal.getOrCreateInstance(document.getElementById('detalleModal')).show();

    } catch (e) {
        console.error('Error abrirModalDetalle:', e);
    }
}

/* ================== POPULAR INSUMOS MODAL ================== */
async function poblarInsumosModal(idUnidadNegocio, idProveedor) {
    const sel = document.getElementById('InsumoSelect');
    if (!sel) return;

    const insumos = await listaInsumosFilter(idUnidadNegocio, idProveedor);
    insumosModalCache = insumos.map(x => {
        const idLista = Number(x.IdProveedorLista || 0);
        const idCat = Number(x.IdInsumoCatalogo || 0);
        const idOpt = x.Id; // puede ser número o "L123"
        return {
            ...RpInsumoVinculo.normalizar({
                Id: idOpt,
                Descripcion: x.Nombre,
                CostoUnitario: x.CostoUnitario,
                IdProveedorLista: idLista,
                CantidadProveedores: (Number(x.CantidadProveedores) > 0 || idLista > 0) ? 1 : 0,
            }),
            IdInsumoCatalogo: idCat,
            IdOption: idOpt
        };
    });

    suspendValidacionDetalleChange = true;

    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.text = 'Seleccionar un Insumo';
    placeholder.disabled = true;
    placeholder.selected = true;
    sel.appendChild(placeholder);

    insumosModalCache.forEach(i => {
        const o = document.createElement('option');
        o.value = String(i.IdOption ?? i.Id);
        o.text = i.Descripcion;
        o.dataset.costo = i.CostoUnitario || 0;
        o.dataset.idprovlista = i.IdProveedorLista || 0;
        o.dataset.idinsumo = i.IdInsumoCatalogo || 0;
        sel.appendChild(o);
    });

    $('#InsumoSelect')
        .off('change.OC')
        .on('change.OC', function () {
            if (suspendValidacionDetalleChange) return;
            if ($('#InsumoSelect').prop('disabled')) {
                $('#insumoSinVinculoAlertOC').addClass('d-none');
                return;
            }

            const selVal = String(this.value || '');
            if (!selVal) {
                $('#insumoSinVinculoAlertOC').addClass('d-none');
                $('#btnGuardarDetalle').prop('disabled', false);
                return;
            }

            const insumo = insumosModalCache.find(x => String(x.IdOption ?? x.Id) === selVal) || null;
            const ok = RpInsumoVinculo.aplicarSeleccionModal({
                insumo,
                alertEl: '#insumoSinVinculoAlertOC',
                precioEl: '#PrecioUnitario',
                totalEl: '#SubTotal',
                btnEl: '#btnGuardarDetalle',
                cantidadEl: '#Cantidad',
                fmtMon: fmtARS,
                contexto: 'orden',
            });

            if (ok) recalcularSubTotalModal();

            validarCampoDetalleIndividual(this);
            actualizarEstadoAlertDetalleModal();
        });

    $('#InsumoSelect').val('').trigger('change');

    suspendValidacionDetalleChange = false;
}

function recalcularSubTotalModal() {
    const precio = parseMoneda($('#PrecioUnitario').val());
    const cant = _num($('#Cantidad').val());
    const sub = precio * cant;
    $('#SubTotal').val(sub ? fmtARS(sub) : '');
}

/* ================== VALIDACIÓN MODAL DETALLE ================== */
function inicializarValidacionEnVivoDetalleModal() {
    $('#formDetalle [data-required="true"]').each(function () {
        const el = this;
        const ev = 'change';
        $(el).on(ev, function () {
            if (suspendValidacionDetalleChange) return;
            validarCampoDetalleIndividual(el);
            actualizarEstadoAlertDetalleModal();
        });
    });
}

function validarCampoDetalleIndividual(el) {
    const val = (el.value ?? '').trim();
    const fb = el.parentElement.querySelector('.invalid-feedback');
    const min = parseFloat(el.getAttribute('data-min') || '0');
    let msg = '';

    if (!val)
        msg = 'Campo requerido';
    else if (!Number.isNaN(min) && min > 0) {
        let numericVal = Number(val);
        if (el.id === 'PrecioUnitario') numericVal = parseMoneda(val);
        if (numericVal <= 0) msg = 'Debe ser mayor que 0';
    }

    if (msg) {
        el.classList.add('is-invalid');
        if (fb) { fb.textContent = msg; fb.classList.remove('d-none'); }
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
        let v = (el.value ?? '').trim();
        let min = parseFloat(el.getAttribute('data-min') || '0');

        if (!v) { ok = false; return false; }
        let n = Number(v);
        if (el.id === 'PrecioUnitario') n = parseMoneda(v);
        if (!Number.isNaN(min) && min > 0 && n <= 0) { ok = false; return false; }
    });
    return ok;
}

function actualizarEstadoAlertDetalleModal() {
    const alert = document.getElementById('modalAlert');
    if (!alert) return;
    if (camposDetalleModalValidos()) alert.classList.add('d-none');
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

/* ================== GUARDAR DETALLE ================== */
function guardarDetalle() {
    if (OC_BLOQUEADA) return;

    const idxInput = getDetalleIndexInput();
    const idx = idxInput ? idxInput.value : '';
    const rawVal = String($('#InsumoSelect').val() || '');
    const opt = document.querySelector('#InsumoSelect option:checked');
    let idProveedorLista = _num(opt?.dataset?.idprovlista || 0);
    let idInsumo = _num(opt?.dataset?.idinsumo || 0);

    if (!(idInsumo > 0) && rawVal.startsWith('L')) {
        idProveedorLista = _num(rawVal.slice(1)) || idProveedorLista;
    } else if (!(idInsumo > 0)) {
        idInsumo = _num(rawVal);
    }

    const insumoSel = insumosModalCache.find(x => String(x.IdOption ?? x.Id) === rawVal) || null;
    if (idx === '' && rawVal) {
        if (!RpInsumoVinculo.tieneVinculo(insumoSel, 'orden') && !(idProveedorLista > 0)) {
            RpInsumoVinculo.aplicarSeleccionModal({
                insumo: insumoSel,
                alertEl: '#insumoSinVinculoAlertOC',
                precioEl: '#PrecioUnitario',
                totalEl: '#SubTotal',
                btnEl: '#btnGuardarDetalle',
                cantidadEl: '#Cantidad',
                fmtMon: fmtARS,
                contexto: 'orden',
            });
            return;
        }
    }

    if (!validarDetalleModal()) return;

    return withBusy("#btnGuardarDetalle", async () => {
        if (!(idInsumo > 0) && idProveedorLista > 0) {
            try {
                const idUN = _num($('#UnidadesNegocio').val());
                const aseg = await fetchJson('/ProveedoresInsumos/AsegurarInsumoCatalogo', {
                    method: 'POST',
                    headers: authHeaders({ 'Content-Type': 'application/json;charset=utf-8' }),
                    body: JSON.stringify({ IdListaProveedor: idProveedorLista, IdUnidadNegocio: idUN })
                });
                if (!aseg?.valor || !(_num(aseg.idInsumo ?? aseg.IdInsumo) > 0)) {
                    errorModal?.(aseg?.mensaje || 'No se pudo vincular el ítem al catálogo de insumos.');
                    return;
                }
                idInsumo = _num(aseg.idInsumo ?? aseg.IdInsumo);
                idProveedorLista = _num(aseg.idProveedorLista ?? aseg.IdProveedorLista ?? idProveedorLista);
            } catch (e) {
                console.error(e);
                errorModal?.(e?.message || 'No se pudo vincular el ítem al catálogo de insumos.');
                return;
            }
        }

        if (!(idInsumo > 0)) {
            errorModal?.('Seleccioná un insumo válido.');
            return;
        }

        const nombreInsumo = $('#InsumoSelect option:selected').text();
        const precio = parseMoneda($('#PrecioUnitario').val());
        const cant = _num($('#Cantidad').val());
        const sub = precio * cant;

        if (!idProveedorLista && idx !== '' && detalleOC[idx])
            idProveedorLista = detalleOC[idx].idProveedorLista || 0;

        const item = {
            id: (idx !== '' && detalleOC[idx]) ? detalleOC[idx].id : 0,
            idInsumo,
            nombreInsumo,
            precioUnitario: precio,
            cantidad: cant,
            subTotal: sub,
            idProveedorLista,
            cantidadEntregada: (idx !== '' && detalleOC[idx]) ? detalleOC[idx].cantidadEntregada : 0,
            cantidadRestante: (idx !== '' && detalleOC[idx])
                ? detalleOC[idx].cantidadRestante
                : cant,
            idEstado: (idx !== '' && detalleOC[idx]) ? detalleOC[idx].idEstado : 1,
            nota: (idx !== '' && detalleOC[idx]) ? detalleOC[idx].nota : ''
        };

        if (idx !== '' && detalleOC[idx]) {
            detalleOC[idx] = item;
        } else {
            const existingIndex = detalleOC.findIndex(d => String(d.idInsumo) === String(idInsumo));
            if (existingIndex >= 0) {
                const ex = detalleOC[existingIndex];
                const nuevaCant = _num(ex.cantidad) + cant;
                ex.cantidad = nuevaCant;
                ex.precioUnitario = precio;
                ex.subTotal = precio * nuevaCant;
            } else {
                detalleOC.push(item);
            }
        }

        refrescarTablaDetalle();
        bootstrap.Modal.getInstance(document.getElementById('detalleModal')).hide();
    }, { label: "Añadiendo..." });
}

/* ================== EDITAR / ELIMINAR DETALLE ================== */
function editarDetalle(i) {
    if (OC_BLOQUEADA) return;
    abrirModalDetalle(i);
}

async function eliminarDetalle(i) {
    if (OC_BLOQUEADA) return;
    if (!detalleOC[i]) return;
    if (!(await confirmarModal('¿Desea eliminar este insumo?'))) return;
    detalleOC.splice(i, 1);
    refrescarTablaDetalle();
}

/* ================== VALIDACIÓN CABECERA ================== */
function validarCampoCabeceraIndividual(el) {
    const val = (el.value ?? '').trim();
    const fb = el.parentElement.querySelector('.invalid-feedback');
    let msg = '';

    if (!val) msg = 'Campo requerido';

    if (msg) {
        el.classList.add('is-invalid');
        if (fb) { fb.textContent = msg; fb.classList.remove('d-none'); }
        return false;
    } else {
        el.classList.remove('is-invalid');
        if (fb) fb.classList.add('d-none');
        return true;
    }
}

function campoCabeceraLogicamenteValido(el) {
    const val = (el.value ?? '').trim();
    if (!val) return false;
    const min = parseFloat(el.getAttribute('data-min') || '0');
    if (!Number.isNaN(min) && min > 0 && Number(val) <= 0) return false;
    return true;
}

function camposCabeceraValidos() {
    let ok = true;
    $('#frmCabeceraOC [data-required="true"]').each(function () {
        if (!campoCabeceraLogicamenteValido(this)) { ok = false; return false; }
    });
    return ok;
}

function inicializarValidacionEnVivoCabecera() {
    $('#frmCabeceraOC [data-required="true"]').each(function () {
        const el = this;
        $(el).on('change', function () {
            if (suspendValidacionCabeceraChange) return;
            validarCampoCabeceraIndividual(el);
            if (camposCabeceraValidos())
                $('#alertRequeridos').addClass('d-none');
        });
    });
}

function validarCabeceraOC() {
    let ok = true;
    $('#frmCabeceraOC [data-required="true"]').each(function () {
        if (!validarCampoCabeceraIndividual(this)) ok = false;
    });
    if (!ok) $('#alertRequeridos').removeClass('d-none');
    else $('#alertRequeridos').addClass('d-none');
    return ok;
}

function validarDetalleOC() {
    if (!detalleOC.length) {
        $('#alertDetalle').removeClass('d-none');
        return false;
    }
    $('#alertDetalle').addClass('d-none');
    return true;
}

/* ================== BLOQUEO POR COMPRAS ================== */

function aplicarBloqueoSiCorresponde(cab, detalle, resumenCompras) {

    const tieneCompras =
        Number(cab.CantCompras || 0) > 0 &&
        Number(cab.IdCompraPrimera || 0) > 0;

    window.OC_IdCompraPrimera = Number(cab.IdCompraPrimera || 0);

    OC_ResumenCompras = Array.isArray(resumenCompras) ? resumenCompras : [];
    OC_DetalleOriginal = Array.isArray(detalle) ? detalle : [];

    if (!tieneCompras) {

        OC_BLOQUEADA = false;
        mostrarCartelSinCompras();

        $('#panelDetalleNormal').removeClass('d-none');
        $('#panelComprasOcTarjetas').addClass('d-none');
        $('#btnExportarOcPdf').addClass('d-none');
        return;
    }

    OC_BLOQUEADA = true;

    mostrarCartelConCompras(window.OC_IdCompraPrimera, cab.FechaEntrega);

    $('#btnNuevoModificarOC').addClass('d-none');
    $('#btnAddDetalle').prop('disabled', true).addClass('disabled');
    $('#UnidadesNegocio, #Locales, #Proveedores, #FechaEmision, #FechaEntrega, #NotaInterna').prop('disabled', true);

    const base = OC_ResumenCompras.length ? OC_ResumenCompras : OC_DetalleOriginal;
    renderTarjetasResumen(base);

    $('#panelDetalleNormal').addClass('d-none');
    $('#panelComprasOcTarjetas').removeClass('d-none');
    $('#btnExportarOcPdf').removeClass('d-none');
}


/* Versión “placeholder” conservada para no romper referencias antiguas */
function mostrarPanelResumenCompras(detalleOriginalOC) {
    // ahora no se usa directamente; la lógica está en renderTarjetasResumen
}

/* Helper: muestra/oculta tabla vs tarjetas según OC_BLOQUEADA */
function actualizarVisibilidadPanelDetalle() {
    const panelTabla = document.getElementById('panelDetalleNormal');
    const panelTarjetas = document.getElementById('panelComprasOcTarjetas');
    const btnPDF = document.getElementById('btnExportarOcPdf');

    if (!panelTabla || !panelTarjetas) return;

    if (OC_BLOQUEADA) {
        panelTabla.classList.add('d-none');
        panelTarjetas.classList.remove('d-none');
        if (btnPDF) btnPDF.classList.remove('d-none');
    } else {
        panelTabla.classList.remove('d-none');
        panelTarjetas.classList.add('d-none');
        if (btnPDF) btnPDF.classList.add('d-none');
    }
}

/* ================== CARGA INICIAL DESDE EditarInfo ================== */
async function ObtenerDatosOrdenCompra(id) {
    return await fetchJson(`/OrdenesCompras/EditarInfo?id=${id}`);
}

async function cargarDesdeOrdenCompraData() {
    const duplicarId = typeof kyoQueryInt === 'function' ? kyoQueryInt('duplicar') : 0;
    const raw = duplicarId > 0 ? duplicarId : window.OrdenCompraData;

    let cab = {};
    let detalleServer = [];
    let resumenCompras = [];

    if (typeof raw === 'number' && raw > 0) {
        const resp = await ObtenerDatosOrdenCompra(raw);
        cab = resp.OrdenCompra || resp.ordenCompra || {};
        detalleServer = resp.OrdenesComprasInsumos || resp.ordenesComprasInsumos || [];
        resumenCompras = resp.ResumenCompras || [];
    } else if (raw && typeof raw === 'object') {
        cab = raw.OrdenCompra || raw.ordenCompra || raw;
        detalleServer = raw.OrdenesComprasInsumos || raw.ordenesComprasInsumos || [];
        resumenCompras = raw.ResumenCompras || [];
    }

    const id = _num(cab.Id || 0);

    if (id > 0) {
        $('#IdOC').val(id);
        $('#tituloOC').text(`Editar Orden de Compra #${id}`);
        $('#btnNuevoModificarOC').html(`<i class="fa fa-save me-1"></i> Guardar`);

        const idUN = _num(cab.IdUnidadNegocio);
        const idLocal = _num(cab.IdLocal);
        const idProv = _num(cab.IdProveedor);
        const idEst = _num(cab.IdEstado);

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

        $('#Estados').prop('disabled', true);

        const fechaE = cab.FechaEmision ? new Date(cab.FechaEmision) : null;
        if (fechaE) {
            $('#FechaEmision').val(fechaE.toISOString().split('T')[0]);
        }

        if (cab.FechaEntrega) {
            const fe = new Date(cab.FechaEntrega);
            $('#FechaEntrega').val(fe.toISOString().split('T')[0]);
        }

        $('#NotaInterna').val(cab.NotaInterna || '');
        $('#CostoTotal').val(fmtARS(cab.CostoTotal || 0));

        OC_DetalleOriginal = Array.isArray(detalleServer) ? detalleServer : [];

        detalleOC = detalleServer.map(d => ({
            id: d.Id,
            idInsumo: d.IdInsumo,
            nombreInsumo: d.Nombre || d.Descripcion || '',
            precioUnitario: d.PrecioLista,
            cantidad: d.CantidadPedida,
            subTotal: d.SubTotal || d.Subtotal,
            idProveedorLista: d.IdProveedorLista,
            cantidadEntregada: d.CantidadEntregada,
            cantidadRestante: d.CantidadRestante,
            idEstado: d.IdEstado,
            nota: d.NotaInterna
        }));

        refrescarTablaDetalle();

        aplicarBloqueoSiCorresponde(cab, detalleServer, resumenCompras);

        if (duplicarId > 0) {
            aplicarModoDuplicarOC();
        }

    } else {
        $('#tituloOC').text('Nueva Orden de Compra');
        $('#btnNuevoModificarOC').html(`<i class="fa fa-save me-1"></i> Registrar`);

        const hoy = new Date();
        $('#FechaEmision').val(hoy.toISOString().split('T')[0]);

        if (ESTADO_PENDIENTE_ID != null)
            $('#Estados').val(ESTADO_PENDIENTE_ID);

        $('#Estados').prop('disabled', true);

        OC_BLOQUEADA = false;
        OC_ResumenCompras = [];
        OC_DetalleOriginal = [];

        detalleOC = [];
        refrescarTablaDetalle();
        actualizarVisibilidadPanelDetalle();
    }

    actualizarEstadoBotonDetalle();
}

function aplicarModoDuplicarOC() {
    $('#IdOC').val('');
    $('#tituloOC').text('Duplicar Orden de Compra');
    $('#btnNuevoModificarOC').html(`<i class="fa fa-save me-1"></i> Registrar`);
    $('#btnNuevoModificarOC').removeClass('d-none');

    OC_BLOQUEADA = false;
    OC_ResumenCompras = [];
    OC_DetalleOriginal = [];

    if (ESTADO_PENDIENTE_ID != null) {
        $('#Estados').val(ESTADO_PENDIENTE_ID).trigger('change');
    }
    $('#Estados').prop('disabled', true);

    const hoy = new Date();
    $('#FechaEmision').val(hoy.toISOString().split('T')[0]);

    detalleOC = detalleOC.map(d => ({
        ...d,
        id: 0,
        cantidadEntregada: 0,
        cantidadRestante: _num(d.cantidad),
        idEstado: ESTADO_PENDIENTE_ID
    }));

    refrescarTablaDetalle();
    actualizarVisibilidadPanelDetalle();
    actualizarEstadoBotonDetalle();
}

/* ================== GUARDAR (Insertar / Actualizar) ================== */
async function guardarOC() {
    if (OC_BLOQUEADA) return;
    if (!validarCabeceraOC()) return;
    if (!validarDetalleOC()) return;

    return withBusy("#btnNuevoModificarOC", async () => {
        try {
            const id = Number($('#IdOC').val() || 0);
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
                    Id: d.id,
                    IdOrdenCompra: id,
                    IdInsumo: d.idInsumo,
                    IdProveedorLista: d.idProveedorLista,
                    CantidadPedida: d.cantidad,
                    CantidadEntregada: d.cantidadEntregada,
                    CantidadRestante: d.cantidadRestante,
                    PrecioLista: d.precioUnitario,
                    Subtotal: d.subTotal,
                    IdEstado: d.idEstado,
                    NotaInterna: d.nota
                }))
            };

            const url = id === 0 ? "/OrdenesCompras/Insertar" : "/OrdenesCompras/Actualizar";
            const method = id === 0 ? "POST" : "PUT";

            const r = await fetch(url, {
                method,
                headers: authHeaders({ 'Content-Type': 'application/json;charset=utf-8' }),
                body: JSON.stringify(modelo)
            });

            if (!r.ok) throw new Error(await r.text());
            const j = await r.json();

            if (j.valor === false) {
                advertenciaModal?.(j.mensaje || 'No se pudo guardar');
                return;
            }

            exitoModal?.(j.mensaje || 'Guardado correctamente');
            window.location.href = "/OrdenesCompras";

        } catch (e) {
            console.error('Error guardando OC:', e);
            errorModal?.('Error al guardar la orden de compra.');
        }
    });
}

/* ================== TARJETAS RESUMEN + PDF ================== */

function obtenerEstadoNombreYClase(d) {
    const idEstado = _num(d.IdEstado ?? d.idEstado ?? d.IdEstadoOcInsumo ?? d.idEstadoOcInsumo ?? 0);
    const nombre = d.Estado || d.estado || d.EstadoOcNombre || d.estadoOcNombre ||
        (idEstado === 1 ? 'Pendiente' :
            idEstado === 2 ? 'Entregado' :
                idEstado === 3 ? 'Incompleto' : 'Sin estado');

    let clase = 'oc-badge-estado--default';
    if (idEstado === 1) clase = 'oc-badge-estado--pendiente';
    else if (idEstado === 2) clase = 'oc-badge-estado--entregado';
    else if (idEstado === 3) clase = 'oc-badge-estado--incompleto';

    return { nombre, clase };
}

function renderTarjetasResumen(detalleBase) {
    const panel = document.getElementById("panelComprasOcTarjetas");
    const grid = document.getElementById("ocResumenGrid");
    if (!panel || !grid) return;

    // Preferimos siempre ResumenCompras si existe
    const data = (Array.isArray(OC_ResumenCompras) && OC_ResumenCompras.length)
        ? OC_ResumenCompras
        : (Array.isArray(detalleBase) ? detalleBase : []);

    grid.innerHTML = "";

    if (!data.length) {
        grid.innerHTML = `<div class="oc-empty">No hay información de compras asociadas.</div>`;
        return;
    }

    data.forEach(d => {
        const nombre = d.Nombre || d.Descripcion || d.nombreInsumo || d.InsumoNombre || 'Insumo';
        const idInsumo = d.IdInsumo ?? d.idInsumo ?? d.Sku ?? d.sku ?? '-';

        // CANTIDADES
        const cantPedida =
            _num(d.CantidadPedida ?? d.CantidadPedidaOc ?? d.CantidadOc ?? d.cantidad ?? 0);
        const cantEnt =
            _num(d.CantidadEntregada ?? d.CantidadEntregadaOc ?? d.CantidadRecibida ?? d.cantidadEntregada ?? 0);
        const cantRest =
            _num(d.CantidadRestante ?? d.CantidadPendienteOc ?? d.cantidadRestante ?? (cantPedida - cantEnt));

        // PRECIOS ORDEN / COMPRA
        const precioOrden =
            _num(d.PrecioLista ?? d.PrecioOrden ?? d.precioUnitario ?? d.precioOrden ?? 0);

        const precioCompra =
            _num(d.PrecioCompra ?? d.PrecioFactura ?? d.PrecioFinal ?? d.precioCompra ?? d.precioFactura ?? d.precioFinal ?? precioOrden);

        const subtotalOrden =
            _num(d.SubTotalOrden ?? d.SubTotalOc ?? d.SubTotal ?? d.Subtotal ?? d.subTotal ?? (precioOrden * cantPedida));

        const subtotalCompra =
            _num(
                d.SubTotalCompra ?? d.SubtotalCompra ??
                d.SubtotalFinal ?? d.SubtotalConDescuento ??
                d.subTotalCompra ?? d.subtotalFinal ?? (precioCompra * cantEnt)
            );

        // DIFERENCIAS (Orden - Compra) => positivo = ahorraste, negativo = pagaste más
        const difPrecio = precioOrden - precioCompra;
        const difSubtotal = subtotalOrden - subtotalCompra;

        const difPrecioClass =
            difPrecio > 0 ? 'oc-dif-pos' :
                difPrecio < 0 ? 'oc-dif-neg' : '';

        const difSubClass =
            difSubtotal > 0 ? 'oc-dif-pos' :
                difSubtotal < 0 ? 'oc-dif-neg' : '';

        const est = obtenerEstadoNombreYClase(d);

        const card = document.createElement("article");
        card.className = "oc-card-item";

        card.innerHTML = `
            <header class="oc-card-header">
                <div class="oc-card-icon">
                    <i class="fa fa-cube"></i>
                </div>
                <div class="oc-card-main">
                    <div class="oc-card-title-row">
                        <h4 class="oc-card-title">${nombre}</h4>
                        <span class="oc-badge-estado ${est.clase}">${est.nombre}</span>
                    </div>
                    <div class="oc-card-sub">
                        ID: ${idInsumo}
                    </div>
                </div>
            </header>

            <div class="oc-card-body">
                <div class="oc-row">
                    <div class="oc-col">
                        <span class="oc-label">Pedida</span>
                        <span class="oc-value">${fmtDec(cantPedida)}</span>
                    </div>
                    <div class="oc-col">
                        <span class="oc-label">Entregada</span>
                        <span class="oc-value">${fmtDec(cantEnt)}</span>
                    </div>
                    <div class="oc-col">
                        <span class="oc-label">Restante</span>
                        <span class="oc-value oc-restante">${fmtDec(cantRest)}</span>
                    </div>
                </div>

                <div class="oc-row oc-row-prices">
                    <div class="oc-col">
                        <span class="oc-label">Precio Orden</span>
                        <span class="oc-value">${fmtARS(precioOrden)}</span>
                        <span class="oc-label mt-1">Subtotal Orden</span>
                        <span class="oc-value-small">${fmtARS(subtotalOrden)}</span>
                    </div>
                    <div class="oc-col">
                        <span class="oc-label">Precio Compra</span>
                        <span class="oc-value">${fmtARS(precioCompra)}</span>
                        <span class="oc-label mt-1">Subtotal Compra</span>
                        <span class="oc-value-small">${fmtARS(subtotalCompra)}</span>
                    </div>
                    <div class="oc-col">
                        <span class="oc-label">Dif. Precio (Orden - Compra)</span>
                        <span class="oc-value ${difPrecioClass}">${fmtARS(difPrecio)}</span>
                        <span class="oc-label mt-1">Dif. Subtotal</span>
                        <span class="oc-value-small ${difSubClass}">${fmtARS(difSubtotal)}</span>
                    </div>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });

    panel.classList.remove("d-none");
}

/* ================== EXPORTAR PDF ================== */

document.addEventListener("click", e => {
    if (e.target.closest("#btnExportarOcPdf")) {
        exportarOcPdf();
    }
});

function exportarOcPdf() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        errorModal("No se encontró jsPDF.");
        return;
    }

    const doc = new jsPDF("p", "pt", "a4");

    const idOC = $("#IdOC").val();
    const proveedor = $("#Proveedores option:selected").text() || "-";
    const un = $("#UnidadesNegocio option:selected").text() || "-";
    const local = $("#Locales option:selected").text() || "-";
    const fecha = $("#FechaEmision").val() || "-";
    const nota = $("#NotaInterna").val() || "-";

    // Encabezado
    doc.setFontSize(22);
    doc.text(`Orden de Compra #${idOC}`, 40, 40);

    doc.setFontSize(12);
    doc.text(`Proveedor: ${proveedor}`, 40, 70);
    doc.text(`Unidad de Negocio: ${un}`, 40, 90);
    doc.text(`Local: ${local}`, 40, 110);
    doc.text(`Fecha Emisión: ${fecha}`, 40, 130);
    doc.text(`Nota Interna: ${nota}`, 40, 150);

    // Fuente de detalle para el PDF:
    const base = (Array.isArray(OC_ResumenCompras) && OC_ResumenCompras.length)
        ? OC_ResumenCompras
        : ((OC_BLOQUEADA ? OC_DetalleOriginal : detalleOC) || []);

    const rows = base.map(d => {
        const nombre = d.Nombre || d.Descripcion || d.nombreInsumo || d.InsumoNombre || 'Insumo';

        const cantPedida =
            _num(d.CantidadPedida ?? d.CantidadPedidaOc ?? d.CantidadOc ?? d.cantidad ?? 0);
        const cantEnt =
            _num(d.CantidadEntregada ?? d.CantidadEntregadaOc ?? d.CantidadRecibida ?? d.cantidadEntregada ?? 0);
        const cantRest =
            _num(d.CantidadRestante ?? d.CantidadPendienteOc ?? d.cantidadRestante ?? (cantPedida - cantEnt));

        const precioOrden =
            _num(d.PrecioLista ?? d.PrecioOrden ?? d.precioUnitario ?? d.precioOrden ?? 0);

        const precioCompra =
            _num(d.PrecioCompra ?? d.PrecioFactura ?? d.PrecioFinal ?? d.precioCompra ?? d.precioFactura ?? d.precioFinal ?? precioOrden);

        const subtotalOrden =
            _num(d.SubTotalOrden ?? d.SubTotalOc ?? d.SubTotal ?? d.Subtotal ?? d.subTotal ?? (precioOrden * cantPedida));

        const subtotalCompra =
            _num(
                d.SubTotalCompra ?? d.SubtotalCompra ??
                d.SubtotalFinal ?? d.SubtotalConDescuento ??
                d.subTotalCompra ?? d.subtotalFinal ?? (precioCompra * cantEnt)
            );

        return [
            nombre,
            fmtDec(cantPedida),
            fmtDec(cantEnt),
            fmtDec(cantRest),
            fmtARS(precioOrden),
            fmtARS(precioCompra),
            fmtARS(subtotalOrden),
            fmtARS(subtotalCompra)
        ];
    });

    doc.autoTable({
        head: [["Insumo", "Pedida", "Entregada", "Restante", "Precio Ord.", "Precio Comp.", "Subt. Ord.", "Subt. Comp."]],
        body: rows,
        startY: 180,
        theme: "striped",
        headStyles: { fillColor: [76, 141, 255] },
        styles: { fontSize: 9 }
    });

    doc.save(`OC_${idOC}.pdf`);
}

/********************  FIN COMPLETO OrdenesComprasNuevoModif.js  ********************/


function mostrarCartelSinCompras() {
    $('#ocAlertSinCompras').removeClass('d-none');
    $('#ocAlertConCompras').addClass('d-none');
}

function mostrarCartelConCompras(idCompra, fechaEntrega) {

    $('#ocAlertSinCompras').addClass('d-none');
    $('#ocAlertConCompras').removeClass('d-none');

    const fechaTxt = fechaEntrega
        ? new Date(fechaEntrega).toLocaleDateString('es-AR')
        : 'sin fecha';

    $('#ocBannerCompraTexto').html(`
        Orden de compra entregada el día 
        <strong>${fechaTxt}</strong>, en la 
        <button type="button" class="btn btn-link p-0" onclick="irACompraDesdeOC()">
            Compra #${idCompra}
        </button>
    `);
}


function irACompraDesdeOC() {
    if (!window.OC_IdCompraPrimera) return;
    window.location.href = `/Compras/NuevoModif/${window.OC_IdCompraPrimera}`;
}
