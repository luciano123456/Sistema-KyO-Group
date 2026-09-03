/**
 * Overlay global "Cargando tablas…" solo en:
 * - carga inicial de la pantalla / primera data del grid
 * - búsquedas "grandes" (reload vía kyoGridReload / force flag)
 *
 * No se muestra en filtros de columna, orden, paginación ni cada click menor.
 */
(function (window) {
    'use strict';

    const DEFAULT_MSG = 'Cargando tablas…';
    let count = 0;
    let overlayEl = null;
    let textEl = null;
    let showSince = 0;
    let hideTimer = null;
    const MIN_VISIBLE_MS = 280;

    function ensureOverlay() {
        if (overlayEl) return overlayEl;

        overlayEl = document.createElement('div');
        overlayEl.id = 'kyoTableLoading';
        overlayEl.className = 'kyo-table-loading';
        overlayEl.setAttribute('role', 'status');
        overlayEl.setAttribute('aria-live', 'polite');
        overlayEl.setAttribute('aria-busy', 'false');
        overlayEl.innerHTML =
            '<div class="kyo-table-loading-card">' +
            '  <div class="kyo-table-loading-spinner" aria-hidden="true"></div>' +
            '  <div class="kyo-table-loading-text">' + DEFAULT_MSG + '</div>' +
            '  <div class="kyo-table-loading-hint">Un momento por favor</div>' +
            '</div>';

        textEl = overlayEl.querySelector('.kyo-table-loading-text');
        document.body.appendChild(overlayEl);
        return overlayEl;
    }

    function renderVisible() {
        ensureOverlay();
        overlayEl.classList.add('is-visible');
        overlayEl.setAttribute('aria-busy', 'true');
    }

    function renderHidden() {
        if (!overlayEl) return;
        overlayEl.classList.remove('is-visible');
        overlayEl.setAttribute('aria-busy', 'false');
    }

    function kyoShowTableLoading(message) {
        count += 1;
        if (message && textEl) textEl.textContent = message;
        else if (textEl) textEl.textContent = DEFAULT_MSG;

        if (count === 1) {
            showSince = Date.now();
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            renderVisible();
        }
    }

    function kyoHideTableLoading() {
        if (count <= 0) return;
        count -= 1;
        if (count > 0) return;

        const elapsed = Date.now() - showSince;
        const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
            hideTimer = null;
            if (count <= 0) renderHidden();
        }, wait);
    }

    async function kyoWithTableLoading(fn, message) {
        kyoShowTableLoading(message);
        try {
            return await fn();
        } finally {
            kyoHideTableLoading();
        }
    }

    function isExternalUrl(url) {
        return /^https?:\/\//i.test(url) && !url.startsWith(window.location.origin);
    }

    function pageHasDataTables() {
        return !!document.querySelector('table.dt-dark, table.dataTable, .dt-dark-wrap table, [id^="grd_"]');
    }

    function shouldTrackFetch(url, method) {
        const m = (method || 'GET').toUpperCase();
        if (m !== 'GET') return false;

        const raw = String(url || '');
        if (!raw || raw.startsWith('blob:') || raw.startsWith('data:')) return false;
        if (isExternalUrl(raw)) return false;

        const path = raw.split('?')[0].toLowerCase();

        if (/\.(js|css|map|png|jpe?g|gif|svg|webp|woff2?|ttf|ico)(\?|$)/.test(path)) return false;
        if (raw.includes('datatables.net') || raw.includes('cdn.jsdelivr.net') || raw.includes('cdnjs.cloudflare.com')) {
            return false;
        }

        if (/\/(login|logout|avatar|perfil|editarinfo|insertar|actualizar|eliminar|registrarpago|importar|guardar|subir)/i.test(path)) {
            return false;
        }

        if (!pageHasDataTables()) return false;

        // Redraws de DataTables server-side: sin overlay (processing interno / 1ª carga vía kyoServerGridAjax)
        if (/[?&]draw=/i.test(raw) && /[?&](start|length)=/i.test(raw)) return false;

        // Cargas iniciales de listados / KPIs (sin paginado DT)
        if (/\/(lista|movimientos|resumen|comparar|datatable|grid|kpis)/i.test(path)) return true;

        return false;
    }

    function wrapResponseForLoading(response) {
        let hidden = false;
        const hideOnce = function () {
            if (hidden) return;
            hidden = true;
            kyoHideTableLoading();
        };

        const wrapReader = function (reader) {
            return function () {
                return reader.apply(response, arguments).finally(hideOnce);
            };
        };

        if (typeof response.json === 'function') response.json = wrapReader(response.json.bind(response));
        if (typeof response.text === 'function') response.text = wrapReader(response.text.bind(response));
        if (typeof response.blob === 'function') response.blob = wrapReader(response.blob.bind(response));

        setTimeout(hideOnce, 8000);
        return response;
    }

    function patchFetch() {
        if (window.fetch.__kyoTableLoadingPatched) return;
        const original = window.fetch.bind(window);

        window.fetch = function (input, init) {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const method = (init && init.method) || (input && input.method) || 'GET';
            const track = shouldTrackFetch(url, method);

            if (!track) return original(input, init);

            kyoShowTableLoading();
            return original(input, init)
                .then(function (response) {
                    return wrapResponseForLoading(response);
                })
                .catch(function (err) {
                    kyoHideTableLoading();
                    throw err;
                });
        };

        window.fetch.__kyoTableLoadingPatched = true;
    }

    function patchDataTable() {
        const $ = window.jQuery;
        if (!$ || !$.fn || !$.fn.DataTable || $.fn.DataTable.__kyoTableLoadingPatched) return false;

        const original = $.fn.DataTable;
        $.fn.DataTable = function () {
            const args = arguments;
            const opts = args[0];
            const isInit = opts && typeof opts === 'object' && !Array.isArray(opts) &&
                (opts.columns || opts.data !== undefined || opts.ajax || opts.serverSide);

            if (isInit) kyoShowTableLoading('Preparando tablas…');

            const result = original.apply(this, args);

            if (isInit) {
                window.requestAnimationFrame(function () {
                    setTimeout(function () { kyoHideTableLoading(); }, 0);
                });
            }

            return result;
        };

        Object.keys(original).forEach(function (key) {
            $.fn.DataTable[key] = original[key];
        });
        $.fn.DataTable.__kyoTableLoadingPatched = true;
        return true;
    }

    function patchServerGridAjax() {
        if (typeof window.kyoServerGridAjax !== 'function' || window.kyoServerGridAjax.__kyoTableLoadingPatched) {
            return;
        }

        let inflight = 0;
        window.kyoOnServerGridRequestEnd = function () {
            if (inflight <= 0) return;
            inflight -= 1;
            if (inflight === 0) kyoHideTableLoading();
        };

        const originalFactory = window.kyoServerGridAjax;
        window.kyoServerGridAjax = function (url, extraParamsFn) {
            const ajaxFn = originalFactory(url, extraParamsFn);
            let isFirstLoad = true;
            return function (data, callback) {
                const force = !!window.__kyoForceTableLoading;
                if (force) window.__kyoForceTableLoading = false;

                const showOverlay = isFirstLoad || force;
                isFirstLoad = false;

                if (showOverlay) {
                    inflight += 1;
                    kyoShowTableLoading(force ? 'Buscando…' : DEFAULT_MSG);
                }
                ajaxFn(data, callback);
            };
        };
        window.kyoServerGridAjax.__kyoTableLoadingPatched = true;
    }

    function patchGridReload() {
        if (typeof window.kyoGridReload !== 'function' || window.kyoGridReload.__kyoTableLoadingPatched) {
            return;
        }
        const original = window.kyoGridReload;
        window.kyoGridReload = function (tableApi) {
            // Buscar / Limpiar / post-guardar: overlay sí; draw menor no pasa por acá
            window.__kyoForceTableLoading = true;
            return original.apply(this, arguments);
        };
        window.kyoGridReload.__kyoTableLoadingPatched = true;
    }

    function bootPatchDataTable() {
        if (patchDataTable()) return;
        let attempts = 0;
        const timer = setInterval(function () {
            attempts += 1;
            if (patchDataTable() || attempts > 120) clearInterval(timer);
        }, 100);
    }

    window.kyoShowTableLoading = kyoShowTableLoading;
    window.kyoHideTableLoading = kyoHideTableLoading;
    window.kyoWithTableLoading = kyoWithTableLoading;

    patchFetch();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            bootPatchDataTable();
            patchServerGridAjax();
            patchGridReload();
        });
    } else {
        bootPatchDataTable();
        patchServerGridAjax();
        patchGridReload();
    }

    window.addEventListener('load', function () {
        bootPatchDataTable();
        patchServerGridAjax();
        patchGridReload();
    });
})(window);
