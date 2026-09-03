/* ============================================================================
 * ProveedoresGestion.js — Hub de gestión por proveedor
 * ============================================================================ */

let pgGridPrecios = null;
let pgGridCc = null;
let pgGridCompras = null;
let pgGridOc = null;
let pgCompraDetalle = [];
let pgCompraOcList = [];
let pgOcDetalle = [];
let pgOcEstadoPendienteId = null;
const pgTabsLoaded = { precios: false, cc: false, ordenes: false, compras: false, pagos: false, analisis: false };
let pgAxCharts = {};

const pgToken = () => localStorage.getItem('JwtToken') || (typeof token !== 'undefined' ? token : '');

function pgAuthHeaders(extra = {}) {
    const t = pgToken();
    return t
        ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json', ...extra }
        : { 'Content-Type': 'application/json', ...extra };
}

async function pgFetchJson(url, options = {}) {
    const res = await fetch(url, { ...options, headers: pgAuthHeaders(options.headers || {}) });
    if (!res.ok) {
        let msg = res.statusText;
        try { const j = await res.json(); msg = j?.mensaje || j?.detail || msg; } catch { /* ignore */ }
        throw new Error(msg);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
}

function pgSelect2Parent(el) {
    const modal = el?.closest('.modal');
    return modal && window.jQuery ? $(modal) : (window.jQuery ? $(document.body) : null);
}

function pgRefreshSelect2(el, extraOpts = {}) {
    if (!el || !window.jQuery || !$.fn.select2) return;
    const $el = $(el);
    if ($el.data('select2')) $el.select2('destroy');

    const placeholderOpt = el.querySelector('option[value=""]');
    const placeholder = placeholderOpt?.textContent?.trim() || 'Seleccionar…';

    if (window.KyoSelect2?.init) {
        KyoSelect2.init(el, {
            allowClear: true,
            placeholder,
            dropdownParent: pgSelect2Parent(el),
            ...extraOpts
        });
        return;
    }

    $el.select2({
        width: '100%',
        allowClear: true,
        placeholder,
        dropdownParent: pgSelect2Parent(el),
        language: {
            noResults: () => 'Sin resultados',
            searching: () => 'Buscando…'
        },
        ...extraOpts
    });
}

function pgSetSelect2Value(el, value) {
    if (!el) return;
    el.value = value == null || value === '' ? '' : String(value);
    if (window.jQuery && $(el).data('select2')) {
        $(el).val(el.value || null).trigger('change.select2');
    } else {
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

const pgFmtMoney = v => {
    const n = Number(v ?? 0);
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);
};

const pgFmtDate = v => {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString('es-AR'); }
    catch { return String(v); }
};

const pgFmtDateTime = v => {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return String(v); }
};

const pgEscHtml = s => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function pgGetId() {
    return Number(document.getElementById('pgId')?.value || 0);
}

function pgSetId(id) {
    const el = document.getElementById('pgId');
    if (el) el.value = String(id);
}

/* ===================== Init ===================== */
$(document).ready(function () {
    pgInitTabs();
    pgActualizarTabsSecundarios();

    const duplicarId = typeof kyoQueryInt === 'function' ? kyoQueryInt('duplicar') : 0;
    const id = pgGetId();
    if (duplicarId > 0) {
        pgCargarProveedorComoCopia(duplicarId);
    } else if (id > 0) {
        pgCargarProveedor(id);
    } else {
        document.getElementById('pgTitulo').textContent = 'Nuevo Proveedor';
    }

    // Fecha default en pagos
    const hoy = new Date().toISOString().slice(0, 10);
    const pgPagoFecha = document.getElementById('pgPagoFecha');
    if (pgPagoFecha && !pgPagoFecha.value) pgPagoFecha.value = hoy;

    document.getElementById('pgNombre')?.addEventListener('input', pgValidarNombre);
    pgInitInsumoModalCalc();
    pgInitCompraModal();
    pgInitOcModal();
});

function pgInitTabs() {
    document.querySelectorAll('#pgTabs button[data-pg-tab]').forEach(btn => {
        btn.addEventListener('show.bs.tab', function (e) {
            if (pgGetId() <= 0) {
                e.preventDefault();
                advertenciaModal('Guarde el proveedor antes de acceder a esta sección.');
                return;
            }
            const tab = btn.getAttribute('data-pg-tab');
            pgLazyLoadTab(tab);
        });
    });
}

function pgActualizarTabsSecundarios() {
    const habilitado = pgGetId() > 0;
    document.querySelectorAll('.pg-tab-secondary').forEach(btn => {
        btn.classList.toggle('disabled', !habilitado);
        btn.toggleAttribute('disabled', !habilitado);
    });
}

function pgLazyLoadTab(tab) {
    if (pgTabsLoaded[tab]) return;
    switch (tab) {
        case 'precios': pgCargarListaPrecios(); break;
        case 'cc': pgCargarCuentaCorriente(); break;
        case 'ordenes': pgCargarOrdenesCompra(); break;
        case 'compras': pgCargarCompras(); break;
        case 'pagos': pgInitPagosPanel(); break;
        case 'analisis': pgCargarAnalisisProveedor(); break;
    }
}

/* ===================== CRUD Datos ===================== */
async function pgCargarProveedor(id) {
    try {
        const data = await pgFetchJson(`/Proveedores/EditarInfo?id=${id}`);
        pgSetId(data.Id);
        pgActualizarTabsSecundarios();

        document.getElementById('pgNombre').value = data.Nombre || '';
        document.getElementById('pgApodo').value = data.Apodo || '';
        document.getElementById('pgUbicacion').value = data.Ubicacion || '';
        document.getElementById('pgTelefono').value = data.Telefono || '';
        document.getElementById('pgCbu').value = data.Cbu || '';
        document.getElementById('pgCuit').value = data.Cuit || '';

        document.getElementById('pgTitulo').textContent = data.Nombre || 'Editar Proveedor';
        setInfoAuditoria(data);
        const btnAnalisis = document.getElementById('pgBtnAnalisis');
        if (btnAnalisis) {
            btnAnalisis.classList.remove('d-none');
            btnAnalisis.href = `#tab-analisis`;
            btnAnalisis.onclick = function (e) {
                e.preventDefault();
                const tabBtn = document.getElementById('tab-analisis-btn');
                if (tabBtn && window.bootstrap?.Tab) {
                    bootstrap.Tab.getOrCreateInstance(tabBtn).show();
                } else {
                    tabBtn?.click();
                }
            };
        }
        pgCargarResumen(id);
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar el proveedor.');
    }
}

async function pgCargarProveedorComoCopia(idOrigen) {
    try {
        const data = await pgFetchJson(`/Proveedores/EditarInfo?id=${idOrigen}`);
        pgSetId(0);
        pgActualizarTabsSecundarios();

        document.getElementById('pgNombre').value = typeof kyoTextoCopia === 'function'
            ? kyoTextoCopia(data.Nombre)
            : `${(data.Nombre || '').trim()} (copia)`.trim();
        document.getElementById('pgApodo').value = data.Apodo || '';
        document.getElementById('pgUbicacion').value = data.Ubicacion || '';
        document.getElementById('pgTelefono').value = data.Telefono || '';
        document.getElementById('pgCbu').value = data.Cbu || '';
        // CUIT vacío para no chocar con BuscarDuplicado
        document.getElementById('pgCuit').value = '';

        document.getElementById('pgTitulo').textContent = 'Duplicar Proveedor';
        const btnAnalisis = document.getElementById('pgBtnAnalisis');
        if (btnAnalisis) btnAnalisis.classList.add('d-none');

        try { history.replaceState(null, '', '/Proveedores/Gestion?id=0'); } catch { /* ignore */ }
    } catch (err) {
        console.error(err);
        errorModal('No se pudo duplicar el proveedor.');
    }
}

function pgValidarNombre() {
    const el = document.getElementById('pgNombre');
    const ok = el.value.trim() !== '';
    el.classList.toggle('is-invalid', !ok);
    el.classList.toggle('is-valid', ok);
    return ok;
}

function pgValidarFormulario() {
    const ok = pgValidarNombre();
    document.getElementById('pgErrorCampos')?.classList.toggle('d-none', ok);
    return ok;
}

async function pgGuardarProveedor() {
    if (!pgValidarFormulario()) return;

    return withBusy("#btnGuardarProveedor", async () => {
        const id = pgGetId();
        const payload = {
            Id: id,
            Nombre: document.getElementById('pgNombre').value.trim(),
            Apodo: document.getElementById('pgApodo').value.trim(),
            Ubicacion: document.getElementById('pgUbicacion').value.trim(),
            Telefono: document.getElementById('pgTelefono').value.trim(),
            Cbu: document.getElementById('pgCbu').value.trim(),
            Cuit: document.getElementById('pgCuit').value.trim()
        };

        const url = id === 0 ? '/Proveedores/Insertar' : '/Proveedores/Actualizar';
        const method = id === 0 ? 'POST' : 'PUT';

        try {
            const data = await pgFetchJson(url, { method, body: JSON.stringify(payload) });
            const resp = interpretarRespuestaApi(data);

            if (resp.tipo === 'duplicado') {
                mostrarErrorDuplicado(resp.mensaje, resp.idReferencia, `/Proveedores/Gestion?id=${resp.idReferencia}`);
                return;
            }

            if (!resp.valor) {
                errorModal(resp.mensaje || 'No se pudo completar la operación.');
                return;
            }

            const eraNuevo = id === 0;

            if (eraNuevo) {
                const nuevoId = await pgResolverIdNuevo(payload.Nombre, payload.Cuit);
                if (nuevoId) {
                    pgSetId(nuevoId);
                    pgActualizarTabsSecundarios();
                    history.replaceState(null, '', `/Proveedores/Gestion?id=${nuevoId}`);
                    await pgCargarProveedor(nuevoId);
                }
            } else {
                await pgCargarProveedor(id);
            }

            const accion = await kyoDespuesGuardar({
                titulo: eraNuevo ? 'Proveedor registrado' : 'Proveedor actualizado',
                mensaje: '¿Qué querés hacer ahora?',
                labelListado: 'Ir a la pantalla principal',
                subListado: 'Volver al listado de proveedores',
                labelEditar: 'Seguir editando',
                subEditar: 'Continuar en esta ficha'
            });

            if (accion === 'listado') {
                window.location.href = '/Proveedores/Index';
            }
        } catch (err) {
            console.error(err);
            errorModal('Ha ocurrido un error al guardar.');
        }
    });
}

async function pgResolverIdNuevo(nombre, cuit) {
    try {
        const lista = await pgFetchJson('/Proveedores/Lista');
        const match = (lista || []).find(p =>
            String(p.Nombre || '').trim().toLowerCase() === nombre.toLowerCase() ||
            (cuit && String(p.Cuit || '').trim() === cuit)
        );
        return match?.Id ?? null;
    } catch { return null; }
}

async function pgCargarResumen(id) {
    const row = document.getElementById('pgResumenRow');
    if (!row || id <= 0) return;
    row.classList.remove('d-none');

    try {
        const [precios, compras, resumen] = await Promise.all([
            pgFetchJson(`/ProveedoresInsumos/Lista?IdProveedor=${id}`).catch(() => []),
            pgFetchJson(`/Compras/Lista?IdProveedor=${id}`).catch(() => []),
            pgFetchJson(`/ProveedoresCuentaCorriente/Resumen?idProveedor=${id}`).catch(() => null)
        ]);

        const setKpi = (elId, val) => {
            const el = document.getElementById(elId);
            if (el) el.textContent = val ?? '—';
        };

        const listaPrecios = Array.isArray(precios) ? precios : [];
        const listaCompras = Array.isArray(compras) ? compras : [];

        setKpi('pgKpiInsumos', listaPrecios.length);
        setKpi('pgKpiCompras', listaCompras.length);
        setKpi('pgKpiSaldo', resumen ? pgFmtMoney(resumen.SaldoActual) : '—');

        const totalComprado = listaCompras.reduce((s, c) => s + Number(c.SubtotalFinal ?? c.Subtotal ?? 0), 0);
        setKpi('pgKpiTotalComprado', pgFmtMoney(totalComprado));

        let ultFecha = null;
        listaPrecios.forEach(p => {
            const f = p.FechaActualizacion ? new Date(p.FechaActualizacion) : null;
            if (f && (!ultFecha || f > ultFecha)) ultFecha = f;
        });
        setKpi('pgKpiUltPrecio', ultFecha ? pgFmtDate(ultFecha) : '—');

        pgTogglePreciosEmpty(listaPrecios);
        pgActualizarPreciosCount(listaPrecios.length);
        pgActualizarComprasCount(listaCompras.length);
        pgToggleComprasEmpty(listaCompras);
    } catch (err) {
        console.warn('Resumen proveedor:', err);
    }
}

/* ===================== Lista de precios ===================== */
async function pgCargarListaPrecios() {
    const id = pgGetId();
    if (id <= 0) return;

    try {
        const data = await pgFetchJson(`/ProveedoresInsumos/Lista?IdProveedor=${id}`);
        pgTabsLoaded.precios = true;
        pgConfigGridPrecios(data || []);
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar la lista de precios.');
    }
}

