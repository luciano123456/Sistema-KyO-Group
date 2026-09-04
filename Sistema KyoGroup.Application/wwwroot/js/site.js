const token = localStorage.getItem('JwtToken');

/* =========================================================
   Busy lock (anti doble-submit) — estilo Mercado Pago / OroAmbiental
   Uso:
     await withBusy(btn, async () => { ... });
     await withBusy('#btnGuardar', async () => { ... });
     $("#btnX").on("click", busyHandler(fn));
     onclick="withBusy(this, () => guardarX())"
========================================================= */

function resolveBusyEl(btn) {
    if (!btn) return null;
    if (typeof btn === "string") {
        try { return document.querySelector(btn); } catch { return null; }
    }
    if (btn.jquery) return btn[0] || null;
    if (btn instanceof Element) return btn;
    return null;
}

function isBusy(btn) {
    const el = resolveBusyEl(btn);
    return !!(el && el.dataset.busyActive === "1");
}

function setBusyButton(btn, loading, opts = {}) {
    const el = resolveBusyEl(btn);
    if (!el) return;

    if (loading) {
        if (el.dataset.busyActive === "1") return;
        el.dataset.busyActive = "1";
        el.dataset.busyPrevDisabled = el.disabled ? "1" : "0";
        el.dataset.busyPrevHtml = el.innerHTML;
        el.disabled = true;
        el.setAttribute("aria-busy", "true");
        el.classList.add("is-busy");
        if (opts.loadingHtml !== false) {
            const label = opts.label || "Guardando...";
            el.innerHTML = opts.loadingHtml
                || `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>${label}`;
        }
        return;
    }

    if (el.dataset.busyActive !== "1") return;
    el.dataset.busyActive = "0";
    el.disabled = el.dataset.busyPrevDisabled === "1";
    el.removeAttribute("aria-busy");
    el.classList.remove("is-busy");
    if (el.dataset.busyPrevHtml != null) {
        el.innerHTML = el.dataset.busyPrevHtml;
    }
    delete el.dataset.busyPrevDisabled;
    delete el.dataset.busyPrevHtml;
}

/**
 * Bloquea el boton hasta que termine la promesa. Si ya esta ocupado, no vuelve a ejecutar.
 * @returns {Promise<*>} resultado de fn, o undefined si se ignoro por busy
 */
async function withBusy(btn, fn, opts = {}) {
    if (typeof fn !== "function") return;

    const el = resolveBusyEl(btn);
    if (el && el.dataset.busyActive === "1") return;

    setBusyButton(el, true, opts);
    try {
        return await fn();
    } finally {
        setBusyButton(el, false);
    }
}

/** Handler de click que aplica withBusy sobre e.currentTarget / this */
function busyHandler(fn, opts = {}) {
    return async function (e) {
        const btn = opts.button
            || (e && e.currentTarget instanceof Element ? e.currentTarget : null)
            || (this instanceof Element ? this : null);
        return withBusy(btn, () => fn.call(this, e), opts);
    };
}

window.resolveBusyEl = resolveBusyEl;
window.isBusy = isBusy;
window.setBusyButton = setBusyButton;
window.withBusy = withBusy;
window.busyHandler = busyHandler;

/* =========================================================
   Bridge jQuery .modal() → Bootstrap 5
   (Bootstrap 5 ya no trae $.fn.modal; sin esto Nuevo/Editar fallan)
   ========================================================= */
(function patchJqueryBootstrapModal() {
    const $ = window.jQuery;
    if (!$ || !$.fn) return;

    const callBs = function (elements, action, opts) {
        elements.each(function () {
            if (!window.bootstrap?.Modal) return;
            const inst = bootstrap.Modal.getOrCreateInstance(this, opts || {});
            if (action === 'show') inst.show();
            else if (action === 'hide') inst.hide();
            else if (action === 'toggle') inst.toggle();
            else if (action === 'dispose') inst.dispose();
            else if (action === 'handleUpdate') inst.handleUpdate?.();
        });
        return elements;
    };

    // Si ya existe (p.ej. Bootstrap 4), no pisar.
    if (typeof $.fn.modal === 'function' && !$.fn.modal.__kyoBs5Bridge) return;

    $.fn.modal = function (action) {
        if (typeof action === 'undefined') {
            return callBs(this, null, {});
        }
        if (typeof action === 'object') {
            // $('#x').modal({ backdrop:false }).modal('show')
            this.each(function () {
                if (!window.bootstrap?.Modal) return;
                bootstrap.Modal.getOrCreateInstance(this, action);
            });
            return this;
        }
        if (typeof action === 'string') {
            return callBs(this, action, {});
        }
        return this;
    };
    $.fn.modal.__kyoBs5Bridge = true;
})();

async function MakeAjax(options) {
    return $.ajax({
        type: options.type,
        url: options.url,
        async: options.async,
        data: options.data,
        dataType: options.dataType,
        contentType: options.contentType
    });
}


async function MakeAjaxFormData(options) {
    return $.ajax({
        type: options.type,
        url: options.url,
        async: options.async,
        data: options.data,
        dataType: false,
        contentType: false,
        isFormData: true,
        processData: false
    });
}


// Formatear el número de manera correcta
function formatNumber(number) {
    if (typeof number !== 'number' || isNaN(number)) {
        return "$ 0,00"; // Si el número no es válido, retornar un valor por defecto
    }

    // Asegurarse de que el número tenga dos decimales
    const parts = number.toFixed(2).split("."); // Dividir en parte entera y decimal

    // Formatear la parte entera con puntos como separadores de miles
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "."); // Usar punto para miles

    // Devolver el número con la coma como separador decimal
    return "$ " + parts.join(",");
}



/* =========================================================
   KyO Toasts — reemplazo de modales de sistema / alerts
   ========================================================= */
