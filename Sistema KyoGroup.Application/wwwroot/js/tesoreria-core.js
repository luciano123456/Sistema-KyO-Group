/* ============================================================================
 * tesoreria-core.js — Base común de Tesorería (Tablero, Cajas, Gastos, Cuentas)
 *
 * Concentra fetch autenticado, formateo, catálogos cacheados y los renders de
 * badges/importes que las cuatro pantallas comparten. Todo cuelga de window.TS.
 * ========================================================================== */

window.TS = (function () {
    'use strict';

    /* ───────────────────────────── HTTP ───────────────────────────── */

    const jwt = () => localStorage.getItem('JwtToken') || (typeof token !== 'undefined' ? token : '');

    function headers(extra = {}) {
        const t = jwt();
        const base = { 'Content-Type': 'application/json', ...extra };
        return t ? { Authorization: 'Bearer ' + t, ...base } : base;
    }

    async function fetchJson(url, options = {}) {
        const res = await fetch(url, { ...options, headers: headers(options.headers || {}) });

        if (!res.ok) {
            let msg = `${res.status} ${res.statusText}`;
            try { const j = await res.json(); msg = j?.mensaje || j?.title || msg; } catch { /* respuesta sin json */ }
            throw new Error(msg);
        }

        if (res.status === 204) return null;
        const ct = res.headers.get('content-type') || '';
        return ct.includes('application/json') ? res.json() : res.text();
    }

    const get = (url, params) => fetchJson(params ? `${url}?${qs(params)}` : url);
    const post = (url, body) => fetchJson(url, { method: 'POST', body: body == null ? undefined : JSON.stringify(body) });
    const put = (url, body) => fetchJson(url, { method: 'PUT', body: JSON.stringify(body) });
    const del = url => fetchJson(url, { method: 'DELETE' });

    /** Serializa sólo los valores presentes: evita mandar `idCuenta=` vacíos al backend. */
    function qs(obj) {
        const p = new URLSearchParams();
        Object.entries(obj || {}).forEach(([k, v]) => {
            if (v === null || v === undefined || v === '' || v === false) return;
            p.set(k, v === true ? 'true' : v);
        });
        return p.toString();
    }

    /**
     * Ejecuta una acción de escritura y traduce la respuesta estándar
     * ({ valor, mensaje, tipo }) al sistema de toasts del sistema.
     * Devuelve la respuesta si salió bien, o null si falló.
     */
    async function ejecutar(promesa, { exito, silencioso = false } = {}) {
        try {
            const r = await promesa;
            if (r?.valor === false) {
                if (r.tipo === 'validacion' || r.tipo === 'warn') advertenciaModal(r.mensaje);
                else errorModal(r.mensaje || 'No se pudo completar la operación.');
                return null;
            }
            if (!silencioso) exitoModal(exito || r?.mensaje || 'Listo.');
            return r ?? {};
        } catch (err) {
            console.error(err);
            errorModal(err.message || 'Error de comunicación con el servidor.');
            return null;
        }
    }

    /* ───────────────────────────── Formato ───────────────────────────── */

    const nfMoney = new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const nfMoneyCorto = new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', maximumFractionDigits: 0
    });
    const nfNum = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

    const money = v => nfMoney.format(Number(v ?? 0));
    const moneyCorto = v => nfMoneyCorto.format(Number(v ?? 0));
    const num = v => nfNum.format(Number(v ?? 0));

    /**
     * Parsea una fecha. Los strings "yyyy-MM-dd" se interpretan como fecha local:
     * si se dejaran a `new Date()` se leen como UTC y en Argentina se corren un día.
     */
    function parseFecha(v) {
        if (v instanceof Date) return v;
        if (typeof v === 'string') {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
            if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
        }
        return new Date(v);
    }

    function date(v) {
        if (!v) return '';
        const d = parseFecha(v);
        return isNaN(d) ? String(v) : d.toLocaleDateString('es-AR');
    }

    function dateTime(v) {
        if (!v) return '';
        const d = new Date(v);
        if (isNaN(d)) return String(v);
        return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    /** Fecha en formato yyyy-MM-dd para inputs date, sin desfase de zona horaria. */
    function isoDate(v) {
        const d = v ? parseFecha(v) : new Date();
        if (isNaN(d)) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const hoy = () => isoDate(new Date());

    function primerDiaMes() {
        const d = new Date();
        return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }

    function sumarDias(iso, dias) {
        const d = parseFecha(iso);
        d.setDate(d.getDate() + dias);
        return isoDate(d);
    }

    function html(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Lee un input numérico tolerando "1.234,56" y "1234.56". */
    function leerDecimal(el) {
        const raw = (typeof el === 'string' ? el : el?.value) ?? '';
        const txt = String(raw).trim();
        if (!txt) return 0;
        if (/^-?\d+([.,]\d+)?$/.test(txt)) return Number(txt.replace(',', '.')) || 0;
        return Number(txt.replace(/\./g, '').replace(',', '.')) || 0;
    }

    /* ───────────────────────────── Catálogos ───────────────────────────── */

    let cacheCatalogos = null;

    /** Catálogos de tesorería, cacheados por carga de página. */
    function catalogos(refrescar = false) {
        if (refrescar) cacheCatalogos = null;
        cacheCatalogos ??= get('/Tesoreria/Catalogos').catch(err => {
            cacheCatalogos = null;
            throw err;
        });
        return cacheCatalogos;
    }

    window.addEventListener('config:saved', () => { cacheCatalogos = null; });

    /**
     * Llena un <select> preservando la selección previa cuando sigue disponible.
     * @param {string} sel selector del select
     * @param {Array} items origen
     * @param {object} o { value, text, vacio, valorVacio }
     */
    function llenar(sel, items, o = {}) {
        const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
        if (!el) return;

        const value = o.value || 'Id';
        const text = o.text || 'Nombre';
        const previo = el.value;

        const opciones = (items || []).map(i =>
            `<option value="${html(i[value])}">${html(i[text] ?? i.Nombre)}</option>`);

        if (o.vacio !== false)
            opciones.unshift(`<option value="${o.valorVacio ?? ''}">${html(o.vacio || 'Todas')}</option>`);

        el.innerHTML = opciones.join('');
        if (previo && el.querySelector(`option[value="${CSS.escape(previo)}"]`)) el.value = previo;
        if (window.KyoSelect2) window.KyoSelect2.refresh(el);
    }

    function feedbackDeCampo(el) {
        const grupo = el.closest('.input-group');
        const ancla = grupo || el;
        if (ancla.nextElementSibling?.classList.contains('invalid-feedback'))
            return ancla.nextElementSibling;

        const enGrupo = grupo && grupo.nextElementSibling?.classList.contains('invalid-feedback')
            ? grupo.nextElementSibling
            : null;
        if (enGrupo) return enGrupo;

        const padre = el.closest('.ts-col-full, .ts-form-grid > div, .ts-field') || el.parentElement;
        const existente = padre?.querySelector(':scope > .invalid-feedback');
        if (existente) return existente;

        const fb = document.createElement('div');
        fb.className = 'invalid-feedback';
        fb.textContent = 'Campo obligatorio';
        const siguiente = ancla.nextSibling;
        ancla.parentNode.insertBefore(fb, siguiente);
        return fb;
    }

    /** Marca el control y muestra "Campo obligatorio" debajo, como en el resto del sistema. */
    function marcarCampo(el, invalid, msg) {
        if (typeof el === 'string') el = document.querySelector(el);
        if (!el) return;

        el.classList.toggle('is-invalid', !!invalid);
        el.classList.remove('is-valid');

        const plus = el.closest('.input-plus');
        if (plus) plus.classList.toggle('is-invalid', !!invalid);

        try {
            const $el = window.jQuery ? window.jQuery(el) : null;
            if ($el && $el.data && $el.data('select2')) {
                $el.next('.select2-container').find('.select2-selection')
                    .toggleClass('is-invalid', !!invalid);
            }
        } catch { /* noop */ }

        const fb = feedbackDeCampo(el);
        if (!fb) return;
        if (invalid) {
            fb.textContent = msg || 'Campo obligatorio';
            fb.classList.remove('d-none');
            fb.style.display = 'block';
        } else {
            fb.classList.add('d-none');
            fb.style.display = '';
        }
    }

    function limpiarErrores(scope) {
        const root = typeof scope === 'string' ? document.querySelector(scope) : (scope || document);
        if (!root) return;
        root.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        root.querySelectorAll('.input-plus.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        root.querySelectorAll('.select2-selection.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        root.querySelectorAll('.invalid-feedback').forEach(fb => {
            fb.classList.add('d-none');
            fb.style.display = '';
        });
    }

    /* ───────────────────────────── Renders ───────────────────────────── */

    /**
     * Normaliza el nombre de un icono de Font Awesome. Tolera datos guardados con
     * el prefijo "fa-" para no depender de cómo los cargó cada instalación.
     */
    function icono(valor, porDefecto = 'circle-o') {
        const limpio = String(valor || '').trim().replace(/^fa[-\s]+/, '');
        return html(limpio || porDefecto);
    }

    function badge(texto, variante = 'muted', icono) {
        const i = icono ? `<i class="fa fa-${icono}"></i>` : '';
        return `<span class="ts-badge ts-badge--${variante}">${i}${html(texto)}</span>`;
    }

    const VARIANTE_ESTADO_GASTO = { 1: 'amber', 2: 'sky', 3: 'sage', 4: 'muted' };
    const ICONO_ESTADO_GASTO = { 1: 'clock-o', 2: 'adjust', 3: 'check', 4: 'ban' };

    function badgeEstadoGasto(idEstado, etiqueta, vencido) {
        if (vencido && (idEstado === 1 || idEstado === 2))
            return badge('Vencido', 'rose', 'exclamation-triangle');
        return badge(etiqueta || '—', VARIANTE_ESTADO_GASTO[idEstado] || 'muted', ICONO_ESTADO_GASTO[idEstado]);
    }

    const VARIANTE_TIPO_MOV = {
        INGRESO: 'sage', COBRO: 'sage', RECAUDACION: 'sage', TRANSF_ENTRADA: 'sky', APERTURA: 'gold',
        EGRESO: 'rose', GASTO: 'rose', PAGO_PROVEEDOR: 'rose', TRANSF_SALIDA: 'sky',
        AJUSTE: 'violet', AJUSTE_CIERRE: 'violet'
    };

    function badgeTipoMov(tipo, etiqueta) {
        return badge(etiqueta || tipo || '—', VARIANTE_TIPO_MOV[tipo] || 'muted');
    }

    /** Importe con color según sea entrada, salida o vacío. */
    function importe(valor, direccion) {
        const n = Number(valor ?? 0);
        if (!n) return `<span class="ts-amt ts-amt--muted">—</span>`;
        const cls = direccion === 'in' ? 'ts-amt--in' : direccion === 'out' ? 'ts-amt--out' : 'ts-amt--neutral';
        const signo = direccion === 'out' ? '-' : direccion === 'in' ? '+' : '';
        return `<span class="ts-amt ${cls}">${signo}${money(n)}</span>`;
    }

    function saldo(valor) {
        const n = Number(valor ?? 0);
        return `<span class="ts-amt ts-amt--saldo${n < 0 ? ' is-negativo' : ''}">${money(n)}</span>`;
    }

    function vacio(titulo, detalle, icono = 'inbox') {
        return `<div class="ts-empty">
                    <i class="fa fa-${icono}"></i>
                    <strong>${html(titulo)}</strong>
                    ${detalle ? `<span>${html(detalle)}</span>` : ''}
                </div>`;
    }

    function setTexto(id, valor) {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    }

    const setMoney = (id, valor) => setTexto(id, money(valor));

    /** Barra de progreso de pago de un gasto. */
    function progreso(pagado, total) {
        const t = Number(total ?? 0);
        const pct = t > 0 ? Math.min(100, Math.round((Number(pagado ?? 0) / t) * 100)) : 0;
        const cls = pct >= 100 ? '' : ' is-parcial';
        return `<div class="ts-progress${cls}" title="${pct}% pagado"><span style="width:${pct}%"></span></div>`;
    }

    /* ───────────────────────────── Grillas ───────────────────────────── */

    /**
     * Crea o refresca un DataTable con la configuración estándar del sistema.
     * Si cambió la cantidad de columnas lo reconstruye para evitar el error de
     * "Requested unknown parameter" de DataTables.
     */
    function grilla(estado, selector, columnas, rows, extra = {}) {
        const filtros = columnas.map((c, i) => ({
            index: i,
            filterType: 'text',
            placeholder: (c.title || c.data || '') + '…'
        }));

        if (estado.dt && estado.dt.columns().count() !== columnas.length) {
            estado.dt.destroy();
            estado.dt = null;
            $(selector).find('tbody').empty();
        }

        if (!estado.dt) {
            kyoEnsureFilterRow(selector);
            estado.dt = $(selector).DataTable({
                data: rows,
                columns: columnas,
                language: { url: '//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json' },
                pageLength: 25,
                lengthMenu: [[15, 25, 50, 100, -1], [15, 25, 50, 100, 'Todos']],
                orderCellsTop: true,
                scrollX: false,
                autoWidth: false,
                ...extra,
                initComplete: async function () {
                    await kyoBindColumnFilters(this.api(), { columns: filtros, skipIndexes: extra.skipFiltros || [] });
                    extra.initComplete?.call(this);
                }
            });
        } else {
            estado.dt.clear().rows.add(rows).draw(false);
        }

        return estado.dt;
    }

    /* ───────────────────────────── UI ───────────────────────────── */

    function loading(id, mostrar) {
        const el = document.getElementById(id);
        if (el) el.style.display = mostrar ? 'flex' : 'none';
    }

    function modal(sel) {
        const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
        if (!el) return null;
        return bootstrap.Modal.getOrCreateInstance(el);
    }

    /** Marca el chip activo dentro de un grupo y devuelve su valor. */
    function chipActivo(contenedor, el) {
        document.querySelectorAll(`${contenedor} .ts-chip`).forEach(c => c.classList.toggle('active', c === el));
        return el?.dataset.valor ?? '';
    }

    /** Rango de fechas para los presets rápidos de las barras de filtro. */
    function rango(clave) {
        const h = new Date();
        switch (clave) {
            case 'hoy': return { desde: hoy(), hasta: hoy() };
            case 'semana': return { desde: sumarDias(hoy(), -6), hasta: hoy() };
            case 'mes': return { desde: primerDiaMes(), hasta: hoy() };
            case 'mesAnterior': {
                const ini = new Date(h.getFullYear(), h.getMonth() - 1, 1);
                const fin = new Date(h.getFullYear(), h.getMonth(), 0);
                return { desde: isoDate(ini), hasta: isoDate(fin) };
            }
            case 'anio': return { desde: isoDate(new Date(h.getFullYear(), 0, 1)), hasta: hoy() };
            default: return { desde: '', hasta: '' };
        }
    }

    return {
        fetchJson, get, post, put, del, qs, ejecutar, headers,
        money, moneyCorto, num, date, dateTime, isoDate, parseFecha, hoy, primerDiaMes, sumarDias,
        html, leerDecimal,
        catalogos, llenar, marcarCampo, limpiarErrores,
        badge, badgeEstadoGasto, badgeTipoMov, importe, saldo, vacio, progreso, icono,
        setTexto, setMoney, grilla, loading, modal, chipActivo, rango
    };
})();