function pgActualizarPreciosCount(count) {
    const el = document.getElementById('pgPreciosCount');
    if (el) el.textContent = `${count ?? 0} ítem${count === 1 ? '' : 's'}`;
}

function pgTogglePreciosEmpty(data) {
    const empty = document.getElementById('pgPreciosEmpty');
    const wrap = document.getElementById('pgPreciosTableWrap');
    const hasData = Array.isArray(data) && data.length > 0;
    if (empty) empty.classList.toggle('d-none', hasData);
    if (wrap) wrap.classList.toggle('pg-precios-has-data', hasData);
}

function pgConfigGridPrecios(data) {
    pgTogglePreciosEmpty(data);
    pgActualizarPreciosCount(data?.length ?? 0);

    const cols = [
        columnaGridAcciones({ editar: 'pgEditarInsumo', eliminar: 'pgEliminarInsumo' }, 'PreciosProveedor'),
        columnaGridId(),
        { data: 'Codigo', defaultContent: '' },
        { data: 'Descripcion' },
        { data: 'CostoUnitario', render: (d, t) => t === 'display' ? pgFmtMoney(d) : d },
        { data: 'Cantidad', render: (d, t) => t === 'display' ? (d ?? '—') : d },
        { data: 'Costo', render: (d, t) => t === 'display' ? pgFmtMoney(d) : d },
        { data: 'FechaActualizacion', render: (d, t) => t === 'display' ? pgFmtDate(d) : d }
    ];

    if (!pgGridPrecios) {
        kyoEnsureFilterRow('#grd_PreciosProveedor');
        pgGridPrecios = $('#grd_PreciosProveedor').DataTable({
            data,
            language: { url: '//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json' },
            autoWidth: true,
            responsive: true,
            columns: cols,
            order: [[3, 'asc']],
            pageLength: 25,
            dom: 'frtip',
            orderCellsTop: true,
            columnDefs: columnDefsGridLista(),
            initComplete: async function () {
                await kyoBindColumnFilters(this.api(), {
                    columns: [
                        { index: 1, filterType: 'text', placeholder: 'Id…' },
                        { index: 2, filterType: 'text', placeholder: 'Código…' },
                        { index: 3, filterType: 'text', placeholder: 'Descripción…' },
                        { index: 4, filterType: 'text', placeholder: 'Unitario…' },
                        { index: 5, filterType: 'text', placeholder: 'Cant…' },
                        { index: 6, filterType: 'text', placeholder: 'Costo…' },
                        { index: 7, filterType: 'text', placeholder: 'Fecha…' }
                    ],
                    skipIndexes: [0]
                });
            }
        });
    } else {
        pgGridPrecios.clear().rows.add(data).draw();
    }
}

/* ===================== Modal insumo (CRUD inline) ===================== */
function pgInitInsumoModalCalc() {
    ['pgInsCosto', 'pgInsCantidad', 'pgInsPorcDesc'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', pgRecalcularCostoUnitarioInsumo);
    });
}

function pgRecalcularCostoUnitarioInsumo() {
    const costo = formatearSinMiles(document.getElementById('pgInsCosto')?.value);
    let cant = formatearSinMiles(document.getElementById('pgInsCantidad')?.value);
    let porc = formatearSinMiles(document.getElementById('pgInsPorcDesc')?.value);
    if (isNaN(cant) || cant <= 0) cant = 1;
    if (isNaN(porc) || porc < 0) porc = 0;
    if (porc > 100) porc = 100;

    const out = document.getElementById('pgInsCostoUnitario');
    if (!out) return;

    if (isNaN(costo)) {
        out.value = '';
        return;
    }

    const unitarioBase = costo / cant;
    const unitario = unitarioBase * (1 - porc / 100);
    out.value = isNaN(unitario) ? '' : formatNumeroAR(unitario, 2);
}

function pgLimpiarModalInsumo() {
    const ids = ['pgInsId', 'pgInsCodigo', 'pgInsDescripcion', 'pgInsCosto', 'pgInsCostoUnitario', 'pgInsUltimaModif'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const cant = document.getElementById('pgInsCantidad');
    const desc = document.getElementById('pgInsPorcDesc');
    if (cant) cant.value = '1';
    if (desc) desc.value = '0';

    document.querySelectorAll('#pgFormInsumo .is-invalid, #pgFormInsumo .is-valid').forEach(el => {
        el.classList.remove('is-invalid', 'is-valid');
    });
    document.getElementById('pgInsErrorCampos')?.classList.add('d-none');
}

function pgSetInsumoAuditoria(modelo) {
    setInfoAuditoria(modelo, 'pgInsUltimaModif');
}

function pgAbrirModalInsumo() {
    const idProv = pgGetId();
    if (idProv <= 0) {
        advertenciaModal('Guarde el proveedor antes de agregar insumos.');
        return;
    }

    pgLimpiarModalInsumo();
    pgSetInsumoAuditoria(null);

    const nombre = document.getElementById('pgNombre')?.value?.trim()
        || document.getElementById('pgTitulo')?.textContent?.trim()
        || 'Proveedor';
    const nombreEl = document.getElementById('pgInsProveedorNombre');
    if (nombreEl) nombreEl.textContent = nombre;

    document.getElementById('pgModalInsumoLabel').textContent = 'Nuevo insumo';
    const btn = document.getElementById('pgBtnGuardarInsumo');
    if (btn) btn.innerHTML = '<i class="fa fa-check me-1"></i> Registrar';

    pgRecalcularCostoUnitarioInsumo();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalInsumo')).show();
}

async function pgEditarInsumo(id) {
    try {
        const data = await pgFetchJson(`/ProveedoresInsumos/EditarInfo?id=${id}`);
        if (!data) throw new Error('Sin datos');

        pgLimpiarModalInsumo();
        pgSetInsumoAuditoria(data);

        document.getElementById('pgInsId').value = data.Id ?? '';
        document.getElementById('pgInsCodigo').value = data.Codigo ?? '';
        document.getElementById('pgInsDescripcion').value = data.Descripcion ?? '';
        document.getElementById('pgInsCosto').value = data.Costo != null ? formatNumeroAR(data.Costo, 2) : '';
        document.getElementById('pgInsCantidad').value = data.Cantidad != null ? formatNumeroAR(data.Cantidad, 2) : '1';
        document.getElementById('pgInsPorcDesc').value = data.PorcDesc != null ? formatNumeroAR(data.PorcDesc, 2) : '0';

        const nombreEl = document.getElementById('pgInsProveedorNombre');
        if (nombreEl) nombreEl.textContent = document.getElementById('pgNombre')?.value?.trim() || 'Proveedor';

        pgRecalcularCostoUnitarioInsumo();

        document.getElementById('pgModalInsumoLabel').textContent = 'Editar insumo';
        const btn = document.getElementById('pgBtnGuardarInsumo');
        if (btn) btn.innerHTML = '<i class="fa fa-check me-1"></i> Guardar';

        bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalInsumo')).show();
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar el insumo.');
    }
}

function pgValidarModalInsumo() {
    const desc = document.getElementById('pgInsDescripcion');
    const costo = document.getElementById('pgInsCosto');
    const cant = document.getElementById('pgInsCantidad');
    let ok = true;

    const mark = (el, valid) => {
        if (!el) return;
        el.classList.toggle('is-invalid', !valid);
        el.classList.toggle('is-valid', valid);
        if (!valid) ok = false;
    };

    mark(desc, (desc?.value ?? '').trim() !== '');
    const costoN = formatearSinMiles(costo?.value);
    mark(costo, !isNaN(costoN) && costoN > 0);
    const cantN = formatearSinMiles(cant?.value);
    mark(cant, !isNaN(cantN) && cantN > 0);

    document.getElementById('pgInsErrorCampos')?.classList.toggle('d-none', ok);
    return ok;
}

async function pgGuardarInsumo() {
    if (!pgValidarModalInsumo()) return;

    return withBusy("#pgBtnGuardarInsumo", async () => {
        const idProv = pgGetId();
        const idInsumo = document.getElementById('pgInsId')?.value ?? '';
        const costo = formatearSinMiles(document.getElementById('pgInsCosto')?.value);
        const cantidad = formatearSinMiles(document.getElementById('pgInsCantidad')?.value);
        const porcDesc = formatearSinMiles(document.getElementById('pgInsPorcDesc')?.value);
        const porc = isNaN(porcDesc) ? 0 : Math.max(0, porcDesc);
        const cantOk = (isNaN(cantidad) || cantidad <= 0) ? 1 : cantidad;

        const unitarioBase = (!isNaN(costo) && cantOk !== 0) ? (costo / cantOk) : NaN;
        const unitario = isNaN(unitarioBase) ? 0 : (unitarioBase * (1 - porc / 100));

        const payload = {
            Id: idInsumo !== '' ? parseInt(idInsumo, 10) : 0,
            Codigo: document.getElementById('pgInsCodigo')?.value ?? '',
            Descripcion: document.getElementById('pgInsDescripcion')?.value?.trim(),
            Costo: isNaN(costo) ? 0 : +costo.toFixed(2),
            Cantidad: +cantOk.toFixed(4),
            PorcDesc: +porc.toFixed(2),
            CostoUnitario: isNaN(unitario) ? 0 : +unitario.toFixed(4),
            IdProveedor: idProv
        };

        const isNew = idInsumo === '';
        const url = isNew ? '/ProveedoresInsumos/Insertar' : '/ProveedoresInsumos/Actualizar';
        const method = isNew ? 'POST' : 'PUT';

        try {
            const data = await pgFetchJson(url, { method, body: JSON.stringify(payload) });
            const resp = interpretarRespuestaApi(data);

            if (!resp.valor) {
                errorModal(resp.mensaje || 'No se pudo guardar el insumo.');
                return;
            }

            bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalInsumo')).hide();
            exitoModal(isNew ? 'Insumo registrado correctamente.' : 'Insumo modificado correctamente.');
            await pgCargarListaPrecios();
            await pgCargarResumen(idProv);
        } catch (err) {
            console.error(err);
            errorModal('Ha ocurrido un error al guardar el insumo.');
        }
    });
}

async function pgEliminarInsumo(id) {
    return eliminarConCascada({
        url: '/ProveedoresInsumos/Eliminar',
        id,
        confirmMsg: '¿Desea eliminar este insumo de la lista de precios?',
        headers: () => {
            const t = (typeof token !== 'undefined' && token) ? token : (localStorage.getItem('JwtToken') || '');
            return t ? { 'Authorization': 'Bearer ' + t } : {};
        },
        onSuccess: async (j) => {
            exitoModal(j.mensaje || 'Insumo eliminado correctamente.');
            await pgCargarListaPrecios();
            await pgCargarResumen(pgGetId());
        }
    });
}

/* ===================== Cuenta corriente ===================== */
async function pgCargarCuentaCorriente() {
    const id = pgGetId();
    if (id <= 0) return;

    const params = new URLSearchParams({ idProveedor: id });
    const fd = document.getElementById('pgCcFechaDesde')?.value;
    const fh = document.getElementById('pgCcFechaHasta')?.value;
    const tipo = document.getElementById('pgCcTipoMov')?.value;
    if (fd) params.set('fechaDesde', fd);
    if (fh) params.set('fechaHasta', fh);
    if (tipo) params.set('tipoMov', tipo);

    try {
        const [movs, resumen] = await Promise.all([
            pgFetchJson(`/ProveedoresCuentaCorriente/Movimientos?${params}`),
            pgFetchJson(`/ProveedoresCuentaCorriente/Resumen?${params}`)
        ]);

        pgTabsLoaded.cc = true;
        pgActualizarKpiCc(resumen);
        pgConfigGridCc(movs || []);
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar la cuenta corriente.');
    }
}

function pgActualizarKpiCc(r) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = pgFmtMoney(val); };
    set('pgCcSaldoAnterior', r?.SaldoAnterior);
    set('pgCcDebe', r?.Debe);
    set('pgCcHaber', r?.Haber);
    set('pgCcSaldoActual', r?.SaldoActual);
}

function pgCcConSaldoAcumulado(rows) {
    const list = Array.isArray(rows) ? rows.slice() : [];
    list.sort((a, b) => {
        const da = new Date(a.Fecha || 0).getTime();
        const db = new Date(b.Fecha || 0).getTime();
        if (da !== db) return da - db;
        return Number(a.Id || 0) - Number(b.Id || 0);
    });
    let saldo = 0;
    return list.map(m => {
        saldo += Number(m.Debe || 0) - Number(m.Haber || 0);
        return { ...m, Saldo: saldo };
    });
}

function pgCcRenderDebe(d, t) {
    if (t !== 'display') return d;
    const n = Number(d || 0);
    if (!n) return `<span class="cc-amt cc-amt--muted">${pgFmtMoney(0)}</span>`;
    return `<span class="cc-amt cc-amt--debe">${pgFmtMoney(n)}</span>`;
}

function pgCcRenderHaber(d, t) {
    if (t !== 'display') return d;
    const n = Number(d || 0);
    if (!n) return `<span class="cc-amt cc-amt--muted">${pgFmtMoney(0)}</span>`;
    return `<span class="cc-amt cc-amt--haber">${pgFmtMoney(n)}</span>`;
}

