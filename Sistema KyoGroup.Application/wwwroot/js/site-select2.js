/* =========================================================================
 * site-select2.js — Select2 global + botón [+] para catálogos configurables
 * ========================================================================= */
(function (w, $) {
    'use strict';

    if (!$ || !$.fn || !$.fn.select2) return;

    const SKIP_SELECTOR = '[data-s2-skip], .s2-custom, #OrdenCompraSelect';

    function getToken() {
        try { return localStorage.getItem('JwtToken') || ''; } catch { return ''; }
    }

    function isVisible(el) {
        if (!el) return false;
        if (el.classList.contains('d-none') || el.getAttribute('aria-hidden') === 'true') return false;
        return el.offsetParent !== null || el.getClientRects().length > 0;
    }

    function shouldSkip(el) {
        if (!el || el.tagName !== 'SELECT') return true;
        if (el.matches(SKIP_SELECTOR)) return true;
        if (el.classList.contains('select2-hidden-accessible')) return true;
        return false;
    }

    function isFilterSelect(el) {
        if (el.closest('.filter-bar')) return true;
        if (el.closest('thead.filters, tr.filters')) return true;
        const id = (el.id || '').toLowerCase();
        return id.includes('filtro') || id.startsWith('filter');
    }

    function getDropdownParent(el) {
        const modal = el.closest('.modal');
        if (modal) return $(modal);
        const offcanvas = el.closest('.offcanvas');
        if (offcanvas) return $(offcanvas);
        return $(document.body);
    }

    function getPlaceholder(el) {
        const opt = el.querySelector('option[disabled], option[value="-1"], option[value=""]');
        if (opt && opt.textContent.trim()) return opt.textContent.trim();
        if (isFilterSelect(el)) return 'Todos';
        return 'Seleccionar';
    }

    function buildOptions(el) {
        const filter = isFilterSelect(el);
        const placeholder = getPlaceholder(el);
        const inPlusGroup = !!el.closest('.input-plus');

        return {
            width: inPlusGroup ? 'resolve' : '100%',
            placeholder: placeholder,
            allowClear: filter,
            dropdownParent: getDropdownParent(el),
            language: {
                noResults: () => 'Sin resultados',
                searching: () => 'Buscando…'
            }
        };
    }

    function fixInputPlusLayout(el) {
        const group = el.closest('.input-plus');
        if (!group) return;
        const $container = $(el).next('.select2-container');
        if ($container.length) {
            $container.css({ width: '', flex: '1 1 0%', minWidth: 0 });
        }
    }

    function initOne(el, extraOpts) {
        if (shouldSkip(el)) return null;
        const $el = $(el);
        if ($el.data('select2')) return $el;

        // Armar grupo input-plus ANTES de Select2 (el container se inserta junto al select)
        if (el.dataset.s2ConfigController) {
            ensureInputPlusGroup(el);
            ensureAddButton(el);
        }

        const opts = Object.assign(buildOptions(el), extraOpts || {});
        $el.select2(opts);
        fixInputPlusLayout(el);

        if (isFilterSelect(el)) {
            const todosVal = el.querySelector('option[value="-1"]') ? '-1' : '';
            $el.off('select2:clear.kyo').on('select2:clear.kyo', function () {
                setTimeout(() => {
                    if (todosVal !== '') $el.val(todosVal).trigger('change.select2');
                }, 0);
            });
        }

        wireAddButton(el);
        return $el;
    }
    function pickKey(obj, keys) {
        return keys.find(k => Object.prototype.hasOwnProperty.call(obj, k));
    }

    function normalizeListItem(x) {
        const id = x.id ?? x.Id ?? x.ID;
        const nombre = x.nombre ?? x.Nombre ?? x.descripcion ?? x.Descripcion ?? x.text ?? x.Text ?? '';
        const abrev = x.abreviatura ?? x.Abreviatura ?? x.sigla ?? x.Sigla ?? '';
        const texto = abrev ? `${nombre} (${abrev})` : String(nombre);
        return { id, texto };
    }

    async function fetchList(url) {
        const token = getToken();
        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        const r = await fetch(url, { headers });
        if (!r.ok) throw new Error('Error al cargar lista');
        const data = await r.json();
        return Array.isArray(data) ? data : [];
    }

    async function reloadSelectOptions(sel, url, idSeleccionar) {
        if (!sel || !url) return;
        const data = await fetchList(url);
        const prev = sel.value;
        const $el = $(sel);
        const hadS2 = !!$el.data('select2');

        sel.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = 'Seleccionar';
        ph.disabled = true;
        ph.selected = true;
        sel.appendChild(ph);

        data.forEach(x => {
            const n = normalizeListItem(x);
            if (n.id == null) return;
            sel.appendChild(new Option(n.texto, String(n.id)));
        });

        let valueToSelect = null;
        if (idSeleccionar != null) valueToSelect = String(idSeleccionar);
        else if (sel.options.length > 1) valueToSelect = sel.options[sel.options.length - 1].value;
        else if (prev && [...sel.options].some(o => o.value === prev)) valueToSelect = prev;

        if (valueToSelect && [...sel.options].some(o => o.value === valueToSelect)) {
            sel.value = valueToSelect;
        }

        sel.classList.remove('is-invalid');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        if (hadS2) $el.trigger('change.select2');
    }

  /* ---- Botón [+] junto al select ---- */
    function ensureInputPlusGroup(sel) {
        if (sel.closest('.input-plus')) return sel.closest('.input-plus');
        if (!sel.dataset.s2ConfigController) return null;

        const group = document.createElement('div');
        group.className = 'input-group input-plus';
        sel.parentNode.insertBefore(group, sel);
        group.appendChild(sel);
        return group;
    }

    function ensureAddButton(sel) {
        const controller = sel.dataset.s2ConfigController;
        if (!controller) return null;

        const group = ensureInputPlusGroup(sel);
        if (!group) return null;

        let btn = group.querySelector('.btn-plus');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-plus';
            btn.title = sel.dataset.s2ConfigTitle || 'Agregar nuevo';
            btn.innerHTML = '<i class="fa fa-plus"></i>';
            group.appendChild(btn);
        }
        return btn;
    }

    function wireAddButton(sel) {
        const btn = ensureAddButton(sel);
        if (!btn || btn.dataset.s2Wired === '1') return;

        btn.dataset.s2Wired = '1';
        btn.addEventListener('click', async () => {
            const nombre = sel.dataset.s2ConfigNombre || '';
            const controller = sel.dataset.s2ConfigController || '';
            const reloadUrl = sel.dataset.s2ConfigReload || '';
            if (!controller || typeof w.openConfigAndWait !== 'function') return;

            try {
                const nuevoId = await w.openConfigAndWait({ nombre, controller });
                if (reloadUrl) await reloadSelectOptions(sel, reloadUrl, nuevoId);
            } catch (_) {
                // cancelado o timeout
            } finally {
                if (reloadUrl && !sel.dataset.s2ConfigKeepId) {
                    try { await reloadSelectOptions(sel, reloadUrl); } catch { /* noop */ }
                }
            }
        });
    }

  /* ---- API pública ---- */
    function initAll(scope, extraOpts) {
        const root = scope ? (typeof scope === 'string' ? document.querySelector(scope) : scope) : document;
        if (!root) return;
        root.querySelectorAll('select').forEach(el => initOne(el, extraOpts));
    }

    function refresh(el) {
        const $el = $(el);
        if (!$el.data('select2')) return initOne(el);
        $el.trigger('change.select2');
    }

    function setValue(el, value) {
        const $el = $(el);
        $el.val(value == null ? '' : String(value));
        if ($el.data('select2')) $el.trigger('change.select2');
        else el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    w.KyoSelect2 = { init: initOne, initAll, refresh, setValue, reload: reloadSelectOptions };

  /* ---- Auto-init al cargar y en modales ---- */
    function boot() {
        initAll(document);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    document.addEventListener('shown.bs.modal', (e) => {
        if (e.target) initAll(e.target);
    });

  /* ---- Observer para selects dinámicos (DataTables, etc.) ---- */
    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
        let found = false;
        for (const m of mutations) {
            if (m.addedNodes && m.addedNodes.length) { found = true; break; }
        }
        if (!found) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => initAll(document), 80);
    });

    observer.observe(document.body, { childList: true, subtree: true });

})(window, window.jQuery);
