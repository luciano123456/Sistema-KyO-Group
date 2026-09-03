/**
 * Filtros compartidos del módulo Ventas (Desde / Hasta / Local).
 * Persistidos en localStorage para Index, Análisis y pantallas con los mismos ids.
 */
(function (global) {
    'use strict';

    const KEY = 'kyo.ventas.filtros';
    const IDS = { desde: 'fltDesde', hasta: 'fltHasta', local: 'fltLocal' };

    function fmtDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function defaults() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        return {
            fechaDesde: fmtDate(desde),
            fechaHasta: fmtDate(hoy),
            idLocal: '0'
        };
    }

    function load() {
        const base = defaults();
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return base;
            const o = JSON.parse(raw) || {};
            return {
                fechaDesde: o.fechaDesde || base.fechaDesde,
                fechaHasta: o.fechaHasta || base.fechaHasta,
                idLocal: String(o.idLocal ?? base.idLocal)
            };
        } catch {
            return base;
        }
    }

    function save(partial) {
        const cur = load();
        const next = {
            fechaDesde: partial?.fechaDesde != null ? partial.fechaDesde : cur.fechaDesde,
            fechaHasta: partial?.fechaHasta != null ? partial.fechaHasta : cur.fechaHasta,
            idLocal: String(partial?.idLocal != null ? partial.idLocal : cur.idLocal)
        };
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
    }

    function readFromDom() {
        const d = document.getElementById(IDS.desde);
        const h = document.getElementById(IDS.hasta);
        const l = document.getElementById(IDS.local);
        return {
            fechaDesde: d?.value || '',
            fechaHasta: h?.value || '',
            idLocal: l?.value || '0'
        };
    }

    function applyToDom(filtros) {
        const f = filtros || load();
        const d = document.getElementById(IDS.desde);
        const h = document.getElementById(IDS.hasta);
        const l = document.getElementById(IDS.local);
        if (d && f.fechaDesde) d.value = f.fechaDesde;
        if (h && f.fechaHasta) h.value = f.fechaHasta;
        if (l && f.idLocal != null) {
            const val = String(f.idLocal);
            if ([...l.options].some(o => o.value === val)) l.value = val;
            else l.value = '0';
        }
        return f;
    }

    function persistFromDom() {
        return save(readFromDom());
    }

    /**
     * Aplica filtros guardados y los vuelve a guardar ante cambios / Filtrar.
     * @param {{ onChange?: Function }} opts
     */
    function bind(opts) {
        const onChange = typeof opts?.onChange === 'function' ? opts.onChange : null;
        applyToDom(load());

        const notify = () => {
            persistFromDom();
            if (onChange) onChange(readFromDom());
        };

        [IDS.desde, IDS.hasta, IDS.local].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', notify);
        });

        const btn = document.getElementById('btnFiltrar') || document.getElementById('btnAplicar');
        if (btn) {
            btn.addEventListener('click', () => persistFromDom());
        }
    }

    global.kyoVentasFiltros = {
        KEY,
        defaults,
        load,
        save,
        readFromDom,
        applyToDom,
        persistFromDom,
        bind
    };
})(window);