function pgCcRenderSaldo(d, t) {
    if (t !== 'display') return d;
    const n = Number(d || 0);
    const cls = n > 0 ? 'is-positivo' : (n < 0 ? 'is-negativo' : '');
    return `<span class="cc-amt cc-amt--saldo ${cls}">${pgFmtMoney(n)}</span>`;
}

function pgConfigGridCc(data) {
    const rows = pgCcConSaldoAcumulado(data);
    const cols = [
        columnaGridId(),
        { data: 'Fecha', render: (d, t) => t === 'display' ? pgFmtDate(d) : d },
        { data: 'TipoMov' },
        { data: 'Concepto' },
        { data: 'Debe', className: 'text-end', render: pgCcRenderDebe },
        { data: 'Haber', className: 'text-end', render: pgCcRenderHaber },
        { data: 'Saldo', className: 'text-end', render: pgCcRenderSaldo }
    ];

    if (!pgGridCc) {
        kyoEnsureFilterRow('#grd_CcProveedor');
        pgGridCc = $('#grd_CcProveedor').DataTable({
            data: rows,
            language: { url: '//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json' },
            autoWidth: true,
            responsive: true,
            columns: cols,
            order: [[1, 'asc'], [0, 'asc']],
            pageLength: 25,
            dom: 'frtip',
            orderCellsTop: true,
            initComplete: async function () {
                await kyoBindColumnFilters(this.api(), {
                    columns: [
                        { index: 0, filterType: 'text', placeholder: 'Id…' },
                        { index: 1, filterType: 'text', placeholder: 'Fecha…' },
                        { index: 2, filterType: 'text', placeholder: 'Tipo…' },
                        { index: 3, filterType: 'text', placeholder: 'Concepto…' },
                        { index: 4, filterType: 'text', placeholder: 'Debe…' },
                        { index: 5, filterType: 'text', placeholder: 'Haber…' },
                        { index: 6, filterType: 'text', placeholder: 'Saldo…' }
                    ],
                    skipIndexes: []
                });
            }
        });
    } else {
        // Si la grilla ya existía sin columna Saldo, recrear
        if (pgGridCc.columns().count() !== cols.length) {
            pgGridCc.destroy();
            pgGridCc = null;
            $('#grd_CcProveedor').find('tbody').empty();
            return pgConfigGridCc(data);
        }
        pgGridCc.clear().rows.add(rows).draw();
    }
}

/* ===================== Órdenes de compra ===================== */
async function pgCargarOrdenesCompra() {
    const id = pgGetId();
    if (id <= 0) return;

    try {
        const data = await pgFetchJson(`/OrdenesCompras/Lista?IdProveedor=${id}`);
        pgTabsLoaded.ordenes = true;
        pgConfigGridOc(data || []);
        pgToggleOcEmpty(data || []);
        pgActualizarOcCount(data?.length ?? 0);
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar las órdenes de compra.');
    }
}

function pgActualizarOcCount(count) {
    const el = document.getElementById('pgOrdenesCount');
    if (el) el.textContent = `${count ?? 0} orden${count === 1 ? '' : 'es'}`;
}

function pgToggleOcEmpty(data) {
    const empty = document.getElementById('pgOrdenesEmpty');
    const wrap = document.getElementById('pgOrdenesTableWrap');
    const hasData = Array.isArray(data) && data.length > 0;
    if (empty) empty.classList.toggle('d-none', hasData);
    if (wrap) wrap.classList.toggle('pg-precios-has-data', hasData);
}

function pgConfigGridOc(data) {
    pgToggleOcEmpty(data);
    pgActualizarOcCount(data?.length ?? 0);

    const cols = [
        columnaGridAcciones({ editar: 'pgEditarOc', eliminar: 'pgEliminarOc' }, 'OrdenesProveedor'),
        columnaGridId(),
        { data: 'FechaEmision', render: (d, t) => t === 'display' ? pgFmtDate(d) : d },
        { data: 'Local', defaultContent: '—' },
        { data: 'FechaEntrega', render: (d, t) => t === 'display' ? (d ? pgFmtDate(d) : '—') : d },
        { data: 'Estado', defaultContent: '—' },
        { data: 'CostoTotal', render: (d, t) => t === 'display' ? pgFmtMoney(d) : d }
    ];

    if (!pgGridOc) {
        kyoEnsureFilterRow('#grd_OrdenesProveedor');
        pgGridOc = $('#grd_OrdenesProveedor').DataTable({
            data,
            language: { url: '//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json' },
            autoWidth: true,
            responsive: true,
            columns: cols,
            order: [[2, 'desc']],
            pageLength: 25,
            dom: 'frtip',
            orderCellsTop: true,
            columnDefs: columnDefsGridLista(),
            initComplete: async function () {
                await kyoBindColumnFilters(this.api(), {
                    columns: [
                        { index: 1, filterType: 'text', placeholder: 'Id…' },
                        { index: 2, filterType: 'text', placeholder: 'Emisión…' },
                        { index: 3, filterType: 'text', placeholder: 'Local…' },
                        { index: 4, filterType: 'text', placeholder: 'Entrega…' },
                        { index: 5, filterType: 'text', placeholder: 'Estado…' },
                        { index: 6, filterType: 'text', placeholder: 'Total…' }
                    ],
                    skipIndexes: [0]
                });
            }
        });
    } else {
        pgGridOc.clear().rows.add(data).draw();
    }
}

function pgInitOcModal() {
    pgWireOcUnChange();

    document.getElementById('pgModalOc')?.addEventListener('shown.bs.modal', () => {
        pgWireOcUnChange();
        pgRefreshSelect2(document.getElementById('pgOcUN'));
        pgRefreshSelect2(document.getElementById('pgOcLocal'));
    });

    ['pgOcInsPrecio', 'pgOcInsCantidad'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', pgRecalcularSubtotalOcInsumo);
    });

    document.getElementById('pgOcInsSelect')?.addEventListener('change', function () {
        const opt = this.options[this.selectedIndex];
        const costo = Number(opt?.dataset?.costo || 0);
        const precioEl = document.getElementById('pgOcInsPrecio');
        if (!precioEl) return;
        if (costo > 0) {
            precioEl.value = formatNumeroAR(costo, 2);
        } else {
            // Vinculado sin precio de lista: el usuario lo carga a mano
            precioEl.value = '';
        }
        pgRecalcularSubtotalOcInsumo();
    });
}

function pgWireOcUnChange() {
    if (!window.jQuery) return;
    $('#pgOcUN').off('change.pgOc').on('change.pgOc', async function () {
        const idUN = Number($(this).val() || 0);
        await pgPoblarLocalesOc(idUN);
        if (!pgOcEstaBloqueada()) {
            pgOcDetalle = [];
            pgRenderDetalleOc();
            pgRecalcularTotalesOc();
        }
        pgActualizarBtnAddOcInsumo();
    });
}

function pgOcEstaBloqueada() {
    return document.getElementById('pgOcBloqueada')?.value === '1';
}

function pgActualizarBtnAddOcInsumo() {
    const btn = document.getElementById('pgBtnAddOcInsumo');
    if (!btn) return;
    const idUN = Number(document.getElementById('pgOcUN')?.value || 0);
    const bloqueada = pgOcEstaBloqueada();
    btn.disabled = bloqueada || idUN <= 0;
    btn.classList.toggle('disabled', btn.disabled);
}

async function pgCargarCombosOcModal() {
    const [unidades, estados] = await Promise.all([
        pgFetchJson('/UnidadesNegocio/ListaUsuario').catch(() => []),
        pgFetchJson('/OrdenesComprasEstado/Lista').catch(() => [])
    ]);

    const selUN = document.getElementById('pgOcUN');
    if (selUN) {
        const prev = selUN.value;
        selUN.innerHTML = '<option value="">Seleccionar…</option>';
        (unidades || []).forEach(u => {
            const o = document.createElement('option');
            o.value = String(u.Id);
            o.textContent = u.Nombre;
            selUN.appendChild(o);
        });
        if (prev && Array.from(selUN.options).some(o => o.value === prev)) selUN.value = prev;
        pgRefreshSelect2(selUN);
    }

    const pendiente = (estados || []).find(e => String(e.Nombre || '').toLowerCase().trim() === 'pendiente');
    pgOcEstadoPendienteId = pendiente?.Id ?? (estados?.[0]?.Id ?? 1);
}

async function pgPoblarLocalesOc(idUN) {
    const sel = document.getElementById('pgOcLocal');
    if (!sel) return;

    if (!(idUN > 0)) {
        sel.innerHTML = '<option value="">Seleccione UN…</option>';
        sel.disabled = true;
        pgRefreshSelect2(sel);
        if (window.jQuery) $(sel).val(null).trigger('change');
        return;
    }

    let locales = [];
    try {
        const data = await pgFetchJson(`/Locales/ListaPorUnidad?IdUnidadNegocio=${idUN}`);
        locales = Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn('ListaPorUnidad falló, usando Lista filtrada', err);
        const all = await pgFetchJson('/Locales/Lista').catch(() => []);
        locales = (all || []).filter(l => Number(l.IdUnidadNegocio ?? l.IdCombo ?? 0) === idUN);
    }

    sel.disabled = false;
    sel.innerHTML = '<option value="">Seleccionar…</option>';
    locales.forEach(l => {
        const o = document.createElement('option');
        o.value = String(l.Id);
        o.textContent = l.Nombre || `Local #${l.Id}`;
        sel.appendChild(o);
    });

    pgRefreshSelect2(sel);
    if (window.jQuery) $(sel).val(null).trigger('change');
}

function pgLimpiarModalOc() {
    pgOcDetalle = [];
    document.getElementById('pgOcId').value = '0';
    document.getElementById('pgOcIdEstado').value = '0';
    document.getElementById('pgOcBloqueada').value = '0';
    document.getElementById('pgOcFechaEmision').value = new Date().toISOString().slice(0, 10);
    document.getElementById('pgOcFechaEntrega').value = '';
    document.getElementById('pgOcNota').value = '';
    document.getElementById('pgOcCostoTotal').value = pgFmtMoney(0);
    document.getElementById('pgOcError')?.classList.add('d-none');
    document.getElementById('pgOcBloqueadaAlert')?.classList.add('d-none');
    document.getElementById('pgOcDetalleSection')?.classList.remove('d-none');

    const prov = document.getElementById('pgNombre')?.value?.trim()
        || document.getElementById('pgTitulo')?.textContent?.trim() || '';
    document.getElementById('pgOcProveedor').value = prov;

    const selUN = document.getElementById('pgOcUN');
    const selLoc = document.getElementById('pgOcLocal');
    if (selUN) {
        selUN.value = '';
        selUN.disabled = false;
        pgRefreshSelect2(selUN);
    }
    if (selLoc) {
        selLoc.innerHTML = '<option value="">Seleccione UN…</option>';
        selLoc.disabled = true;
        pgRefreshSelect2(selLoc);
        if (window.jQuery) $(selLoc).val(null).trigger('change');
    }

    document.getElementById('pgBtnGuardarOc')?.classList.remove('d-none');
    ['pgOcUN', 'pgOcLocal', 'pgOcFechaEmision', 'pgOcFechaEntrega', 'pgOcNota'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });
    pgRenderDetalleOc();
    pgRecalcularTotalesOc();
    pgActualizarBtnAddOcInsumo();
}

async function pgAbrirModalOc() {
    const idProv = pgGetId();
    if (idProv <= 0) {
        advertenciaModal('Guarde el proveedor antes de crear una orden de compra.');
        return;
    }

    pgLimpiarModalOc();
    await pgCargarCombosOcModal();
    document.getElementById('pgOcIdEstado').value = String(pgOcEstadoPendienteId || 1);
    pgWireOcUnChange();
    pgRefreshSelect2(document.getElementById('pgOcUN'));
    pgRefreshSelect2(document.getElementById('pgOcLocal'));
    document.getElementById('pgModalOcLabel').textContent = 'Nueva orden de compra';
    document.getElementById('pgBtnGuardarOc').innerHTML = '<i class="fa fa-check me-1"></i> Registrar orden';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalOc')).show();
}