const KyoToast = (() => {
    const ICONS = {
        success: 'fa-check',
        error: 'fa-exclamation',
        warn: 'fa-exclamation-triangle',
        info: 'fa-info',
        confirm: 'fa-question'
    };
    const TITLES = {
        success: 'Éxito',
        error: 'Error',
        warn: 'Atención',
        info: 'Info',
        confirm: 'Confirmación'
    };
    const DEFAULT_MS = {
        success: 2800,
        error: 5200,
        warn: 4200,
        info: 3800
    };

    let host = null;
    let confirmBusy = null;

    function ensureHost() {
        if (host && document.body.contains(host)) return host;
        host = document.getElementById('kyoToastHost');
        if (!host) {
            host = document.createElement('div');
            host.id = 'kyoToastHost';
            host.setAttribute('aria-live', 'polite');
            host.setAttribute('aria-relevant', 'additions');
            document.body.appendChild(host);
        }
        return host;
    }

    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function dismiss(el, onDone) {
        if (!el || el.classList.contains('is-out')) return;
        el.classList.remove('is-in');
        el.classList.add('is-out');
        const finish = () => {
            el.remove();
            if (typeof onDone === 'function') onDone();
        };
        el.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, 420);
    }

    function show(type, message, opts = {}) {
        const t = TITLES[type] ? type : 'info';
        const duration = opts.duration ?? DEFAULT_MS[t] ?? 3800;
        const title = opts.title || TITLES[t];
        const root = ensureHost();
        const allowHtml = !!opts.html;
        const actionHtml = opts.actionHtml || '';

        const el = document.createElement('div');
        el.className = `kyo-toast kyo-toast--${t}`;
        el.setAttribute('role', t === 'error' ? 'alert' : 'status');
        el.innerHTML = `
            <div class="kyo-toast__inner">
                <div class="kyo-toast__icon" aria-hidden="true"><i class="fa ${ICONS[t]}"></i></div>
                <div class="kyo-toast__body">
                    <p class="kyo-toast__title">${esc(title)}</p>
                    <p class="kyo-toast__msg">${allowHtml ? String(message ?? '') : esc(message)}</p>
                </div>
                <button type="button" class="kyo-toast__close" aria-label="Cerrar"><i class="fa fa-times"></i></button>
            </div>
            ${actionHtml ? `<div class="kyo-toast__actions">${actionHtml}</div>` : ''}
            <div class="kyo-toast__progress" aria-hidden="true"><span style="animation-duration:${Math.max(duration, 1)}ms"></span></div>
        `;

        const closeBtn = el.querySelector('.kyo-toast__close');
        let timer = null;
        const close = () => {
            if (timer) clearTimeout(timer);
            dismiss(el);
        };
        closeBtn.addEventListener('click', close);

        root.appendChild(el);
        requestAnimationFrame(() => el.classList.add('is-in'));

        if (duration > 0) {
            timer = setTimeout(close, duration);
            el.addEventListener('mouseenter', () => {
                if (timer) clearTimeout(timer);
                const bar = el.querySelector('.kyo-toast__progress > span');
                if (bar) bar.style.animationPlayState = 'paused';
            });
            el.addEventListener('mouseleave', () => {
                const bar = el.querySelector('.kyo-toast__progress > span');
                if (bar) bar.style.animationPlayState = 'running';
                timer = setTimeout(close, Math.max(900, duration * 0.35));
            });
        }

        return el;
    }

    function confirm(message, opts = {}) {
        if (confirmBusy) return confirmBusy;

        confirmBusy = new Promise((resolve) => {
            let root = document.getElementById('kyoConfirmRoot');
            if (!root) {
                root = document.createElement('div');
                root.id = 'kyoConfirmRoot';
                root.innerHTML = `
                    <div class="kyo-confirm__scrim" data-kyo-confirm-scrim></div>
                    <div class="kyo-confirm__card" role="alertdialog" aria-modal="true" aria-labelledby="kyoConfirmTitle" aria-describedby="kyoConfirmMsg">
                        <div class="kyo-confirm__shine" aria-hidden="true"></div>
                        <div class="kyo-confirm__body">
                            <div class="kyo-confirm__badge" aria-hidden="true"><i class="fa fa-question"></i></div>
                            <h3 class="kyo-confirm__title" id="kyoConfirmTitle"></h3>
                            <p class="kyo-confirm__msg" id="kyoConfirmMsg"></p>
                            <ul class="kyo-confirm__list d-none" id="kyoConfirmList"></ul>
                            <div class="kyo-confirm__actions">
                                <button type="button" class="kyo-confirm__btn kyo-confirm__btn--ghost" data-kyo-confirm-cancel>Cancelar</button>
                                <button type="button" class="kyo-confirm__btn kyo-confirm__btn--primary" data-kyo-confirm-ok>Sí, continuar</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(root);
            }

            const title = opts.title || TITLES.confirm;
            const okText = opts.okText || 'Sí, continuar';
            const cancelText = opts.cancelText || 'Cancelar';
            root.querySelector('#kyoConfirmTitle').textContent = title;
            root.querySelector('#kyoConfirmMsg').textContent = message || '¿Deseás continuar?';
            root.querySelector('[data-kyo-confirm-ok]').textContent = okText;
            root.querySelector('[data-kyo-confirm-cancel]').textContent = cancelText;

            let listEl = root.querySelector('#kyoConfirmList');
            if (!listEl) {
                const msgEl = root.querySelector('#kyoConfirmMsg');
                listEl = document.createElement('ul');
                listEl.className = 'kyo-confirm__list d-none';
                listEl.id = 'kyoConfirmList';
                msgEl?.after(listEl);
            }
            const items = Array.isArray(opts.list) ? opts.list : [];
            if (listEl) {
                listEl.innerHTML = '';
                if (items.length === 0) {
                    listEl.classList.add('d-none');
                } else {
                    listEl.classList.remove('d-none');
                    items.forEach((item) => {
                        const li = document.createElement('li');
                        li.className = 'kyo-confirm__list-item';
                        if (typeof item === 'string') {
                            li.textContent = item;
                        } else {
                            const nombre = item.nombre || item.Nombre || item.label || '';
                            const desde = item.desde ?? item.from ?? item.PrecioActual;
                            const hasta = item.hasta ?? item.to ?? item.PrecioNuevo;
                            if (desde != null && hasta != null) {
                                const fmt = (typeof window.pgFmtMoney === 'function')
                                    ? window.pgFmtMoney
                                    : (typeof window.fmtMoney === 'function')
                                        ? window.fmtMoney
                                        : (n) => `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                li.innerHTML = `<strong>${esc(nombre)}</strong><span>${esc(fmt(desde))} → ${esc(fmt(hasta))}</span>`;
                            } else {
                                li.textContent = nombre || String(item);
                            }
                        }
                        listEl.appendChild(li);
                    });
                }
            }

            let done = false;
            const onKey = (e) => {
                if (e.key === 'Escape') finish(false);
                else if (e.key === 'Enter') finish(true);
            };
            const finish = (val) => {
                if (done) return;
                done = true;
                document.removeEventListener('keydown', onKey);
                root.classList.remove('is-open');
                const end = () => {
                    confirmBusy = null;
                    resolve(val);
                };
                setTimeout(end, 220);
            };

            root.querySelector('[data-kyo-confirm-ok]').onclick = () => finish(true);
            root.querySelector('[data-kyo-confirm-cancel]').onclick = () => finish(false);
            root.querySelector('[data-kyo-confirm-scrim]').onclick = () => finish(false);
            document.addEventListener('keydown', onKey);

            requestAnimationFrame(() => root.classList.add('is-open'));
            setTimeout(() => root.querySelector('[data-kyo-confirm-ok]')?.focus(), 40);
        });

        return confirmBusy;
    }

    return { show, confirm };
})();

function mostrarModalConContador(_modal, texto, tiempo) {
    // Compat: ya no usa Bootstrap modals
    const map = {
        exitoModal: 'success',
        ErrorModal: 'error',
        AdvertenciaModal: 'warn'
    };
    const type = map[_modal] || 'info';
    KyoToast.show(type, texto, { duration: tiempo || undefined });
}

function exitoModal(texto) {
    KyoToast.show('success', texto || 'Operación realizada correctamente', { duration: 2800 });
}

function errorModal(texto) {
    KyoToast.show('error', texto || 'Ha ocurrido un error', { duration: 5200 });
}

function advertenciaModal(texto) {
    KyoToast.show('warn', texto || 'Atención', { duration: 4200 });
}

function infoToast(texto) {
    KyoToast.show('info', texto || '', { duration: 3800 });
}

function confirmarModal(mensaje, opts) {
    return KyoToast.confirm(mensaje || '¿Deseás continuar?', opts || {});
}

/**
 * Confirma guardado/eliminación de compra mostrando cambios de precio de lista (X → Y).
 * @param {'guardar'|'eliminar'} modo
 * @param {Array} cambios { Nombre/nombre, PrecioActual, PrecioNuevo }
 */
async function confirmarImpactoPreciosCompra(modo, cambios, opts = {}) {
    const items = Array.isArray(cambios) ? cambios : [];
    const esEliminar = modo === 'eliminar';
    const msgBase = opts.mensaje
        || (esEliminar
            ? (items.length
                ? 'Al eliminar esta compra se revertirán estos precios de lista:'
                : '¿Desea eliminar esta compra?')
            : (items.length
                ? 'Al aceptar esta compra se actualizarán estos precios de lista:'
                : '¿Desea guardar esta compra?'));

    const list = items.map(c => ({
        nombre: c.Nombre || c.nombre || c.label || 'Producto',
        desde: c.PrecioActual ?? c.precioActual ?? c.desde,
        hasta: c.PrecioNuevo ?? c.precioNuevo ?? c.hasta
    }));

    return confirmarModal(msgBase, {
        title: opts.title || (esEliminar ? 'Eliminar compra' : 'Actualizar precios'),
        okText: opts.okText || (esEliminar ? 'Sí, eliminar' : 'Sí, continuar'),
        cancelText: opts.cancelText || 'Cancelar',
        list
    });
}