async function pgEditarOc(id) {
    try {
        const resp = await pgFetchJson(`/OrdenesCompras/EditarInfo?id=${id}`);
        const oc = resp?.OrdenCompra || {};
        const detalle = resp?.OrdenesComprasInsumos || [];
        const bloqueada = Boolean(oc.TieneComprasAsociadas && Number(oc.CantCompras || 0) > 0);

        pgLimpiarModalOc();
        await pgCargarCombosOcModal();

        document.getElementById('pgOcId').value = String(oc.Id ?? 0);
        document.getElementById('pgOcIdEstado').value = String(oc.IdEstado ?? pgOcEstadoPendienteId);
        document.getElementById('pgOcBloqueada').value = bloqueada ? '1' : '0';
        document.getElementById('pgOcFechaEmision').value = oc.FechaEmision ? String(oc.FechaEmision).slice(0, 10) : '';
        document.getElementById('pgOcFechaEntrega').value = oc.FechaEntrega ? String(oc.FechaEntrega).slice(0, 10) : '';
        document.getElementById('pgOcNota').value = oc.NotaInterna ?? '';
        document.getElementById('pgOcProveedor').value = oc.Proveedor ?? document.getElementById('pgOcProveedor').value;

        const idUN = Number(oc.IdUnidadNegocio ?? 0);
        const idLocal = Number(oc.IdLocal ?? 0);
        if (idUN) {
            pgSetSelect2Value(document.getElementById('pgOcUN'), idUN);
            await pgPoblarLocalesOc(idUN);
        }
        if (idLocal) pgSetSelect2Value(document.getElementById('pgOcLocal'), idLocal);

        pgOcDetalle = detalle.map(d => ({
            id: d.Id ?? 0,
            idInsumo: d.IdInsumo,
            idProveedorLista: d.IdProveedorLista ?? 0,
            nombreInsumo: d.Nombre ?? d.Descripcion ?? `#${d.IdInsumo}`,
            precioUnitario: Number(d.PrecioLista ?? 0),
            cantidad: Number(d.CantidadPedida ?? 0),
            subTotal: Number(d.SubTotal ?? d.Subtotal ?? 0),
            cantidadEntregada: Number(d.CantidadEntregada ?? 0),
            cantidadRestante: Number(d.CantidadRestante ?? d.CantidadPedida ?? 0),
            idEstado: d.IdEstado ?? 1
        }));

        pgRenderDetalleOc();
        pgRecalcularTotalesOc();

        if (bloqueada) {
            document.getElementById('pgOcBloqueadaAlert')?.classList.remove('d-none');
            const link = document.getElementById('pgOcLinkVer');
            if (link) link.href = `/OrdenesCompras/NuevoModif/${oc.Id}`;
            document.getElementById('pgOcDetalleSection')?.classList.add('d-none');
            document.getElementById('pgBtnGuardarOc')?.classList.add('d-none');
            document.getElementById('pgOcUN').disabled = true;
            document.getElementById('pgOcLocal').disabled = true;
            document.getElementById('pgOcFechaEmision').disabled = true;
            document.getElementById('pgOcFechaEntrega').disabled = true;
            document.getElementById('pgOcNota').disabled = true;
        }

        document.getElementById('pgModalOcLabel').textContent = `Editar orden de compra #${oc.Id}`;
        document.getElementById('pgBtnGuardarOc').innerHTML = '<i class="fa fa-check me-1"></i> Guardar orden';
        pgActualizarBtnAddOcInsumo();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalOc')).show();
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar la orden de compra.');
    }
}

async function pgEliminarOc(id) {
    return eliminarConCascada({
        url: '/OrdenesCompras/Eliminar',
        id,
        confirmMsg: '¿Desea eliminar esta orden de compra?',
        headers: () => {
            const t = (typeof token !== 'undefined' && token) ? token : (localStorage.getItem('JwtToken') || '');
            return t ? { 'Authorization': 'Bearer ' + t } : {};
        },
        onSuccess: async (j) => {
            exitoModal(j.mensaje || 'Orden de compra eliminada correctamente.');
            pgTabsLoaded.ordenes = false;
            await pgCargarOrdenesCompra();
        }
    });
}

async function pgPoblarInsumosOcModal() {
    const sel = document.getElementById('pgOcInsSelect');
    if (!sel) return;

    const idUN = Number(document.getElementById('pgOcUN')?.value || 0);
    const idProv = pgGetId();
    if (idUN <= 0 || idProv <= 0) {
        sel.innerHTML = '<option value="">Seleccione unidad de negocio…</option>';
        pgRefreshSelect2(sel);
        return;
    }

    // Toda la lista de precios del proveedor (con o sin precio / vínculo de catálogo)
    let insumos = [];
    try {
        insumos = await pgFetchJson(
            `/ProveedoresInsumos/ListaParaOrdenCompra?IdProveedor=${idProv}&IdUnidadNegocio=${idUN}`
        );
    } catch (err) {
        console.warn('ListaParaOrdenCompra falló, fallback ListaPorUnidadYProveedor', err);
        try {
            insumos = await pgFetchJson(
                `/Insumos/ListaPorUnidadYProveedor?IdUnidadNegocio=${idUN}&IdProveedor=${idProv}`
            );
        } catch {
            insumos = [];
        }
    }
    if (!Array.isArray(insumos)) insumos = insumos?.$values || [];

    sel.innerHTML = '<option value="">Seleccionar insumo…</option>';
    insumos.forEach(i => {
        const idInsumo = Number(i.Id ?? i.id ?? 0);
        const idLista = Number(i.IdProveedorLista ?? i.idProveedorLista ?? 0);
        // Valor único: preferir IdInsumo; si no hay, prefijo L + id lista
        const value = idInsumo > 0 ? String(idInsumo) : (idLista > 0 ? `L${idLista}` : '');
        if (!value) return;

        const o = document.createElement('option');
        o.value = value;
        o.textContent = i.Descripcion ?? i.Nombre ?? i.descripcion ?? i.nombre ?? `#${value}`;
        o.dataset.costo = String(i.CostoUnitario ?? i.costoUnitario ?? i.PrecioLista ?? i.precioLista ?? 0);
        o.dataset.idprovlista = String(idLista);
        o.dataset.idinsumo = String(idInsumo);
        sel.appendChild(o);
    });

    pgRefreshSelect2(sel);
}

function pgRecalcularSubtotalOcInsumo() {
    const precio = formatearSinMiles(document.getElementById('pgOcInsPrecio')?.value);
    const cant = formatearSinMiles(document.getElementById('pgOcInsCantidad')?.value);
    const sub = (isNaN(precio) ? 0 : precio) * (isNaN(cant) || cant <= 0 ? 0 : cant);
    const el = document.getElementById('pgOcInsSubtotal');
    if (el) el.value = sub > 0 ? formatNumeroAR(sub, 2) : '';
}

async function pgAbrirModalOcInsumo(indice = null) {
    if (pgOcEstaBloqueada()) return;

    const idUN = Number(document.getElementById('pgOcUN')?.value || 0);
    if (idUN <= 0) {
        advertenciaModal('Seleccione una unidad de negocio antes de agregar insumos.');
        return;
    }

    const editando = indice != null && pgOcDetalle[indice];
    document.getElementById('pgOcInsIndex').value = editando ? String(indice) : '';
    document.getElementById('pgOcInsError')?.classList.add('d-none');
    document.getElementById('pgOcInsPrecio').value = '';
    document.getElementById('pgOcInsCantidad').value = '1';
    document.getElementById('pgOcInsSubtotal').value = '';

    await pgPoblarInsumosOcModal();

    const sel = document.getElementById('pgOcInsSelect');
    const titulo = document.getElementById('pgModalOcInsumoLabel');
    const btnGuardar = document.getElementById('pgBtnGuardarOcInsumoLinea');

    if (editando) {
        const item = pgOcDetalle[indice];
        if (titulo) titulo.textContent = 'Editar insumo';
        if (btnGuardar) btnGuardar.innerHTML = '<i class="fa fa-check me-1"></i> Guardar';

        const idStr = item.idInsumo > 0
            ? String(item.idInsumo)
            : (item.idProveedorLista > 0 ? `L${item.idProveedorLista}` : '');
        // Si el insumo ya no viene en la lista, lo agregamos para poder mostrarlo
        if (idStr && sel && !Array.from(sel.options).some(o => o.value === idStr)) {
            const o = document.createElement('option');
            o.value = idStr;
            o.textContent = item.nombreInsumo || `Insumo #${idStr}`;
            o.dataset.costo = String(item.precioUnitario ?? 0);
            o.dataset.idprovlista = String(item.idProveedorLista ?? 0);
            o.dataset.idinsumo = String(item.idInsumo ?? 0);
            sel.appendChild(o);
            pgRefreshSelect2(sel);
        }

        pgSetSelect2Value(sel, idStr);
        if (sel) {
            sel.disabled = true;
            if (window.jQuery && $(sel).data('select2')) {
                $(sel).prop('disabled', true).trigger('change.select2');
            }
        }

        document.getElementById('pgOcInsPrecio').value = formatNumeroAR(item.precioUnitario, 2);
        document.getElementById('pgOcInsCantidad').value = formatNumeroAR(item.cantidad, 2);
        pgRecalcularSubtotalOcInsumo();
    } else {
        if (titulo) titulo.textContent = 'Agregar insumo';
        if (btnGuardar) btnGuardar.innerHTML = '<i class="fa fa-check me-1"></i> Agregar';
        if (sel) {
            sel.disabled = false;
            if (window.jQuery && $(sel).data('select2')) {
                $(sel).prop('disabled', false);
            }
        }
        pgSetSelect2Value(sel, '');
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalOcInsumo')).show();
}

function pgGuardarOcInsumoLinea() {
    const sel = document.getElementById('pgOcInsSelect');
    const rawVal = (sel?.value || '').trim();
    const precio = formatearSinMiles(document.getElementById('pgOcInsPrecio')?.value);
    const cant = formatearSinMiles(document.getElementById('pgOcInsCantidad')?.value);
    const errEl = document.getElementById('pgOcInsError');

    if (!rawVal || isNaN(precio) || precio <= 0 || isNaN(cant) || cant <= 0) {
        errEl?.classList.remove('d-none');
        return;
    }
    errEl?.classList.add('d-none');

    return withBusy("#pgBtnGuardarOcInsumoLinea", async () => {
        const opt = sel.options[sel.selectedIndex];
        const idxStr = document.getElementById('pgOcInsIndex')?.value ?? '';
        const idUN = Number(document.getElementById('pgOcUN')?.value || 0);
        let idLista = Number(opt?.dataset?.idprovlista || 0);
        let idInsumo = Number(opt?.dataset?.idinsumo || 0);

        if (!(idInsumo > 0) && rawVal.startsWith('L')) {
            idLista = Number(rawVal.slice(1)) || idLista;
        } else if (!(idInsumo > 0)) {
            idInsumo = Number(rawVal) || 0;
        }

        // Si el ítem de lista aún no tiene insumo de catálogo, lo aseguramos
        if (!(idInsumo > 0) && idLista > 0) {
            try {
                const aseg = await pgFetchJson('/ProveedoresInsumos/AsegurarInsumoCatalogo', {
                    method: 'POST',
                    body: JSON.stringify({ IdListaProveedor: idLista, IdUnidadNegocio: idUN })
                });
                if (!aseg?.valor || !(aseg.idInsumo > 0)) {
                    errorModal(aseg?.mensaje || 'No se pudo vincular el ítem al catálogo de insumos.');
                    return;
                }
                idInsumo = Number(aseg.idInsumo);
                idLista = Number(aseg.idProveedorLista || idLista);
            } catch (err) {
                console.error(err);
                errorModal(err?.message || 'No se pudo vincular el ítem al catálogo de insumos.');
                return;
            }
        }

        if (!(idInsumo > 0)) {
            errorModal('Seleccioná un insumo válido de la lista.');
            return;
        }

        // En edición, si el select está deshabilitado, conservar idInsumo del detalle
        if (idxStr !== '' && pgOcDetalle[idxStr] && !(idInsumo > 0)) {
            idInsumo = Number(pgOcDetalle[idxStr].idInsumo);
            idLista = Number(pgOcDetalle[idxStr].idProveedorLista || idLista);
        }

        const item = {
            id: idxStr !== '' && pgOcDetalle[idxStr] ? pgOcDetalle[idxStr].id : 0,
            idInsumo,
            idProveedorLista: idLista,
            nombreInsumo: opt?.textContent || 'Insumo',
            precioUnitario: precio,
            cantidad: cant,
            subTotal: precio * cant,
            cantidadEntregada: idxStr !== '' && pgOcDetalle[idxStr] ? pgOcDetalle[idxStr].cantidadEntregada : 0,
            cantidadRestante: idxStr !== '' && pgOcDetalle[idxStr] ? pgOcDetalle[idxStr].cantidadRestante : cant,
            idEstado: idxStr !== '' && pgOcDetalle[idxStr] ? pgOcDetalle[idxStr].idEstado : 1
        };

        if (idxStr !== '' && pgOcDetalle[idxStr]) {
            pgOcDetalle[idxStr] = item;
        } else {
            const existIdx = pgOcDetalle.findIndex(d => String(d.idInsumo) === String(idInsumo));
            if (existIdx >= 0) {
                const ex = pgOcDetalle[existIdx];
                ex.cantidad = Number(ex.cantidad) + cant;
                ex.precioUnitario = precio;
                ex.subTotal = ex.precioUnitario * ex.cantidad;
                ex.cantidadRestante = ex.cantidad - Number(ex.cantidadEntregada || 0);
            } else {
                pgOcDetalle.push(item);
            }
        }

        pgRenderDetalleOc();
        pgRecalcularTotalesOc();
        bootstrap.Modal.getInstance(document.getElementById('pgModalOcInsumo'))?.hide();
    }, { label: "Añadiendo..." });
}

async function pgEliminarOcInsumo(idx) {
    if (pgOcEstaBloqueada()) return;
    if (!(await confirmarModal('¿Eliminar este insumo del detalle?'))) return;
    pgOcDetalle.splice(idx, 1);
    pgRenderDetalleOc();
    pgRecalcularTotalesOc();
}

function pgRenderDetalleOc() {
    const tbody = document.getElementById('pgOcDetalleBody');
    if (!tbody) return;

    if (!pgOcDetalle.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted-cc py-3">Sin ítems — agregue insumos</td></tr>';
        return;
    }

    const bloqueada = pgOcEstaBloqueada();
    tbody.innerHTML = pgOcDetalle.map((d, i) => `
        <tr>
            <td>${d.nombreInsumo || '—'}</td>
            <td class="text-end">${pgFmtMoney(d.precioUnitario)}</td>
            <td class="text-center">${formatNumeroAR(d.cantidad, 2)}</td>
            <td class="text-end">${pgFmtMoney(d.subTotal)}</td>
            <td class="text-center pg-compra-actions-col">
                ${bloqueada ? '' : `
                <div class="pg-row-actions">
                    <button type="button" class="pg-action-btn pg-action-btn--edit" onclick="pgAbrirModalOcInsumo(${i})" title="Editar">
                        <i class="fa fa-pencil"></i>
                    </button>
                    <button type="button" class="pg-action-btn pg-action-btn--delete" onclick="pgEliminarOcInsumo(${i})" title="Eliminar">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>`}
            </td>
        </tr>`).join('');
}

function pgRecalcularTotalesOc() {
    const total = pgOcDetalle.reduce((s, d) => s + Number(d.subTotal ?? 0), 0);
    const el = document.getElementById('pgOcCostoTotal');
    if (el) el.value = pgFmtMoney(total);
}

async function pgGuardarOc() {
    if (pgOcEstaBloqueada()) return;

    const idProv = pgGetId();
    const id = Number(document.getElementById('pgOcId')?.value || 0);
    const idUN = Number(document.getElementById('pgOcUN')?.value || 0);
    const idLocal = Number(document.getElementById('pgOcLocal')?.value || 0);
    const fechaEmision = document.getElementById('pgOcFechaEmision')?.value;
    const errEl = document.getElementById('pgOcError');

    if (!idUN || !idLocal || !fechaEmision) {
        errEl.textContent = 'Complete unidad de negocio, local y fecha de emisión.';
        errEl.classList.remove('d-none');
        return;
    }
    if (!pgOcDetalle.length) {
        errEl.textContent = 'Agregue al menos un insumo al detalle.';
        errEl.classList.remove('d-none');
        return;
    }
    errEl.classList.add('d-none');

    return withBusy("#pgBtnGuardarOc", async () => {
        const totalCalc = pgOcDetalle.reduce((s, d) => s + Number(d.subTotal ?? 0), 0);
        const rawEstado = Number(document.getElementById('pgOcIdEstado')?.value || 0);
        const idEstado = rawEstado > 0 ? rawEstado : Number(pgOcEstadoPendienteId || 1);

        const payload = {
            Id: id,
            IdUnidadNegocio: idUN,
            IdLocal: idLocal,
            IdProveedor: idProv,
            FechaEmision: fechaEmision,
            FechaEntrega: document.getElementById('pgOcFechaEntrega')?.value || null,
            CostoTotal: totalCalc,
            IdEstado: idEstado,
            NotaInterna: document.getElementById('pgOcNota')?.value?.trim() || '',
            OrdenesComprasInsumos: pgOcDetalle.map(d => {
                const idLista = Number(d.idProveedorLista || 0);
                return {
                    Id: d.id || 0,
                    IdOrdenCompra: id,
                    IdInsumo: Number(d.idInsumo),
                    IdProveedorLista: idLista > 0 ? idLista : null,
                    CantidadPedida: Number(d.cantidad),
                    CantidadEntregada: Number(d.cantidadEntregada ?? 0),
                    CantidadRestante: Number(d.cantidadRestante ?? d.cantidad),
                    PrecioLista: Number(d.precioUnitario),
                    Subtotal: Number(d.subTotal),
                    IdEstado: Number(d.idEstado || 1),
                    NotaInterna: ''
                };
            })
        };

        const isNew = id <= 0;
        const url = isNew ? '/OrdenesCompras/Insertar' : '/OrdenesCompras/Actualizar';
        const method = isNew ? 'POST' : 'PUT';

        try {
            const data = await pgFetchJson(url, { method, body: JSON.stringify(payload) });
            const resp = interpretarRespuestaApi(data);
            if (!resp.valor) {
                errorModal(resp.mensaje || 'No se pudo guardar la orden de compra.');
                return;
            }
            bootstrap.Modal.getInstance(document.getElementById('pgModalOc'))?.hide();
            exitoModal(isNew ? 'Orden de compra registrada correctamente.' : 'Orden de compra actualizada correctamente.');
            pgTabsLoaded.ordenes = false;
            pgTabsLoaded.compras = false;
            await pgCargarOrdenesCompra();
        } catch (err) {
            console.error(err);
            errorModal(err?.message || 'Ha ocurrido un error al guardar la orden de compra.');
        }
    });
}

/* ===================== Compras ===================== */
async function pgCargarCompras() {
    const id = pgGetId();
    if (id <= 0) return;

    try {
        const data = await pgFetchJson(`/Compras/Lista?IdProveedor=${id}`);
        pgTabsLoaded.compras = true;
        pgConfigGridCompras(data || []);
        pgToggleComprasEmpty(data || []);
        pgActualizarComprasCount(data?.length ?? 0);
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar las compras.');
    }
}

function pgConfigGridCompras(data) {
    pgToggleComprasEmpty(data);
    pgActualizarComprasCount(data?.length ?? 0);

    const cols = [
        columnaGridAcciones({ editar: 'pgEditarCompra', eliminar: 'pgEliminarCompra' }, 'ComprasProveedor'),
        columnaGridId(),
        { data: 'Fecha', render: (d, t) => t === 'display' ? pgFmtDate(d) : d },
        { data: 'Local' },
        { data: 'OrdenCompra', defaultContent: '—' },
        { data: 'SubtotalFinal', render: (d, t) => t === 'display' ? pgFmtMoney(d) : d }
    ];

    if (!pgGridCompras) {
        kyoEnsureFilterRow('#grd_ComprasProveedor');
        pgGridCompras = $('#grd_ComprasProveedor').DataTable({
            data,
            language: { url: '//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json' },
            autoWidth: true,
            responsive: true,
            columns: cols,
            order: [[2, 'desc']],
            pageLength: 25,
            dom: 'frtip',
            orderCellsTop: true,
            columnDefs: columnDefsGridLista(),
            initComplete: async function () {
                await kyoBindColumnFilters(this.api(), {
                    columns: [
                        { index: 1, filterType: 'text', placeholder: 'Id…' },
                        { index: 2, filterType: 'text', placeholder: 'Fecha…' },
                        { index: 3, filterType: 'text', placeholder: 'Local…' },
                        { index: 4, filterType: 'text', placeholder: 'OC…' },
                        { index: 5, filterType: 'text', placeholder: 'Total…' }
                    ],
                    skipIndexes: [0]
                });
            }
        });
    } else {
        pgGridCompras.clear().rows.add(data).draw();
    }
}

function pgActualizarComprasCount(count) {
    const el = document.getElementById('pgComprasCount');
    if (el) el.textContent = `${count ?? 0} compra${count === 1 ? '' : 's'}`;
}

function pgToggleComprasEmpty(data) {
    const empty = document.getElementById('pgComprasEmpty');
    const wrap = document.getElementById('pgComprasTableWrap');
    const hasData = Array.isArray(data) && data.length > 0;
    if (empty) empty.classList.toggle('d-none', hasData);
    if (wrap) wrap.classList.toggle('pg-precios-has-data', hasData);
}

/* ===================== Modal compra (CRUD inline) ===================== */
function pgOnCompraOcChange() {
    const sel = document.getElementById('pgCompraOc');
    const idOc = Number(sel?.value || 0);
    if (idOc > 0) {
        pgCargarDetalleDesdeOc(idOc);
        return;
    }
    document.getElementById('pgCompraIdUN').value = '0';
    document.getElementById('pgCompraIdLocal').value = '0';
    document.getElementById('pgCompraUN').value = '';
    document.getElementById('pgCompraLocal').value = '';
    pgLimpiarDetalleCompra();
}

function pgWireCompraOcSelect() {
    const sel = document.getElementById('pgCompraOc');
    if (!sel) return;

    // Select2 dispara change vía jQuery: el listener nativo a veces no corre.
    if (window.jQuery) {
        const $sel = $(sel);
        $sel.off('select2:select.pgCompra select2:clear.pgCompra change.pgCompra');
        $sel.on('select2:select.pgCompra', pgOnCompraOcChange);
        $sel.on('select2:clear.pgCompra change.pgCompra', pgOnCompraOcChange);
    } else if (sel.dataset.pgOcWired !== '1') {
        sel.dataset.pgOcWired = '1';
        sel.addEventListener('change', pgOnCompraOcChange);
    }
}

function pgInitCompraModal() {
    pgWireCompraOcSelect();
    document.getElementById('pgCompraDescuentos')?.addEventListener('input', pgRecalcularTotalesCompra);
    document.getElementById('pgCompraDetalleBody')?.addEventListener('input', function (e) {
        const inp = e.target.closest('[data-pg-compra-field]');
        if (!inp) return;
        const idx = Number(inp.dataset.index);
        const field = inp.dataset.pgCompraField;
        if (isNaN(idx) || !pgCompraDetalle[idx]) return;
        const linea = pgCompraDetalle[idx];
        if (field === 'cant') linea.CantRecibida = formatearSinMiles(inp.value);
        if (field === 'precio') linea.PrecioFactura = formatearSinMiles(inp.value);
        pgRecalcularLineaCompra(linea);
        pgRenderDetalleCompra();
        pgRecalcularTotalesCompra();
    });
}

function pgLimpiarModalCompra() {
    pgCompraDetalle = [];
    document.getElementById('pgCompraId').value = '0';
    document.getElementById('pgCompraIdUN').value = '0';
    document.getElementById('pgCompraIdLocal').value = '0';
    const selOc = document.getElementById('pgCompraOc');
    if (selOc) {
        selOc.value = '';
        if (window.jQuery && $(selOc).data('select2')) {
            $(selOc).val(null).trigger('change.select2');
        }
    }
    document.getElementById('pgCompraFecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('pgCompraDescuentos').value = '0';
    document.getElementById('pgCompraNota').value = '';
    document.getElementById('pgCompraUN').value = '';
    document.getElementById('pgCompraLocal').value = '';
    const prov = document.getElementById('pgNombre')?.value?.trim() || document.getElementById('pgTitulo')?.textContent?.trim() || '';
    document.getElementById('pgCompraProveedor').value = prov;
    document.getElementById('pgCompraError')?.classList.add('d-none');
    document.getElementById('pgCompraDetalleWrap')?.classList.add('d-none');
    pgRenderDetalleCompra();
    pgRecalcularTotalesCompra();
}

function pgLimpiarDetalleCompra() {
    pgCompraDetalle = [];
    document.getElementById('pgCompraDetalleWrap')?.classList.add('d-none');
    pgRenderDetalleCompra();
    pgRecalcularTotalesCompra();
}

async function pgCargarOcPendientes(opts = {}) {
    const idProv = pgGetId();
    const sel = document.getElementById('pgCompraOc');
    const hint = document.getElementById('pgCompraSinOc');
    const hintSmall = document.getElementById('pgCompraOcHint');
    if (!sel) return [];

    if (window.jQuery && $(sel).data('select2')) {
        $(sel).select2('destroy');
    }

    sel.innerHTML = '<option value="">Seleccionar OC pendiente…</option>';
    pgCompraOcList = [];

    const idOcActual = Number(opts.idOcActual || 0);
    const esEdicion = Boolean(opts.esEdicion);

    try {
        const data = await pgFetchJson(`/OrdenesCompras/ListaPendientes?idProveedor=${idProv}`);
        pgCompraOcList = Array.isArray(data) ? data : [];
        pgCompraOcList.forEach(oc => {
            const opt = document.createElement('option');
            opt.value = String(oc.Id);
            const fecha = oc.FechaEmision ? pgFmtDate(oc.FechaEmision) : '';
            opt.textContent = `OC #${oc.Id} — ${oc.Local || oc.UnidadNegocio || ''} — ${fecha}`;
            opt.dataset.idun = String(oc.IdUnidadNegocio ?? 0);
            opt.dataset.idlocal = String(oc.IdLocal ?? 0);
            opt.dataset.un = oc.UnidadNegocio || '';
            opt.dataset.local = oc.Local || '';
            sel.appendChild(opt);
        });

        // En edición la OC asociada ya no está "pendiente": no mostrar el aviso engañoso.
        const tieneOcAsociada = esEdicion && idOcActual > 0;
        if (hint) {
            hint.classList.toggle('d-none', tieneOcAsociada || pgCompraOcList.length > 0);
        }
        if (hintSmall) {
            hintSmall.textContent = tieneOcAsociada
                ? 'Orden de compra asociada a esta compra'
                : 'Solo órdenes pendientes de este proveedor';
        }
        if (!tieneOcAsociada && pgCompraOcList.length === 0) pgLimpiarDetalleCompra();
    } catch (err) {
        console.error(err);
        if (hint && !(esEdicion && idOcActual > 0)) hint.classList.remove('d-none');
    }

    pgRefreshSelect2(sel);
    pgWireCompraOcSelect();
}

async function pgAbrirModalCompra() {
    const idProv = pgGetId();
    if (idProv <= 0) {
        advertenciaModal('Guarde el proveedor antes de registrar una compra.');
        return;
    }
    pgLimpiarModalCompra();
    document.getElementById('pgCompraOc').disabled = false;
    document.getElementById('pgModalCompraLabel').textContent = 'Nueva compra';
    document.getElementById('pgBtnGuardarCompra').innerHTML = '<i class="fa fa-check me-1"></i> Registrar compra';
    const hintSmall = document.getElementById('pgCompraOcHint');
    if (hintSmall) hintSmall.textContent = 'Solo órdenes pendientes de este proveedor';
    await pgCargarOcPendientes();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalCompra')).show();
}

async function pgEditarCompra(id) {
    try {
        const compra = await pgFetchJson(`/Compras/EditarInfo?id=${id}`);
        if (!compra) throw new Error('Sin datos');

        pgLimpiarModalCompra();
        await pgCargarOcPendientes({
            esEdicion: true,
            idOcActual: Number(compra.IdOrdenCompra || 0)
        });

        document.getElementById('pgCompraId').value = String(compra.Id ?? 0);
        document.getElementById('pgCompraIdUN').value = String(compra.IdUnidadNegocio ?? 0);
        document.getElementById('pgCompraIdLocal').value = String(compra.IdLocal ?? 0);
        document.getElementById('pgCompraFecha').value = compra.Fecha ? String(compra.Fecha).slice(0, 10) : '';
        document.getElementById('pgCompraNota').value = compra.NotaInterna ?? '';
        document.getElementById('pgCompraDescuentos').value = formatNumeroAR(compra.Descuentos ?? 0, 2);

        if (compra.IdOrdenCompra) {
            const sel = document.getElementById('pgCompraOc');
            const val = String(compra.IdOrdenCompra);
            if (sel && !Array.from(sel.options).some(o => o.value === val)) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = `OC #${val}`;
                sel.appendChild(opt);
            }
            if (sel) {
                sel.value = val;
                if (window.jQuery && $(sel).data('select2')) {
                    $(sel).val(val).trigger('change.select2');
                }
            }
            document.getElementById('pgCompraSinOc')?.classList.add('d-none');
        }

        try {
            const ocResp = await pgFetchJson(`/OrdenesCompras/EditarInfo?id=${compra.IdOrdenCompra}`);
            const oc = ocResp?.OrdenCompra || {};
            document.getElementById('pgCompraUN').value = oc.UnidadNegocio ?? '';
            document.getElementById('pgCompraLocal').value = oc.Local ?? '';
            document.getElementById('pgCompraProveedor').value = oc.Proveedor ?? document.getElementById('pgCompraProveedor').value;
        } catch { /* ignore */ }

        pgCompraDetalle = (compra.ComprasInsumos || []).map(d => {
            const linea = {
                IdCompraInsumo: d.Id,
                IdOrdenCompraInsumo: d.IdOrdenCompraInsumo ?? 0,
                IdInsumo: d.IdInsumo,
                IdProveedorLista: d.IdProveedorLista ?? 0,
                NombreInsumo: d.Nombre ?? d.Descripcion ?? `#${d.IdInsumo}`,
                CantPedida: Number(d.CantidadPedidaOc ?? d.Cantidad ?? 0),
                CantPendienteOC: Number(d.CantidadPendienteOc ?? 0),
                CantRecibida: Number(d.Cantidad ?? 0),
                PrecioListaOC: Number(d.PrecioLista ?? 0),
                PrecioFactura: Number(d.PrecioFactura ?? d.PrecioLista ?? 0),
                Subtotal: Number(d.SubtotalFinal ?? 0),
                EstadoId: d.IdEstadoOcInsumo ?? 1,
                EstadoNombre: d.EstadoOcNombre ?? 'Pendiente',
                EstadoManual: true
            };
            pgRecalcularLineaCompra(linea);
            return linea;
        });

        document.getElementById('pgCompraDetalleWrap')?.classList.toggle('d-none', pgCompraDetalle.length === 0);
        pgRenderDetalleCompra();
        pgRecalcularTotalesCompra();

        document.getElementById('pgModalCompraLabel').textContent = `Editar compra #${compra.Id}`;
        document.getElementById('pgBtnGuardarCompra').innerHTML = '<i class="fa fa-check me-1"></i> Guardar compra';
        document.getElementById('pgCompraOc').disabled = true;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalCompra')).show();
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar la compra.');
    }
}

async function pgEliminarCompra(id) {
    let cambios = [];
    try {
        const data = await pgFetchJson(`/Compras/ImpactoPreciosEliminar?id=${id}`);
        cambios = data?.cambios || data?.Cambios || [];
    } catch (err) {
        console.warn('No se pudo obtener impacto de precios', err);
    }

    const okImpacto = await confirmarImpactoPreciosCompra('eliminar', cambios, {
        mensaje: cambios.length
            ? 'Al eliminar esta compra se revertirán estos precios de lista al valor anterior:'
            : '¿Desea eliminar esta compra? No hay precios de lista que revertir.'
    });
    if (!okImpacto) return false;

    try {
        const j = await pgFetchJson(`/Compras/Eliminar?id=${id}`, { method: 'DELETE' });
        if (!j?.valor && !j?.Valor) {
            errorModal(j?.mensaje || j?.Mensaje || 'No se pudo eliminar la compra.');
            return false;
        }
        exitoModal(j.mensaje || j.Mensaje || 'Compra eliminada correctamente.');
        pgTabsLoaded.compras = false;
        pgTabsLoaded.cc = false;
        pgTabsLoaded.precios = false;
        await pgCargarCompras();
        await pgCargarResumen(pgGetId());
        return true;
    } catch (err) {
        console.error(err);
        errorModal('Ha ocurrido un error al eliminar la compra.');
        return false;
    }
}

async function pgCargarDetalleDesdeOc(idOC) {
    try {
        const wrap = document.getElementById('pgCompraDetalleWrap');
        if (wrap) wrap.classList.remove('d-none');

        const resp = await pgFetchJson(`/OrdenesCompras/EditarInfo?id=${idOC}`);
        const oc = resp?.OrdenCompra || resp?.ordenCompra || {};
        const detArray = resp?.OrdenesComprasInsumos || resp?.ordenesComprasInsumos || [];
        const fromList = pgCompraOcList.find(x => Number(x.Id ?? x.id) === Number(idOC)) || {};
        const sel = document.getElementById('pgCompraOc');
        const opt = sel?.selectedOptions?.[0];

        const idUN = oc.IdUnidadNegocio ?? fromList.IdUnidadNegocio ?? opt?.dataset?.idun ?? 0;
        const idLocal = oc.IdLocal ?? fromList.IdLocal ?? opt?.dataset?.idlocal ?? 0;
        const nombreUN = oc.UnidadNegocio || fromList.UnidadNegocio || opt?.dataset?.un || '';
        const nombreLocal = oc.Local || fromList.Local || opt?.dataset?.local || '';

        document.getElementById('pgCompraIdUN').value = String(idUN || 0);
        document.getElementById('pgCompraIdLocal').value = String(idLocal || 0);
        document.getElementById('pgCompraUN').value = nombreUN;
        document.getElementById('pgCompraLocal').value = nombreLocal;
        document.getElementById('pgCompraProveedor').value =
            oc.Proveedor || fromList.Proveedor || document.getElementById('pgCompraProveedor').value;

        if (oc.FechaEmision) {
            document.getElementById('pgCompraFecha').value = String(oc.FechaEmision).slice(0, 10);
        }
        if (oc.NotaInterna && !document.getElementById('pgCompraNota').value) {
            document.getElementById('pgCompraNota').value = oc.NotaInterna;
        }

        pgCompraDetalle = (Array.isArray(detArray) ? detArray : []).map(d => {
            const pedida = Number(d.CantidadPedida ?? d.cantidadPedida ?? d.Cantidad ?? 0);
            const entregada = Number(d.CantidadEntregada ?? d.cantidadEntregada ?? 0);
            const pendiente = Number(d.CantidadRestante ?? d.cantidadRestante ?? (pedida - entregada));
            const precioLista = Number(d.PrecioLista ?? d.precioLista ?? 0);
            const linea = {
                IdCompraInsumo: 0,
                IdOrdenCompraInsumo: d.Id ?? d.id ?? 0,
                IdInsumo: d.IdInsumo ?? d.idInsumo,
                IdProveedorLista: Number(d.IdProveedorLista ?? d.idProveedorLista ?? 0),
                NombreInsumo: d.Nombre ?? d.nombre ?? d.Descripcion ?? d.descripcion ?? `#${d.IdInsumo ?? d.idInsumo}`,
                Sku: d.Sku ?? d.sku ?? '',
                CantPedida: pedida,
                CantPendienteOC: pendiente,
                CantRecibida: pendiente > 0 ? pendiente : 0,
                PrecioListaOC: precioLista,
                PrecioFactura: precioLista,
                DifCant: 0,
                DifPrecio: 0,
                DifSubtotal: 0,
                Subtotal: 0,
                EstadoId: 1,
                EstadoNombre: 'Pendiente',
                EstadoManual: false
            };
            pgRecalcularLineaCompra(linea);
            return linea;
        });

        if (!pgCompraDetalle.length) {
            advertenciaModal('La orden de compra no tiene insumos en el detalle.');
        }

        document.getElementById('pgCompraDetalleWrap')?.classList.toggle('d-none', pgCompraDetalle.length === 0);
        pgRenderDetalleCompra();
        pgRecalcularTotalesCompra();
    } catch (err) {
        console.error(err);
        errorModal(err?.message || 'No se pudo cargar la orden de compra.');
    }
}

function pgAutoEstadoCompra(linea) {
    if (linea.EstadoManual) return;
    const ped = Number(linea.CantPedida ?? 0);
    const rec = Number(linea.CantRecibida ?? 0);
    if (rec >= ped && ped > 0) { linea.EstadoId = 2; linea.EstadoNombre = 'Entregado'; }
    else if (rec > 0 && rec < ped) { linea.EstadoId = 3; linea.EstadoNombre = 'Incompleto'; }
    else { linea.EstadoId = 1; linea.EstadoNombre = 'Pendiente'; }
}

function pgRecalcularLineaCompra(linea) {
    const cant = Number(linea.CantRecibida ?? 0);
    const ped = Number(linea.CantPedida ?? 0);
    const pLista = Number(linea.PrecioListaOC ?? 0);
    const pFact = Number(linea.PrecioFactura ?? 0);

    linea.DifCant = cant - ped;
    linea.DifPrecio = pFact - pLista;
    const subtotalOc = ped * pLista;
    const subtotalFact = cant * pFact;
    linea.Subtotal = subtotalFact;
    linea.DifSubtotal = subtotalFact - subtotalOc;

    if (Math.abs(linea.DifPrecio) < 0.0001) linea.DifPrecio = 0;
    if (Math.abs(linea.DifSubtotal) < 0.0001) linea.DifSubtotal = 0;

    pgAutoEstadoCompra(linea);
}

function pgClaseDif(v) {
    const n = Number(v ?? 0);
    if (!n) return '';
    return n > 0 ? 'pg-dif-pos' : 'pg-dif-neg';
}

function pgRenderDetalleCompra() {
    const tbody = document.getElementById('pgCompraDetalleBody');
    if (!tbody) return;
    if (!pgCompraDetalle.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted-cc py-3">Sin ítems</td></tr>';
        return;
    }
    tbody.innerHTML = pgCompraDetalle.map((d, i) => {
        let estadoClase = 'pg-estado-pendiente';
        if (d.EstadoId === 2) estadoClase = 'pg-estado-entregado';
        else if (d.EstadoId === 3) estadoClase = 'pg-estado-incompleto';

        return `
        <tr>
            <td>
                <div class="pg-compra-insumo-nombre">${pgEscHtml(d.NombreInsumo || '—')}</div>
                ${d.Sku ? `<div class="pg-compra-insumo-sku">SKU: ${pgEscHtml(d.Sku)}</div>` : ''}
            </td>
            <td class="text-center">${formatNumeroAR(d.CantPedida, 2)}</td>
            <td class="text-center">${formatNumeroAR(d.CantPendienteOC, 2)}</td>
            <td class="text-center" style="min-width:90px">
                <input type="text" class="form-control form-control-sm text-center" data-pg-compra-field="cant" data-index="${i}"
                    value="${formatNumeroAR(d.CantRecibida, 2)}" inputmode="decimal" />
            </td>
            <td class="text-center ${pgClaseDif(d.DifCant)}">${formatNumeroAR(d.DifCant, 2)}</td>
            <td class="text-end">${pgFmtMoney(d.PrecioListaOC)}</td>
            <td class="text-end" style="min-width:100px">
                <input type="text" class="form-control form-control-sm text-end" data-pg-compra-field="precio" data-index="${i}"
                    value="${formatNumeroAR(d.PrecioFactura, 2)}" inputmode="decimal" />
            </td>
            <td class="text-end ${pgClaseDif(d.DifPrecio)}">${pgFmtMoney(d.DifPrecio)}</td>
            <td class="text-end ${pgClaseDif(d.DifSubtotal)}">${pgFmtMoney(d.DifSubtotal)}</td>
            <td class="text-center"><span class="pg-badge-estado ${estadoClase}">${pgEscHtml(d.EstadoNombre || 'Pendiente')}</span></td>
            <td class="text-end">${pgFmtMoney(d.Subtotal)}</td>
        </tr>`;
    }).join('');
}

function pgRecalcularTotalesCompra() {
    let subtotal = 0;
    pgCompraDetalle.forEach(d => { subtotal += Number(d.Subtotal ?? 0); });
    const desc = formatearSinMiles(document.getElementById('pgCompraDescuentos')?.value);
    const total = subtotal - (isNaN(desc) ? 0 : desc);
    const subEl = document.getElementById('pgCompraSubtotal');
    const totEl = document.getElementById('pgCompraTotal');
    if (subEl) subEl.textContent = pgFmtMoney(subtotal);
    if (totEl) totEl.textContent = pgFmtMoney(total);
}

async function pgGuardarCompra() {
    const idProv = pgGetId();
    const idCompra = Number(document.getElementById('pgCompraId')?.value || 0);
    const idOc = Number(document.getElementById('pgCompraOc')?.value || 0);
    const fecha = document.getElementById('pgCompraFecha')?.value;
    const errEl = document.getElementById('pgCompraError');

    if (!idOc || !fecha) {
        errEl.textContent = 'Seleccione orden de compra y fecha.';
        errEl.classList.remove('d-none');
        return;
    }
    if (!pgCompraDetalle.some(d => Number(d.CantRecibida) > 0)) {
        errEl.textContent = 'Ingrese cantidad recibida en al menos un ítem.';
        errEl.classList.remove('d-none');
        return;
    }
    errEl.classList.add('d-none');

    return withBusy("#pgBtnGuardarCompra", async () => {
        const subtotal = pgCompraDetalle.reduce((s, d) => s + Number(d.Subtotal ?? 0), 0);
        const descuentos = formatearSinMiles(document.getElementById('pgCompraDescuentos')?.value);

        const payload = {
            Id: idCompra,
            IdUnidadNegocio: Number(document.getElementById('pgCompraIdUN')?.value || 0),
            IdLocal: Number(document.getElementById('pgCompraIdLocal')?.value || 0),
            IdProveedor: idProv,
            IdOrdenCompra: idOc,
            Fecha: fecha,
            NotaInterna: document.getElementById('pgCompraNota')?.value?.trim() || '',
            Subtotal: subtotal,
            Descuentos: descuentos,
            SubtotalFinal: subtotal - descuentos,
            ComprasInsumos: pgCompraDetalle.map(d => ({
                Id: d.IdCompraInsumo || 0,
                IdInsumo: d.IdInsumo,
                IdProveedorLista: d.IdProveedorLista,
                Cantidad: d.CantRecibida,
                PrecioLista: d.PrecioListaOC,
                PrecioFactura: d.PrecioFactura,
                Diferencia: d.PrecioFactura - d.PrecioListaOC,
                PorcDescuento: 0,
                DescuentoUnitario: 0,
                PrecioFinal: d.PrecioFactura,
                DescuentoTotal: 0,
                SubtotalConDescuento: d.Subtotal,
                SubtotalFinal: d.Subtotal,
                IdOrdenCompraInsumo: d.IdOrdenCompraInsumo || null,
                CantidadPedidaOc: d.CantPedida,
                CantidadEntregadaOc: d.CantPedida - d.CantPendienteOC,
                CantidadPendienteOc: d.CantPendienteOC,
                IdEstadoOcInsumo: d.EstadoId,
                EstadoOcNombre: d.EstadoNombre,
                EstadoManualOC: d.EstadoId
            }))
        };

        const isNew = idCompra <= 0;
        const url = isNew ? '/Compras/Insertar' : '/Compras/Actualizar';
        const method = isNew ? 'POST' : 'PUT';

        try {
            let cambios = [];
            try {
                const impacto = await pgFetchJson('/Compras/ImpactoPreciosGuardar', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                cambios = impacto?.cambios || impacto?.Cambios || [];
            } catch (e) {
                console.warn('No se pudo obtener impacto de precios', e);
            }

            const okPrecios = await confirmarImpactoPreciosCompra('guardar', cambios, {
                mensaje: cambios.length
                    ? 'Al aceptar esta compra, estos productos cambiarán de precio en la lista del proveedor:'
                    : (isNew ? '¿Registrar esta compra?' : '¿Guardar los cambios de la compra?')
            });
            if (!okPrecios) return;

            const data = await pgFetchJson(url, { method, body: JSON.stringify(payload) });
            const resp = interpretarRespuestaApi(data);
            if (!resp.valor) {
                errorModal(resp.mensaje || 'No se pudo guardar la compra.');
                return;
            }
            bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalCompra')).hide();
            const msgOk = isNew ? 'Compra registrada correctamente.' : 'Compra actualizada correctamente.';
            const extra = cambios.length
                ? ` Se actualizaron ${cambios.length} precio${cambios.length === 1 ? '' : 's'} de lista.`
                : '';
            exitoModal(msgOk + extra);
            pgTabsLoaded.compras = false;
            pgTabsLoaded.cc = false;
            pgTabsLoaded.precios = false;
            await pgCargarCompras();
            await pgCargarResumen(idProv);
        } catch (err) {
            console.error(err);
            errorModal('Ha ocurrido un error al guardar la compra.');
        }
    });
}

/* ===================== Pagos ===================== */
async function pgInitPagosPanel() {
    if (pgTabsLoaded.pagos) return;
    pgTabsLoaded.pagos = true;
    await pgCargarPagos();
}

async function pgCargarPagos() {
    const id = pgGetId();
    if (id <= 0) return;

    try {
        const [pagos, resumen] = await Promise.all([
            pgFetchJson(`/ProveedoresCuentaCorriente/Pagos?idProveedor=${id}`),
            pgFetchJson(`/ProveedoresCuentaCorriente/Resumen?idProveedor=${id}`).catch(() => null)
        ]);
        pgRenderPagosList(pagos || []);
        pgTogglePagosEmpty(pagos || []);
        pgActualizarPagosCount(pagos?.length ?? 0);
        if (resumen) pgActualizarSaldoPagoDesdeResumen(resumen);
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar el historial de pagos.');
    }
}

function pgActualizarPagosCount(count) {
    const el = document.getElementById('pgPagosCount');
    if (el) el.textContent = `${count ?? 0} pago${count === 1 ? '' : 's'}`;
}

function pgTogglePagosEmpty(data) {
    const empty = document.getElementById('pgPagosEmpty');
    const wrap = document.getElementById('pgPagosListWrap');
    const hasData = Array.isArray(data) && data.length > 0;
    if (empty) empty.classList.toggle('d-none', hasData);
    if (wrap) wrap.classList.toggle('d-none', !hasData);
}

function pgRenderPagosList(pagos) {
    const list = document.getElementById('pgPagosAccordion');
    if (!list) return;

    if (!pagos.length) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = pagos.map((p, i) => {
        const accId = `pgPagoAcc-${p.Id}`;
        const concepto = pgEscHtml(p.Concepto || 'Sin concepto');
        const nota = p.NotaInterna?.trim();
        const cuenta = pgEscHtml(p.Cuenta || '—');
        const usuario = pgEscHtml(p.UsuarioRegistra || '—');
        const open = i === 0;
        return `
        <article class="pg-pago-card${open ? ' is-open' : ''}" data-pago-id="${p.Id}">
            <div class="pg-pago-card-bar">
                <button type="button" class="pg-pago-card-toggle" data-bs-toggle="collapse"
                        data-bs-target="#${accId}" aria-expanded="${open}" aria-controls="${accId}">
                    <span class="pg-pago-card-date" title="Fecha del pago">
                        <span class="pg-pago-card-date-day">${pgFmtDate(p.Fecha)}</span>
                        <span class="pg-pago-card-date-id">#${p.Id}</span>
                    </span>
                    <span class="pg-pago-card-main">
                        <span class="pg-pago-card-concepto">${concepto}</span>
                        <span class="pg-pago-card-chips">
                            <span class="pg-pago-chip"><i class="fa fa-university"></i>${cuenta}</span>
                            <span class="pg-pago-chip"><i class="fa fa-user"></i>${usuario}</span>
                        </span>
                    </span>
                    <span class="pg-pago-card-importe">${pgFmtMoney(p.Importe)}</span>
                    <span class="pg-pago-card-chevron" aria-hidden="true"><i class="fa fa-angle-down"></i></span>
                </button>
                <button type="button" class="pg-action-btn pg-action-btn--delete pg-pago-card-delete"
                        title="Eliminar pago" aria-label="Eliminar pago"
                        onclick="event.stopPropagation(); pgEliminarPago(${p.Id})">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
            <div id="${accId}" class="collapse ${open ? 'show' : ''}">
                <div class="pg-pago-card-body">
                    <div class="pg-pago-detail-grid">
                        <div class="pg-pago-detail">
                            <span class="pg-pago-detail-label">Cuenta de origen</span>
                            <span class="pg-pago-detail-value">${cuenta}</span>
                        </div>
                        <div class="pg-pago-detail">
                            <span class="pg-pago-detail-label">Importe</span>
                            <span class="pg-pago-detail-value pg-pago-detail-importe">${pgFmtMoney(p.Importe)}</span>
                        </div>
                        <div class="pg-pago-detail">
                            <span class="pg-pago-detail-label">Registrado por</span>
                            <span class="pg-pago-detail-value">${usuario}</span>
                        </div>
                        <div class="pg-pago-detail">
                            <span class="pg-pago-detail-label">Fecha de registro</span>
                            <span class="pg-pago-detail-value">${pgFmtDateTime(p.FechaRegistra)}</span>
                        </div>
                        <div class="pg-pago-detail pg-pago-detail--full">
                            <span class="pg-pago-detail-label">Concepto</span>
                            <span class="pg-pago-detail-value">${concepto}</span>
                        </div>
                        ${nota ? `
                        <div class="pg-pago-detail pg-pago-detail--full">
                            <span class="pg-pago-detail-label">Nota interna</span>
                            <span class="pg-pago-detail-value">${pgEscHtml(nota)}</span>
                        </div>` : ''}
                    </div>
                    <div class="pg-pago-card-footer">
                        <button type="button" class="btn btn-sm pg-pago-btn-delete"
                                onclick="pgEliminarPago(${p.Id})">
                            <i class="fa fa-trash me-1"></i> Eliminar pago
                        </button>
                    </div>
                </div>
            </div>
        </article>`;
    }).join('');

    list.querySelectorAll('.collapse').forEach(el => {
        el.addEventListener('show.bs.collapse', () => el.closest('.pg-pago-card')?.classList.add('is-open'));
        el.addEventListener('hide.bs.collapse', () => el.closest('.pg-pago-card')?.classList.remove('is-open'));
    });
}

async function pgEliminarPago(idPago) {
    const id = Number(idPago);
    if (!id) return;

    const ok = await confirmarModal(
        '¿Eliminar este pago? Se revertirá el movimiento en la cuenta corriente.',
        { title: 'Eliminar pago', okText: 'Sí, eliminar', cancelText: 'Cancelar' }
    );
    if (!ok) return;

    try {
        const data = await pgFetchJson(`/ProveedoresCuentaCorriente/EliminarPago?id=${id}`, { method: 'DELETE' });
        const resp = interpretarRespuestaApi(data);
        if (resp.valor) {
            exitoModal(resp.mensaje || 'Pago eliminado.');
            pgTabsLoaded.cc = false;
            await pgCargarPagos();
            await pgCargarResumen(pgGetId());
        } else {
            errorModal(resp.mensaje || 'No se pudo eliminar el pago.');
        }
    } catch (err) {
        console.error(err);
        errorModal('Ha ocurrido un error al eliminar el pago.');
    }
}

async function pgAbrirModalPago() {
    const id = pgGetId();
    if (id <= 0) {
        advertenciaModal('Guarde el proveedor antes de registrar un pago.');
        return;
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const fechaEl = document.getElementById('pgPagoFecha');
    if (fechaEl) fechaEl.value = hoy;
    document.getElementById('pgPagoImporte').value = '';
    document.getElementById('pgPagoConcepto').value = '';
    document.getElementById('pgPagoNota').value = '';

    const selCuenta = document.getElementById('pgPagoCuenta');
    if (selCuenta) {
        selCuenta.classList.remove('is-invalid');
        selCuenta.value = '';
        if (window.jQuery && $(selCuenta).data('select2')) {
            $(selCuenta).val('').trigger('change');
        }
    }

    await Promise.all([pgCargarCuentasPago(), pgActualizarSaldoPago()]);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('pgModalPago')).show();
}

async function pgCargarCuentasPago() {
    const sel = document.getElementById('pgPagoCuenta');
    if (!sel) return;

    try {
        if (window.KyoSelect2?.reload) {
            await KyoSelect2.reload(sel, '/Cuentas/Lista');
        } else {
            const data = await pgFetchJson('/Cuentas/Lista');
            const prev = sel.value;
            const cuentas = data || [];
            sel.innerHTML = '<option value="">Seleccionar cuenta…</option>';
            cuentas.forEach(c => {
                const opt = document.createElement('option');
                opt.value = String(c.Id);
                opt.textContent = c.Nombre || `Cuenta #${c.Id}`;
                sel.appendChild(opt);
            });
            if (prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
        }

        if (window.KyoSelect2?.init) {
            KyoSelect2.init(sel, { dropdownParent: $('#pgModalPago') });
        }
    } catch (err) {
        console.error(err);
        advertenciaModal('No se pudieron cargar las cuentas disponibles.');
    }
}

function pgActualizarSaldoPagoDesdeResumen(resumen) {
    const el = document.getElementById('pgPagoSaldoActual');
    if (!el) return;
    const saldo = Number(resumen?.SaldoActual ?? 0);
    el.textContent = pgFmtMoney(saldo);
    el.classList.remove('positivo', 'negativo', 'cero');
    if (saldo > 0) el.classList.add('positivo');
    else if (saldo < 0) el.classList.add('negativo');
    else el.classList.add('cero');
}

async function pgActualizarSaldoPago() {
    const id = pgGetId();
    const el = document.getElementById('pgPagoSaldoActual');
    if (!el || id <= 0) return;

    try {
        const resumen = await pgFetchJson(`/ProveedoresCuentaCorriente/Resumen?idProveedor=${id}`);
        pgActualizarSaldoPagoDesdeResumen(resumen);
    } catch {
        el.textContent = '—';
    }
}

async function pgRegistrarPago() {
    const id = pgGetId();
    if (id <= 0) {
        advertenciaModal('Guarde el proveedor antes de registrar un pago.');
        return;
    }

    const fecha = document.getElementById('pgPagoFecha')?.value;
    const importe = parseNumeroLoose(document.getElementById('pgPagoImporte')?.value);
    const selCuenta = document.getElementById('pgPagoCuenta');
    const idCuenta = Number(selCuenta?.value || 0);
    const concepto = document.getElementById('pgPagoConcepto')?.value?.trim();
    const nota = document.getElementById('pgPagoNota')?.value?.trim() || '';

    if (!fecha || importe <= 0 || idCuenta <= 0 || !concepto) {
        errorModal('Complete fecha, importe, cuenta de origen y concepto.');
        if (selCuenta && idCuenta <= 0) selCuenta.classList.add('is-invalid');
        return;
    }
    selCuenta?.classList.remove('is-invalid');

    return withBusy("#pgBtnRegistrarPago", async () => {
        const payload = {
            Id: 0,
            IdProveedor: id,
            Fecha: fecha,
            IdCuenta: idCuenta,
            Concepto: concepto,
            Importe: importe,
            NotaInterna: nota
        };

        try {
            const data = await pgFetchJson('/ProveedoresCuentaCorriente/RegistrarPago', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const resp = interpretarRespuestaApi(data);

            if (resp.valor) {
                exitoModal(resp.mensaje || 'Pago registrado correctamente.');
                bootstrap.Modal.getInstance(document.getElementById('pgModalPago'))?.hide();
                document.getElementById('pgPagoImporte').value = '';
                document.getElementById('pgPagoConcepto').value = '';
                document.getElementById('pgPagoNota').value = '';
                if (selCuenta) {
                    selCuenta.value = '';
                    if (window.jQuery && $(selCuenta).data('select2')) {
                        $(selCuenta).val('').trigger('change');
                    }
                }
                pgTabsLoaded.cc = false;
                await pgCargarPagos();
                await pgCargarResumen(id);
            } else {
                errorModal(resp.mensaje || 'No se pudo registrar el pago.');
            }
        } catch (err) {
            console.error(err);
            errorModal('Ha ocurrido un error al registrar el pago.');
        }
    }, { label: "Registrando..." });
}

/* ===================== Análisis del proveedor ===================== */
function pgAxFmtMoney(v, dig = 0) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: dig }).format(Number(v || 0));
}
function pgAxFmtNum(v, dig = 1) {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: dig }).format(Number(v || 0));
}
function pgAxEsc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function pgAxDestroy(key) {
    if (pgAxCharts[key]) { pgAxCharts[key].destroy(); delete pgAxCharts[key]; }
}
function pgAxInitFechas() {
    const desde = document.getElementById("pgAxDesde");
    const hasta = document.getElementById("pgAxHasta");
    if (!desde || !hasta) return;
    if (desde.value && hasta.value) return;
    const hoy = new Date();
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    desde.value = ini.toISOString().slice(0, 10);
    hasta.value = hoy.toISOString().slice(0, 10);
}
function pgAxRenderList(elId, items, mapper, emptyMsg) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!items || !items.length) {
        el.innerHTML = `<div class="pg-ax-empty">${emptyMsg}</div>`;
        return;
    }
    el.innerHTML = items.map(mapper).join("");
}
function pgAxSetText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