/**
 * Modal de eliminación en cascada (estilo oro ambiental).
 * Lista dependencias y pregunta si se desea borrar todo.
 * @returns {Promise<boolean>}
 */
function kyoConfirmarCascada(opts = {}) {
    const titulo = opts.titulo || 'Registros asociados';
    const mensaje = opts.mensaje
        || 'Este registro tiene asociaciones. ¿Deseás eliminar todo en cascada?';
    const deps = Array.isArray(opts.dependencias) ? opts.dependencias : [];
    const labelSi = opts.labelSi || 'Sí, eliminar todo';
    const labelNo = opts.labelNo || 'Cancelar';
    const subSi = opts.subSi || 'Borra el registro y sus dependencias';
    const subNo = opts.subNo || 'No se elimina nada';

    return new Promise((resolve) => {
        let root = document.getElementById('kyoCascadeRoot');
        if (!root) {
            root = document.createElement('div');
            root.id = 'kyoCascadeRoot';
            root.innerHTML = `
                <div class="kyo-cascade__scrim" data-kyo-cas-scrim></div>
                <div class="kyo-cascade__card" role="dialog" aria-modal="true" aria-labelledby="kyoCascadeTitle">
                    <div class="kyo-cascade__shine" aria-hidden="true"></div>
                    <div class="kyo-cascade__body">
                        <div class="kyo-cascade__badge" aria-hidden="true"><i class="fa fa-exclamation-triangle"></i></div>
                        <h3 class="kyo-cascade__title" id="kyoCascadeTitle"></h3>
                        <p class="kyo-cascade__msg" id="kyoCascadeMsg"></p>
                        <ul class="kyo-cascade__deps" id="kyoCascadeDeps"></ul>
                        <div class="kyo-cascade__actions">
                            <button type="button" class="kyo-cascade__choice kyo-cascade__choice--danger" data-kyo-cas="si">
                                <i class="fa fa-trash"></i>
                                <strong data-kyo-cas-label-si></strong>
                                <small data-kyo-cas-sub-si></small>
                            </button>
                            <button type="button" class="kyo-cascade__choice kyo-cascade__choice--ghost" data-kyo-cas="no">
                                <i class="fa fa-times"></i>
                                <strong data-kyo-cas-label-no></strong>
                                <small data-kyo-cas-sub-no></small>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(root);
        }

        root.querySelector('#kyoCascadeTitle').textContent = titulo;
        root.querySelector('#kyoCascadeMsg').textContent = mensaje;

        const ul = root.querySelector('#kyoCascadeDeps');
        ul.innerHTML = '';
        if (deps.length === 0) {
            ul.innerHTML = '<li class="kyo-cascade__dep">Registros relacionados en el sistema</li>';
        } else {
            deps.forEach((d) => {
                const li = document.createElement('li');
                li.className = 'kyo-cascade__dep';
                const entidad = d.entidad || d.Entidad || 'Relación';
                const cantidad = d.cantidad ?? d.Cantidad ?? '';
                const detalle = d.detalle || d.Detalle || '';
                const cantTxt = cantidad !== '' && cantidad != null ? ` (${cantidad})` : '';
                li.innerHTML = `<strong>${entidad}${cantTxt}</strong>${detalle ? `<span>${detalle}</span>` : ''}`;
                ul.appendChild(li);
            });
        }

        let done = false;
        const onKey = (e) => {
            if (e.key === 'Escape') finish(false);
        };
        const finish = (val) => {
            if (done) return;
            done = true;
            document.removeEventListener('keydown', onKey);
            root.classList.remove('is-open');
            setTimeout(() => resolve(!!val), 220);
        };

        const btnSi = root.querySelector('[data-kyo-cas="si"]');
        const btnNo = root.querySelector('[data-kyo-cas="no"]');
        const scrim = root.querySelector('[data-kyo-cas-scrim]');

        const newSi = btnSi.cloneNode(true);
        const newNo = btnNo.cloneNode(true);
        const newScrim = scrim.cloneNode(true);
        btnSi.replaceWith(newSi);
        btnNo.replaceWith(newNo);
        scrim.replaceWith(newScrim);

        newSi.querySelector('[data-kyo-cas-label-si]').textContent = labelSi;
        newSi.querySelector('[data-kyo-cas-sub-si]').textContent = subSi;
        newNo.querySelector('[data-kyo-cas-label-no]').textContent = labelNo;
        newNo.querySelector('[data-kyo-cas-sub-no]').textContent = subNo;

        newSi.addEventListener('click', () => finish(true));
        newNo.addEventListener('click', () => finish(false));
        newScrim.addEventListener('click', () => finish(false));
        document.addEventListener('keydown', onKey);

        requestAnimationFrame(() => root.classList.add('is-open'));
    });
}

/**
 * Flujo estándar de eliminación con oferta de cascada.
 * opts: { url, id, confirmMsg, method, headers, onSuccess, buildUrl }
 */
async function eliminarConCascada(opts = {}) {
    const id = opts.id;
    const confirmMsg = opts.confirmMsg || '¿Desea eliminar este registro?';
    const method = opts.method || 'DELETE';
    const headersFn = typeof opts.headers === 'function'
        ? opts.headers
        : () => (opts.headers || (typeof authHeaders === 'function' ? authHeaders() : {}));

    const buildUrl = typeof opts.buildUrl === 'function'
        ? opts.buildUrl
        : (cascade) => {
            const base = opts.url || '';
            const sep = base.includes('?') ? '&' : '?';
            let u = base;
            if (id != null && !/[?&]id=/.test(base))
                u += `${sep}id=${encodeURIComponent(id)}`;
            if (cascade) {
                u += (u.includes('?') ? '&' : '?') + 'cascade=true';
            }
            return u;
        };

    const okConfirm = await confirmarModal(confirmMsg, opts.confirmOpts || {
        title: 'Eliminar',
        okText: 'Sí, eliminar',
        cancelText: 'Cancelar'
    });
    if (!okConfirm) return false;

    const doDelete = async (cascade) => {
        const r = await fetch(buildUrl(cascade), {
            method,
            headers: headersFn(cascade)
        });
        if (!r.ok) throw new Error(await r.text().catch(() => 'Error al eliminar.'));
        return await r.json();
    };

    try {
        let j = await doDelete(false);
        if (j?.valor) {
            if (typeof opts.onSuccess === 'function') await opts.onSuccess(j);
            else if (typeof exitoModal === 'function') exitoModal(j.mensaje || 'Eliminado correctamente');
            return true;
        }

        const esRelacion = (j?.tipo === 'relacion' || j?.Tipo === 'relacion')
            || (Array.isArray(j?.dependencias) && j.dependencias.length > 0)
            || (Array.isArray(j?.Dependencias) && j.Dependencias.length > 0);
        const cascadeOk = j?.cascadeDisponible === true || j?.CascadeDisponible === true;
        const deps = j?.dependencias || j?.Dependencias || [];

        if (esRelacion && cascadeOk) {
            const aceptar = await kyoConfirmarCascada({
                titulo: opts.cascadeTitulo || 'No se puede eliminar directamente',
                mensaje: j.mensaje || j.Mensaje
                    || 'Tiene registros asociados. ¿Deseás eliminar todo en cascada?',
                dependencias: deps,
                labelSi: opts.cascadeLabelSi,
                subSi: opts.cascadeSubSi,
                labelNo: opts.cascadeLabelNo,
                subNo: opts.cascadeSubNo
            });
            if (!aceptar) return false;

            j = await doDelete(true);
            if (j?.valor) {
                if (typeof opts.onSuccess === 'function') await opts.onSuccess(j);
                else if (typeof exitoModal === 'function') exitoModal(j.mensaje || 'Eliminado en cascada correctamente');
                return true;
            }
            if (typeof errorModal === 'function')
                errorModal(j?.mensaje || j?.Mensaje || 'No se pudo eliminar en cascada.');
            return false;
        }

        if (typeof advertenciaModal === 'function')
            advertenciaModal(j?.mensaje || j?.Mensaje || 'No se pudo eliminar');
        else if (typeof errorModal === 'function')
            errorModal(j?.mensaje || j?.Mensaje || 'No se pudo eliminar');
        return false;
    } catch (e) {
        console.error(e);
        if (typeof errorModal === 'function')
            errorModal(e.message || 'Ha ocurrido un error al eliminar.');
        return false;
    }
}

window.kyoConfirmarCascada = kyoConfirmarCascada;
window.eliminarConCascada = eliminarConCascada;

/**
 * Modal post-guardado (estilo oro ambiental).
 * @returns {Promise<'listado'|'editar'>}
 * opts: { titulo, mensaje, labelListado, labelEditar, subListado, subEditar }
 */
function kyoDespuesGuardar(opts = {}) {
    const titulo = opts.titulo || 'Guardado correctamente';
    const mensaje = opts.mensaje || '¿Qué querés hacer ahora?';
    const labelListado = opts.labelListado || 'Ir a la pantalla principal';
    const labelEditar = opts.labelEditar || 'Seguir editando';
    const subListado = opts.subListado || 'Volver al listado';
    const subEditar = opts.subEditar || 'Quedarme en esta pantalla';

    return new Promise((resolve) => {
        let root = document.getElementById('kyoAfterSaveRoot');
        if (!root) {
            root = document.createElement('div');
            root.id = 'kyoAfterSaveRoot';
            root.innerHTML = `
                <div class="kyo-after-save__scrim" data-kyo-as-scrim></div>
                <div class="kyo-after-save__card" role="dialog" aria-modal="true" aria-labelledby="kyoAfterSaveTitle">
                    <div class="kyo-after-save__shine" aria-hidden="true"></div>
                    <div class="kyo-after-save__body">
                        <div class="kyo-after-save__badge" aria-hidden="true"><i class="fa fa-check"></i></div>
                        <h3 class="kyo-after-save__title" id="kyoAfterSaveTitle"></h3>
                        <p class="kyo-after-save__msg" id="kyoAfterSaveMsg"></p>
                        <div class="kyo-after-save__actions">
                            <button type="button" class="kyo-after-save__choice kyo-after-save__choice--primary" data-kyo-as="listado">
                                <i class="fa fa-home"></i>
                                <strong data-kyo-as-label-listado></strong>
                                <small data-kyo-as-sub-listado></small>
                            </button>
                            <button type="button" class="kyo-after-save__choice kyo-after-save__choice--ghost" data-kyo-as="editar">
                                <i class="fa fa-pencil"></i>
                                <strong data-kyo-as-label-editar></strong>
                                <small data-kyo-as-sub-editar></small>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(root);
        }

        root.querySelector('#kyoAfterSaveTitle').textContent = titulo;
        root.querySelector('#kyoAfterSaveMsg').textContent = mensaje;
        root.querySelector('[data-kyo-as-label-listado]').textContent = labelListado;
        root.querySelector('[data-kyo-as-label-editar]').textContent = labelEditar;
        root.querySelector('[data-kyo-as-sub-listado]').textContent = subListado;
        root.querySelector('[data-kyo-as-sub-editar]').textContent = subEditar;

        let done = false;
        const onKey = (e) => {
            if (e.key === 'Escape') finish('editar');
        };
        const finish = (val) => {
            if (done) return;
            done = true;
            document.removeEventListener('keydown', onKey);
            root.classList.remove('is-open');
            setTimeout(() => resolve(val), 220);
        };

        const onListado = () => finish('listado');
        const onEditar = () => finish('editar');
        const onScrim = () => finish('editar');

        const btnListado = root.querySelector('[data-kyo-as="listado"]');
        const btnEditar = root.querySelector('[data-kyo-as="editar"]');
        const scrim = root.querySelector('[data-kyo-as-scrim]');

        // Clonar nodos para limpiar listeners previos
        const newListado = btnListado.cloneNode(true);
        const newEditar = btnEditar.cloneNode(true);
        const newScrim = scrim.cloneNode(true);
        btnListado.replaceWith(newListado);
        btnEditar.replaceWith(newEditar);
        scrim.replaceWith(newScrim);

        // Reaplicar textos (por si el clone vino de un open anterior con otros labels)
        newListado.querySelector('[data-kyo-as-label-listado]').textContent = labelListado;
        newListado.querySelector('[data-kyo-as-sub-listado]').textContent = subListado;
        newEditar.querySelector('[data-kyo-as-label-editar]').textContent = labelEditar;
        newEditar.querySelector('[data-kyo-as-sub-editar]').textContent = subEditar;

        newListado.addEventListener('click', onListado);
        newEditar.addEventListener('click', onEditar);
        newScrim.addEventListener('click', onScrim);
        document.addEventListener('keydown', onKey);

        requestAnimationFrame(() => root.classList.add('is-open'));
    });
}