async function pgCargarAnalisisProveedor(force) {
    const id = pgGetId();
    if (id <= 0) return;
    if (force) pgTabsLoaded.analisis = false;
    if (pgTabsLoaded.analisis && !force) return;

    pgAxInitFechas();
    const loading = document.getElementById("pgAxLoading");
    loading?.classList.remove("d-none");

    try {
        const desde = document.getElementById("pgAxDesde")?.value || "";
        const hasta = document.getElementById("pgAxHasta")?.value || "";
        const q = new URLSearchParams({ id, fechaDesde: desde, fechaHasta: hasta });
        const data = await pgFetchJson(`/Proveedores/AnalisisProveedor?${q}`);
        pgTabsLoaded.analisis = true;
        pgAxRender(data);
    } catch (err) {
        console.error(err);
        errorModal(err.message || "No se pudo cargar el análisis del proveedor.");
    } finally {
        loading?.classList.add("d-none");
    }
}

function pgAxRenderListItems(elId, items, emptyMsg) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!items || !items.length) {
        el.innerHTML = `<p class="pg-ax-empty-mini">${pgAxEsc(emptyMsg)}</p>`;
        return;
    }
    el.innerHTML = items.map(b => `<li>${pgAxEsc(b)}</li>`).join("");
}

function pgAxRender(data) {
    const v = data.Veredicto || {};
    const k = data.Kpis || {};
    const score = Number(v.Score || 0);
    const color = v.Color || "regular";
    const nombre = (data.Proveedor && data.Proveedor.Nombre) || "Este proveedor";

    const verdict = document.getElementById("pgAxVerdict");
    if (verdict) {
        verdict.className = `pg-ax-verdict is-${color}`;
        verdict.style.setProperty("--pg-ax-deg", `${Math.round(score / 100 * 360)}deg`);
    }
    pgAxSetText("pgAxScore", String(score));
    pgAxSetText("pgAxNivel", v.Nivel || "\u2014");
    pgAxSetText("pgAxTitulo", v.Titulo || "\u2014");

    const resumen = (v.Resumen && String(v.Resumen).trim())
        || `${nombre}: puntaje ${score} de 100. Mir\u00e1 abajo qu\u00e9 juega a favor y qu\u00e9 conviene revisar.`;
    pgAxSetText("pgAxResumen", resumen);
    pgAxSetText("pgAxReco", v.Recomendacion || "Segu\u00ed mirando precios y entregas antes de decidir.");

    pgAxRenderListItems("pgAxAFavor", v.AFavor, "Por ahora no hay se\u00f1ales fuertes a favor en este per\u00edodo.");
    pgAxRenderListItems("pgAxOjoCon", v.OjoCon, "No aparece nada preocupante en este per\u00edodo.");

    pgAxSetText("pgAxKpiComprado", pgAxFmtMoney(k.TotalComprado));
    pgAxSetText("pgAxKpiCant", String(k.CantCompras ?? 0));
    pgAxSetText("pgAxKpiTicket", pgAxFmtMoney(k.TicketPromedio));
    pgAxSetText("pgAxKpiSaldo", pgAxFmtMoney(k.SaldoCc, 2));
    pgAxSetText("pgAxKpiLista", String(k.ItemsLista ?? 0));
    const comparados = (k.MasBarato || 0) + (k.MasCaro || 0);
    pgAxSetText("pgAxKpiBarato", `${k.MasBarato ?? 0} / ${comparados}`);
    pgAxSetText("pgAxKpiSubas", String(k.Subas ?? 0));
    pgAxSetText("pgAxKpiBajas", String(k.Bajas ?? 0));

    pgAxDestroy("serie");
    const serie = data.SerieCompras || [];
    const canvasSerie = document.getElementById("pgAxChartSerie");
    if (canvasSerie && window.Chart) {
        pgAxCharts.serie = new Chart(canvasSerie, {
            type: "line",
            data: {
                labels: serie.map(x => x.Label),
                datasets: [{
                    label: "Compras",
                    data: serie.map(x => x.Total),
                    borderColor: "#e8879f",
                    backgroundColor: "rgba(232,135,159,0.18)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointBackgroundColor: "#c45d78"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: "#7a7088" }, grid: { display: false } },
                    y: { ticks: { color: "#7a7088" }, grid: { color: "rgba(244,164,184,0.12)" } }
                }
            }
        });
    }

    pgAxDestroy("score");
    const comp = v.Componentes || {};
    const canvasScore = document.getElementById("pgAxChartScore");
    if (canvasScore && window.Chart) {
        pgAxCharts.score = new Chart(canvasScore, {
            type: "doughnut",
            data: {
                labels: ["Precios vs mercado", "Estabilidad", "Entregas", "Deuda", "Actividad"],
                datasets: [{
                    data: [
                        Number(comp.Competitividad || 0),
                        Number(comp.Estabilidad || 0),
                        Number(comp.Cumplimiento || 0),
                        Number(comp.Deuda || 0),
                        Number(comp.Actividad || 0)
                    ],
                    backgroundColor: ["#e8879f", "#b5d99c", "#5b9bd5", "#e0a15a", "#c5b3e8"],
                    borderWidth: 2,
                    borderColor: "#fff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom", labels: { color: "#7a7088", font: { size: 11, weight: "600" } } }
                }
            }
        });
    }

    pgAxRenderList("pgAxSubas", data.Subas, a => `
        <div class="pg-ax-item">
            <strong title="${pgAxEsc(a.Nombre)}">${pgAxEsc(a.Nombre)}</strong>
            <span class="up">${pgAxFmtMoney(a.Anterior, 2)} \u2192 ${pgAxFmtMoney(a.Nuevo, 2)} (+${pgAxFmtNum(a.DiffPct)}%)</span>
        </div>`, "Bien: no hubo subas de precio en el per\u00edodo.");

    pgAxRenderList("pgAxBajas", data.Bajas, a => `
        <div class="pg-ax-item">
            <strong title="${pgAxEsc(a.Nombre)}">${pgAxEsc(a.Nombre)}</strong>
            <span class="down">${pgAxFmtMoney(a.Anterior, 2)} \u2192 ${pgAxFmtMoney(a.Nuevo, 2)} (${pgAxFmtNum(a.DiffPct)}%)</span>
        </div>`, "No hubo bajas de precio en el per\u00edodo.");

    pgAxRenderList("pgAxRecomendados", data.Recomendados, a => `
        <div class="pg-ax-item">
            <strong title="${pgAxEsc(a.Nombre)}">${pgAxEsc(a.Nombre)}</strong>
            <span class="down">${pgAxFmtMoney(a.MiPrecio, 2)} \u00b7 ${pgAxFmtNum(a.DiffPct)}% vs mercado</span>
        </div>`, "Todav\u00eda no hay productos claramente m\u00e1s baratos ac\u00e1 (o faltan v\u00ednculos).");

    pgAxRenderList("pgAxCaros", data.Caros, a => `
        <div class="pg-ax-item">
            <strong title="${pgAxEsc(a.Nombre)}">${pgAxEsc(a.Nombre)}</strong>
            <span class="up">${pgAxFmtMoney(a.MiPrecio, 2)} \u00b7 +${pgAxFmtNum(a.DiffPct)}% vs prom.</span>
        </div>`, "Bien: no aparecen productos caros frente a otros proveedores.");

    pgAxRenderList("pgAxDesvios", data.Desvios, a => {
        const up = Number(a.DiffPct) > 0;
        return `<div class="pg-ax-item">
            <strong title="${pgAxEsc(a.Nombre)}">${pgAxEsc(a.Nombre)}</strong>
            <span class="${up ? "up" : "down"}">${pgAxFmtMoney(a.PrecioLista, 2)} \u2192 ${pgAxFmtMoney(a.PrecioFactura, 2)} (${up ? "+" : ""}${pgAxFmtNum(a.DiffPct)}%)</span>
        </div>`;
    }, "Las facturas coincidieron con la lista en este per\u00edodo.");
}