// Sustituye alerts nativos en todo el sistema
(function patchNativeDialogs() {
    try {
        window.alert = function (msg) {
            advertenciaModal(String(msg ?? ''));
        };
    } catch { /* ignore */ }
})();

function debounce(fn, ms = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

/** Lee un query param entero (>0) de la URL actual. Ej: kyoQueryInt('duplicar') */
function kyoQueryInt(name) {
    try {
        const n = Number(new URLSearchParams(window.location.search).get(name) || 0);
        return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
        return 0;
    }
}

/** Sufijo estándar para copias de ABM */
function kyoTextoCopia(texto) {
    const t = String(texto ?? '').trim();
    if (!t) return '(copia)';
    return t.toLowerCase().endsWith('(copia)') ? t : `${t} (copia)`;
}

window.ensureKyoExportLibs = (function () {
    let loading = null;
    const scripts = [
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.3/jszip.min.js',
        'https://cdn.datatables.net/buttons/2.2.2/js/buttons.html5.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.53/pdfmake.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.53/vfs_fonts.js',
        'https://cdn.datatables.net/buttons/2.2.2/js/buttons.print.min.js'
    ];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector('script[src="' + src + '"]')) {
                resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    return function ensureLoaded() {
        if (!loading) {
            loading = Promise.resolve();
            scripts.forEach(src => {
                loading = loading.then(() => loadScript(src));
            });
        }
        return loading;
    };
})();

window.ensureKyoXlsx = (function () {
    let loading = null;
    const src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    return function ensureXlsx() {
        if (window.XLSX) return Promise.resolve();
        if (!loading) {
            loading = new Promise((resolve, reject) => {
                if (document.querySelector('script[src="' + src + '"]')) {
                    resolve();
                    return;
                }
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        return loading;
    };
})();

const formatoMoneda = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
});

function convertirMonedaAFloat(moneda) {
    // Eliminar el símbolo de la moneda y otros caracteres no numéricos
    const soloNumeros = moneda.replace(/[^0-9,.-]/g, '');

    // Eliminar separadores de miles y convertir la coma en punto
    const numeroFormateado = soloNumeros.replace(/\./g, '').replace(',', '.');

    // Convertir a flotante
    const numero = parseFloat(numeroFormateado);

    // Devolver el número formateado como cadena, asegurando los decimales
    return numero.toFixed(2); // Asegura siempre dos decimales en la salida
}
function convertirAMonedaDecimal(valor) {
    // Reemplazar coma por punto
    if (typeof valor === 'string') {
        valor = valor.replace(',', '.'); // Cambiar la coma por el punto
    }
    // Convertir a número flotante
    return parseFloat(valor);
}

function formatoNumero(valor) {
    // Reemplaza la coma por punto y elimina otros caracteres no numéricos (como $)
    return parseFloat(valor.replace(/[^0-9,]+/g, '').replace(',', '.')) || 0;
}

function parseDecimal(value) {
    return parseFloat(value.replace(',', '.'));
}


function formatMoneda(valor) {
    // Convertir a string, cambiar el punto decimal a coma y agregar separadores de miles
    let formateado = valor
        .toString()
        .replace('.', ',') // Cambiar punto decimal a coma
        .replace(/\B(?=(\d{3})+(?!\d))/g, "."); // Agregar separadores de miles

    // Agregar el símbolo $ al inicio
    return `$ ${formateado}`;
}


function toggleAcciones(id) {
    const dropdown = document.querySelector(`.acciones-menu[data-id='${id}'] .acciones-dropdown`);
    const isVisible = dropdown.style.display === 'block';

    // Oculta todos los demás menús desplegables
    document.querySelectorAll('.acciones-dropdown').forEach(el => el.style.display = 'none');

    if (!isVisible) {
        // Muestra el menú
        dropdown.style.display = 'block';

        // Obtén las coordenadas del botón
        const menuButton = document.querySelector(`.acciones-menu[data-id='${id}']`);
        const rect = menuButton.getBoundingClientRect();

        // Mueve el menú al body y ajusta su posición
        const dropdownClone = dropdown.cloneNode(true);
        dropdownClone.style.position = 'fixed';
        dropdownClone.style.left = `${rect.left}px`;
        dropdownClone.style.top = `${rect.bottom}px`;
        dropdownClone.style.zIndex = '10000';
        dropdownClone.style.display = 'block';

        // Limpia menús previos si es necesario
        document.querySelectorAll('.acciones-dropdown-clone').forEach(clone => clone.remove());

        dropdownClone.classList.add('acciones-dropdown-clone');
        document.body.appendChild(dropdownClone);
    }
}



function formatearFechaParaInput(fecha) {
    const m = moment(fecha, [moment.ISO_8601, 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD']);
    return m.isValid() ? m.format('YYYY-MM-DD') : '';
}

function formatearFechaParaVista(fecha) {
    const m = moment(fecha, [moment.ISO_8601, 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD']);
    return m.isValid() ? m.format('DD/MM/YYYY') : '';
}

function formatearMiles(valor) {
    let num = String(valor).replace(/\D/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Parsea números en formatos mixtos: 123.45 | 123,45 | 1.234,56 | 1,234.56
 */
function parseNumeroLoose(txt) {
    if (txt == null) return NaN;

    let s = String(txt).trim();
    if (s === '') return NaN;

    s = s.replace(/\s+/g, '');
    s = s.replace(/(?:USD|ARS|MXN|COP|CLP|UYU|EUR|GBP|JPY|CNY|R\$|A\$|C\$|\$|%)/gi, '');
    s = s.replace(/[^\d.,-]/g, '');

    if (s === '' || s === '-' || s === ',' || s === '.') return NaN;

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    if (lastComma !== -1 && lastDot !== -1) {
        const decSep = lastComma > lastDot ? ',' : '.';
        const thouSep = decSep === ',' ? '.' : ',';
        s = s.split(thouSep).join('');
        const esc = decSep === '.' ? '\\.' : decSep;
        s = s.replace(new RegExp(esc, 'g'), (m, i, str) => (str.lastIndexOf(decSep) === i ? '.' : ''));
        return parseFloat(s);
    }

    if (lastComma !== -1) {
        s = s.split('.').join('');
        s = s.replace(/,([^,]*)$/, '.$1');
        return parseFloat(s);
    }

    // Solo puntos: un punto = decimal; varios = miles con decimal al final
    s = s.replace(/\.(?=.*\.)/g, '');
    return parseFloat(s);
}

function formatearSinMiles(valor) {
    if (valor == null || valor === '') return 0;
    const n = parseNumeroLoose(valor);
    return isNaN(n) ? 0 : n;
}

/** Formato visual es-AR: 1.234,56 */
function formatNumeroAR(num, decimales = 2) {
    if (num == null || num === '' || !isFinite(Number(num))) return '';
    return Number(num).toLocaleString('es-AR', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
}


let audioContext = null;
let audioBuffer = null;


function llenarSelect(selectId, data, valueField = 'Id', textField = 'Nombre', conOpcionVacia = true) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = conOpcionVacia ? '<option value="">Seleccione</option>' : '';
    (data || []).forEach(it => {
        const opt = document.createElement('option');
        opt.value = it[valueField];
        opt.textContent = it[textField];
        sel.appendChild(opt);
    });
}


/**
* Inicializa Select2 "como select normal" en un scope reutilizable.
* Evita dobles inits, asegura placeholder real y arregla el dropdown dentro de paneles colapsables.
*
* @param {string} selectSel   selector del <select> (ej: '#ClientesFiltro')
* @param {string} scopeSel    contenedor (por defecto '#formFiltros')
* @param {string} placeholder texto placeholder (por defecto 'Todos')
*/
// Reemplazar en Pedidos.js
function initSelect2Simple(selector, dropdownParentSelector, placeholderText, todosValue = -1) {
    const $el = $(selector);
    if (!$el.length) return;

    // Evita doble init
    if ($el.data('select2')) $el.select2('destroy');

    // Asegurá que exista la opción "Todos" (valor -1 por defecto)
    if (!$el.find(`option[value="${todosValue}"]`).length) {
        $el.prepend(new Option('Todos', todosValue));
    }

    // No agregamos opción vacía: queremos que "clear" vuelva a -1
    const $parent = $(dropdownParentSelector);
    $el.select2({
        placeholder: placeholderText || 'Todos',
        allowClear: true,              // deja la "x"
        width: '100%',
        dropdownParent: $parent.length ? $parent : $('body')
    });

    // Al hacer clear (click en la "x"), volver a -1 (Todos)
    $el.on('select2:clear', function () {
        // Pequeño defer para no pelear con el clear interno
        setTimeout(() => {
            $el.val(String(todosValue)).trigger('change.select2');
        }, 0);
    });

    // Si por cualquier motivo queda vacío, forzamos -1
    $el.on('change', function () {
        const v = $el.val();
        if (v === null || v === '') {
            $el.val(String(todosValue)).trigger('change.select2');
        }
    });

    // Limpia posibles nodos de texto sueltos (evita “Todos” duplicado)
    $el.parent().contents().filter(function () {
        return this.nodeType === 3 && this.nodeValue.trim() !== '';
    }).remove();
}



function fmtFechaAR(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function setInfoAuditoria(vm, elementId = 'lblUltimaModif') {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (!vm) {
        el.textContent = '';
        return;
    }

    if (vm.FechaModifica && vm.UsuarioModifica) {
        el.textContent = `Última modificación: ${vm.UsuarioModifica} — ${fmtFechaAR(vm.FechaModifica)}`;
    } else if (vm.FechaModifica) {
        el.textContent = `Última modificación: ${fmtFechaAR(vm.FechaModifica)}`;
    } else if (vm.FechaActualizacion && vm.UsuarioModifica) {
        el.textContent = `Última modificación: ${vm.UsuarioModifica} — ${fmtFechaAR(vm.FechaActualizacion)}`;
    } else if (vm.FechaActualizacion && vm.UsuarioRegistra) {
        el.textContent = `Registrado por: ${vm.UsuarioRegistra} — ${fmtFechaAR(vm.FechaActualizacion)}`;
    } else if (vm.FechaRegistra && vm.UsuarioRegistra) {
        el.textContent = `Creado por: ${vm.UsuarioRegistra} — ${fmtFechaAR(vm.FechaRegistra)}`;
    } else if (vm.FechaActualizacion) {
        el.textContent = `Actualizado: ${fmtFechaAR(vm.FechaActualizacion)}`;
    } else if (vm.FechaRegistra) {
        el.textContent = `Creado: ${fmtFechaAR(vm.FechaRegistra)}`;
    } else {
        el.textContent = '';
    }
}


/* =========================================================================
 * cc.validators.js  — Validaciones genéricas para pantallas y modales
 * ========================================================================= */

(function (w) {
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    const hasFn = name => typeof w[name] === 'function';

    function moneyToNumber(v) {
        try {
            if (hasFn('convertirMonedaAFloat')) return parseFloat(convertirMonedaAFloat(v));
            // Fallback robusto
            if (typeof v === 'number') return v;
            const s = String(v ?? '').replace(/\s/g, '');
            // admite $ . , negativos
            const cleaned = s.replace(/[^0-9,\.\-]/g, '');
            // si tiene coma y punto, asumimos coma decimal
            if (cleaned.includes(',') && cleaned.includes('.')) {
                const lastComma = cleaned.lastIndexOf(',');
                const a = cleaned.slice(0, lastComma).replace(/[^\d\-]/g, '');
                const b = cleaned.slice(lastComma + 1).replace(/[^\d]/g, '');
                return parseFloat(`${a}.${b}`);
            }
            // si solo tiene coma, la usamos como decimal
            if (cleaned.includes(',') && !cleaned.includes('.')) {
                return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
            }
            return parseFloat(cleaned.replace(/,/g, ''));
        } catch { return 0; }
    }

    function isEmpty(v) {
        if (v === null || v === undefined) return true;
        if (typeof v === 'string') return v.trim() === '';
        return false;
    }

    function showError(input, message) {
        input.classList.add('is-invalid');
        const fb = input.parentElement?.querySelector('.invalid-feedback');
        if (fb) {
            fb.textContent = message || fb.getAttribute('data-msg-required') || 'Campo requerido';
            fb.classList.remove('d-none');
        }
    }
    function showMinError(input) {
        input.classList.add('is-invalid');
        const fb = input.parentElement?.querySelector('.invalid-feedback');
        if (fb) {
            fb.textContent = fb.getAttribute('data-msg-min') || 'Valor inválido';
            fb.classList.remove('d-none');
        }
    }
    function clearError(input) {
        input.classList.remove('is-invalid');
        const fb = input.parentElement?.querySelector('.invalid-feedback');
        if (fb) fb.classList.add('d-none');
    }

    function validateInput(input, opts = {}) {
        const required = input.dataset.required === 'true' || opts.required;

        // ✅ Aceptar data-min o data-gt
        const minAttr = (input.dataset.min ?? input.dataset.gt);
        const min = (minAttr !== undefined && minAttr !== null)
            ? parseFloat(minAttr)
            : (opts.min ?? null);

        if (required) {
            const val = input.value;
            if (isEmpty(val) || val === '-1') return { valid: false, why: 'required' };
        }

        if (min !== null && !isNaN(min)) {
            const num = (input.type === 'number') ? parseFloat(input.value) : moneyToNumber(input.value);
            if (!(isFinite(num) && num > min - 1e-15)) return { valid: false, why: 'min' };
        }
        return { valid: true };
    }

    function autoHideOnInput(scope, alertEl) {
        const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
        const fields = $$('[data-required], [data-min], [data-gt]', scope);

        fields.forEach(el => {
            ['input', 'change', 'blur'].forEach(evt => {
                el.addEventListener(evt, () => {
                    const res = validateInput(el);
                    if (!res.valid) {
                        if (res.why === 'required') showError(el);
                        else if (res.why === 'min') showMinError(el);
                        alertEl?.classList.remove('d-none');             // 🔔 mostrar banner
                    } else {
                        clearError(el);
                    }
                    const allOk = $$('[data-required], [data-min], [data-gt]', scope)
                        .every(x => validateInput(x).valid);
                    if (allOk) alertEl?.classList.add('d-none');       // ✅ ocultar cuando todo ok
                });
            });
        });
    }



    function bindBlurValidation(scope) {
        $$('[data-required], [data-min]', scope).forEach(el => {
            el.addEventListener('blur', () => {
                const res = validateInput(el);
                if (!res.valid) {
                    if (res.why === 'required') showError(el);
                    else if (res.why === 'min') showMinError(el);
                } else {
                    clearError(el);
                }
            });
            // también en change de selects/inputs para revalidar
            el.addEventListener('change', () => {
                const res = validateInput(el);
                if (!res.valid) {
                    if (res.why === 'required') showError(el);
                    else if (res.why === 'min') showMinError(el);
                } else {
                    clearError(el);
                }
            });
        });
    }

    function validateGroup(scope, alertEl) {
        const fields = $$('[data-required], [data-min]', scope);
        let ok = true;
        fields.forEach(el => {
            const res = validateInput(el);
            if (!res.valid) {
                ok = false;
                if (res.why === 'required') showError(el);
                else if (res.why === 'min') showMinError(el);
            } else {
                clearError(el);
            }
        });
        if (alertEl) {
            if (!ok) alertEl.classList.remove('d-none');
            else alertEl.classList.add('d-none');
        }
        return ok;
    }

    function clearGroup(scope, alertEl) {
        $$('[data-required], [data-min]', scope).forEach(clearError);
        if (alertEl) alertEl.classList.add('d-none');
    }

    // Expose
    w.ccValidators = {
        moneyToNumber,
        validateInput,
        bindBlurValidation,
        validateGroup,
        clearGroup,
        autoHideOnInput      // <— NUEVO
    };
})(window);

/* ===== Insumo ↔ proveedor: precio y vinculación ===== */
(function (w) {
    function normalizarInsumoConProveedor(x) {
        if (!x) return null;
        const costo = Number(x.CostoUnitario ?? x.costoUnitario ?? x.PrecioLista ?? x.precioLista ?? 0);
        const cantProv = Number(x.CantidadProveedores ?? x.cantidadProveedores ?? 0);
        const idLista = Number(x.IdProveedorLista ?? x.idProveedorLista ?? 0);
        // Vinculado = relación con proveedor/lista (el precio puede ser 0)
        const linked = cantProv > 0 || idLista > 0;
        return {
            Id: x.Id ?? x.id,
            Descripcion: x.Descripcion ?? x.descripcion ?? x.Nombre ?? x.nombre ?? '',
            CostoUnitario: Number.isFinite(costo) ? costo : 0,
            CantidadProveedores: cantProv,
            IdProveedorLista: idLista,
            ProveedorDestacado: x.ProveedorDestacado || x.proveedorDestacado || '',
            TieneVinculoProveedor: linked,
            TienePrecio: Number.isFinite(costo) && costo > 0,
        };
    }

    /** @param {string} [contexto] 'orden'|'compra' = solo vínculo; 'receta' = vínculo + precio > 0 */
    function tieneVinculo(item, contexto) {
        if (!item) return false;
        const linked = !!(item.TieneVinculoProveedor
            || Number(item.IdProveedorLista ?? 0) > 0
            || Number(item.CantidadProveedores ?? 0) > 0);
        if (!linked) return false;
        if (contexto === 'orden' || contexto === 'compra') return true;
        return Number(item.CostoUnitario ?? 0) > 0;
    }

    function mensajeSinVinculo(insumo, ctx) {
        const nombre = insumo?.Descripcion ? `"${insumo.Descripcion}"` : 'Este insumo';
        if (ctx === 'orden' || ctx === 'compra') {
            return `${nombre} no está vinculado al proveedor seleccionado. Revisá la vinculación en Insumos o en Proveedores → Lista de precios.`;
        }
        return `${nombre} no tiene proveedor vinculado con precio. Vinculalo en Proveedores → Insumos de proveedores para poder usarlo.`;
    }

    function aplicarSeleccionModal(cfg) {
        const {
            insumo,
            alertEl,
            msgEl,
            precioEl,
            totalEl,
            btnEl,
            cantidadEl,
            fmtMon,
            cantidadDefault = 1,
            contexto = 'receta',
        } = cfg || {};

        const $alert = alertEl ? $(alertEl) : $();
        const $msg = msgEl ? $(msgEl) : $alert.find('[data-rp-vinculo-msg]');
        const $precio = precioEl ? $(precioEl) : $();
        const $total = totalEl ? $(totalEl) : $();
        const $btn = btnEl ? $(btnEl) : $();
        const $cant = cantidadEl ? $(cantidadEl) : $();
        const fmt = typeof fmtMon === 'function' ? fmtMon : (n) => String(n ?? 0);

        if ($cant.length && !$cant.val()) $cant.val(cantidadDefault);

        const fb = $precio.length ? $precio.siblings('.invalid-feedback') : $();
        const okVinculo = tieneVinculo(insumo, contexto);

        if (okVinculo) {
            $alert.addClass('d-none');
            $btn.prop('disabled', false);
            const costo = Number(insumo.CostoUnitario ?? 0);
            const cant = Number($cant.val() || cantidadDefault);
            if (costo > 0) {
                $precio.val(fmt(costo)).removeClass('is-invalid');
                if (fb.length) fb.addClass('d-none');
                $total.val(fmt(costo * cant));
            } else {
                // OC: vinculado sin precio de lista → el usuario carga el precio
                $precio.val('').removeClass('is-invalid');
                if (fb.length) fb.addClass('d-none');
                $total.val('');
            }
            return true;
        }

        const msg = insumo ? mensajeSinVinculo(insumo, contexto) : 'Seleccioná un insumo.';
        if ($msg.length) $msg.text(msg);
        $alert.removeClass('d-none');
        $btn.prop('disabled', true);
        $precio.val(fmt(0)).addClass('is-invalid');
        if (fb.length) {
            const tip = (contexto === 'orden' || contexto === 'compra')
                ? 'Falta vincular el insumo al proveedor'
                : 'Sin precio: falta vincular con un proveedor';
            fb.text(tip).removeClass('d-none');
        }
        $total.val(fmt(0));
        return false;
    }

    w.RpInsumoVinculo = {
        normalizar: normalizarInsumoConProveedor,
        tieneVinculo,
        mensajeSinVinculo,
        aplicarSeleccionModal,
    };
})(window);


// ===== Modal reset helpers (Bootstrap 5) =====
function __mm_removeAllBackdrops() {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
}

function __mm_resetBody() {
    document.body.classList.remove('modal-open');
    document.body.style.paddingRight = '';
}

function __mm_moveAllModalsToBody() {
    document.querySelectorAll('.modal').forEach(m => {
        if (m.parentElement !== document.body) document.body.appendChild(m);
    });
}

function __mm_waitHidden(el) {
    return new Promise(resolve => {
        if (!el.classList.contains('show')) return resolve();
        el.addEventListener('hidden.bs.modal', () => resolve(), { once: true });
        const inst = bootstrap.Modal.getOrCreateInstance(el);
        inst.hide();
    });
}

async function closeAllModalsAsync() {
    const opened = Array.from(document.querySelectorAll('.modal.show'));
    for (const el of opened) await __mm_waitHidden(el);
}

/**
 * Abre un modal "desde cero": cierra los que estén abiertos, limpia backdrops,
 * resetea el body y muestra el modal indicado.
 * @param {string} selector - ej: '#ModalEdicionConfiguraciones'
 * @param {object} opts     - opciones bootstrap Modal
 */
async function openFreshModal(selector, opts = {}) {
    __mm_moveAllModalsToBody();
    await closeAllModalsAsync();
    __mm_removeAllBackdrops();
    __mm_resetBody();

    const el = document.querySelector(selector);
    if (!el) return;
    const inst = bootstrap.Modal.getOrCreateInstance(el, Object.assign({
        backdrop: true, keyboard: true, focus: true
    }, opts));
    inst.show();
}


function bsGet(elOrSel) {
    const el = (typeof elOrSel === 'string') ? document.querySelector(elOrSel) : elOrSel;
    return el ? bootstrap.Modal.getOrCreateInstance(el) : null;
}
async function bsHide(elOrSel) {
    const inst = bsGet(elOrSel);
    if (!inst) return;
    const el = inst._element;
    if (!el || !el.classList.contains('show')) return;
    await new Promise(res => {
        el.addEventListener('hidden.bs.modal', res, { once: true });
        inst.hide();
    });
}
function bsShow(elOrSel, opts = {}) {
    const el = (typeof elOrSel === 'string') ? document.querySelector(elOrSel) : elOrSel;
    if (!el) return;
    const inst = bootstrap.Modal.getOrCreateInstance(el, Object.assign({ backdrop: true, keyboard: true, focus: true }, opts));
    inst.show();
}



// Cierra cualquier menú abierto al clickear afuera, scrollear o redimensionar
(function bindGlobalClose() {
    const closeAll = () => document.querySelectorAll('.acciones-dropdown')
        .forEach(d => d.style.display = 'none');
    document.addEventListener('click', e => {
        if (!e.target.closest('.acciones-menu')) closeAll();
    });
    window.addEventListener('scroll', closeAll, true);
    window.addEventListener('resize', closeAll);
})();

// Llamala desde tu render (ya lo hacés con onclick='toggleAcciones(id)')
function toggleAcciones(id) {
    const wrap = document.querySelector(`.acciones-menu[data-id="${id}"]`);
    if (!wrap) return;
    const dd = wrap.querySelector('.acciones-dropdown');

    // cerrar otros
    document.querySelectorAll('.acciones-dropdown').forEach(x => { if (x !== dd) x.style.display = 'none'; });

    // toggle simple si ya estaba visible
    if (dd.style.display === 'block') { dd.style.display = 'none'; return; }

    // mostrar "fantasma" para medir
    dd.style.visibility = 'hidden';
    dd.style.display = 'block';
    dd.classList.remove('drop-up', 'drop-down');

    // medidas del botón y del menú
    const br = wrap.getBoundingClientRect();
    const mr = dd.getBoundingClientRect();
    const below = window.innerHeight - br.bottom; // espacio debajo
    const above = br.top;                          // espacio arriba

    // decidir dirección
    if (below < mr.height + 12 && above > below) {
        dd.classList.add('drop-up');
    } else {
        dd.classList.add('drop-down');
    }

    // posición horizontal (pegado a la derecha del botón)
    const baseLeft = 8;                 // offset respecto al botón
    dd.style.left = baseLeft + 'px';

    // corregir si se sale por la derecha
    const mr2 = dd.getBoundingClientRect();
    const overflowRight = mr2.right - window.innerWidth;
    if (overflowRight > 0) {
        dd.style.left = (baseLeft - overflowRight - 8) + 'px';
    }

    // listo
    dd.style.visibility = '';
}

// (Opcional) Si no usás onclick en el HTML, podés delegar aquí:
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.acciones-menu .btnacciones');
    if (!btn) return;
    const host = btn.closest('.acciones-menu');
    const id = host?.dataset.id;
    if (id) toggleAcciones(id);
});


// === Helpers para ubicar el contenedor "lógico" del campo y su feedback ===
function __fieldGroup(input) {
    // Busca un wrapper razonable: form-group, cc-field o la columna bootstrap
    return input.closest('.form-group, .cc-field, [class*="col-"], .mb-3') || input.parentElement;
}
function __feedback(input) {
    const g = __fieldGroup(input);
    if (!g) return null;
    // Primero, si el hermano inmediato es el feedback (caso común)
    if (input.nextElementSibling && input.nextElementSibling.classList?.contains('invalid-feedback'))
        return input.nextElementSibling;
    // Si hay input-group, el feedback suele estar después del grupo
    if (input.parentElement?.classList?.contains('input-group')) {
        const sib = input.parentElement.nextElementSibling;
        if (sib && sib.classList?.contains('invalid-feedback')) return sib;
    }
    // Fallback: buscá dentro del contenedor lógico
    return g.querySelector('.invalid-feedback');
}

function __markInvalid(input, on) {
    input.classList.toggle('is-invalid', !!on);
    // Si es select2, marcar el cascarón visual
    try {
        const $el = window.jQuery ? window.jQuery(input) : null;
        if ($el && $el.data && $el.data('select2')) {
            const $sel = $el.next('.select2').find('.select2-selection');
            $sel.toggleClass('is-invalid', !!on);
        }
    } catch { }
}

function showError(input, message) {
    __markInvalid(input, true);
    const fb = __feedback(input);
    if (fb) {
        fb.textContent = message || fb.getAttribute('data-msg-required') || 'Campo obligatorio';
        fb.classList.remove('d-none');
    }
}
function showMinError(input) {
    __markInvalid(input, true);
    const fb = __feedback(input);
    if (fb) {
        fb.textContent = fb.getAttribute('data-msg-min') || 'Valor inválido';
        fb.classList.remove('d-none');
    }
}
function clearError(input) {
    __markInvalid(input, false);
    const fb = __feedback(input);
    if (fb) fb.classList.add('d-none');
}


// ==== Helpers de validación robusta (input, input-group, select2) ====
function __fieldContainer(el) {
    // contenedor lógico donde suele vivir el feedback
    return el.closest('.form-group, .cc-field, [class*="col-"], .mb-3') || el.parentElement;
}
function __feedbackEl(el) {
    const cont = __fieldContainer(el);
    if (!cont) return null;

    // si el hermano inmediato es feedback, usarlo
    if (el.nextElementSibling?.classList?.contains('invalid-feedback')) return el.nextElementSibling;

    // si el input está dentro de un input-group, el feedback suele venir después del grupo
    const group = el.closest('.input-group');
    if (group && group.nextElementSibling?.classList?.contains('invalid-feedback')) {
        return group.nextElementSibling;
    }

    // fallback: el primero dentro del contenedor
    return cont.querySelector('.invalid-feedback');
}
function __setInvalid(el, invalid, msg) {
    // marcar control nativo
    el.classList.toggle('is-invalid', invalid);
    el.classList.toggle('is-valid', !invalid);

    // marcar select2 si corresponde
    try {
        const $el = window.jQuery ? window.jQuery(el) : null;
        if ($el && $el.data && $el.data('select2')) {
            const $sel = $el.next('.select2').find('.select2-selection');
            $sel.toggleClass('is-invalid', invalid).toggleClass('is-valid', !invalid);
        }
    } catch { }

    // mensaje
    const fb = __feedbackEl(el);
    if (fb) {
        if (invalid) {
            fb.textContent = msg || fb.getAttribute('data-msg-required') || 'Campo obligatorio';
            fb.classList.remove('d-none');
        } else {
            fb.classList.add('d-none');
        }
    }
}
function __isEmptyValue(el) {
    // valores placeholder típicos en tus selects
    const v = (el?.value ?? '').toString().trim();
    return v === '' || v === '-1' || v === 'Seleccionar' || v === 'Seleccionar...';
}


function _container(el) {
    return el.closest('.form-group, [class*="col-"], .mb-3') || el.parentElement;
}
function _feedbackFor(el) {
    // 1) si el select está dentro de input-group, el feedback suele venir DESPUÉS del grupo
    const group = el.closest('.input-group');
    if (group && group.nextElementSibling?.classList?.contains('invalid-feedback')) {
        return group.nextElementSibling;
    }
    // 2) hermano inmediato
    if (el.nextElementSibling?.classList?.contains('invalid-feedback')) return el.nextElementSibling;
    // 3) fallback: primero dentro del contenedor
    const c = _container(el);
    return c ? c.querySelector('.invalid-feedback') : null;
}
function _setInvalid(el, invalid, msg = 'Campo obligatorio') {
    el.classList.toggle('is-invalid', invalid);
    el.classList.toggle('is-valid', !invalid);

    // si es select2, marcar la "selection"
    try {
        const $el = window.jQuery ? window.jQuery(el) : null;
        if ($el && $el.data && $el.data('select2')) {
            const $sel = $el.next('.select2').find('.select2-selection');
            $sel.toggleClass('is-invalid', invalid).toggleClass('is-valid', !invalid);
        }
    } catch { }

    const fb = _feedbackFor(el);
    if (fb) {
        if (invalid) { fb.textContent = msg; fb.classList.remove('d-none'); }
        else fb.classList.add('d-none');
    }
}
function _isEmpty(el) {
    const v = (el?.value ?? '').toString().trim();
    return v === '' || v === '-1' || v === 'Seleccionar' || v === 'Seleccionar...';
}

// ===== Helpers mínimos usados por wireLiveValidationInsumo =====
function fieldContainer(el) {
    return el.closest('.form-group, .cc-field, [class*="col-"], .mb-3') || el.parentElement;
}
function feedbackFor(el) {
    const group = el.closest('.input-group');
    if (group && group.nextElementSibling?.classList?.contains('invalid-feedback')) return group.nextElementSibling;
    if (el.nextElementSibling?.classList?.contains('invalid-feedback')) return el.nextElementSibling;
    const c = fieldContainer(el);
    return c ? c.querySelector('.invalid-feedback') : null;
}
function setInvalid(el, invalid, msg = 'Campo obligatorio') {
    // estado en el control nativo
    el.classList.toggle('is-invalid', !!invalid);
    el.classList.toggle('is-valid', !invalid);

    // si es select2, marcar el “cascarón” visual
    try {
        const $el = window.jQuery ? window.jQuery(el) : null;
        if ($el && $el.data && $el.data('select2')) {
            const $sel = $el.next('.select2').find('.select2-selection');
            $sel.toggleClass('is-invalid', !!invalid).toggleClass('is-valid', !invalid);
        }
    } catch { }

    // feedback
    const fb = feedbackFor(el);
    if (fb) {
        if (invalid) { fb.textContent = msg; fb.classList.remove('d-none'); }
        else fb.classList.add('d-none');
    }
}
function _isEmpty(el) {
    const v = (el?.value ?? '').toString().trim();
    return v === '' || v === '-1' || v === 'Seleccionar' || v === 'Seleccionar...';
}


function resetErroresModal(modalSel) {
    const root = document.querySelector(modalSel);
    if (!root) return;

    // Ocultar TODOS los feedbacks y limpiar estados
    root.querySelectorAll('.invalid-feedback').forEach(fb => fb.classList.add('d-none'));
    root.querySelectorAll('.is-invalid, .is-valid').forEach(el => el.classList.remove('is-invalid', 'is-valid'));

    // Si hay select2, limpiá el “cascarón” visual
    if (window.jQuery) {
        root.querySelectorAll('select').forEach(sel => {
            const $sel = jQuery(sel);
            if ($sel.data && $sel.data('select2')) {
                $sel.next('.select2').find('.select2-selection').removeClass('is-invalid is-valid');
            }
        });
    }
}

// Llamalo al abrir:
document.getElementById('modalEdicion')?.addEventListener('show.bs.modal', () => {
    resetErroresModal('#modalEdicion');
});
