(function (window) {
    'use strict';

    function authHeaders() {
        const t = (typeof token !== 'undefined' && token) ? token : localStorage.getItem('JwtToken');
        const h = { 'Content-Type': 'application/json' };
        if (t) h.Authorization = 'Bearer ' + t;
        return h;
    }

    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    /** Devuelve el <thead> visible (scrollHead si hay scrollX/Y). */
    function kyoVisibleThead(api, tableId) {
        // Con scrollX/Y el thead visible está en .dataTables_scrollHead (no en #grd_X)
        if (api && api.table) {
            try {
                const $scrollThead = $(api.table().container()).find('.dataTables_scrollHead thead').first();
                if ($scrollThead.length) return $scrollThead;
            } catch (e) { /* ignore */ }

            try {
                const header = api.table().header();
                if (header) {
                    const $thead = $(header).closest('thead');
                    if ($thead.length) return $thead;
                }
            } catch (e) { /* ignore */ }
        }

        if (tableId) {
            const $wrap = $(tableId).closest('.dataTables_wrapper');
            const $scrollThead = $wrap.find('.dataTables_scrollHead thead').first();
            if ($scrollThead.length) return $scrollThead;
            return $(tableId + ' thead').first();
        }

        return $();
    }

    /** Clona la fila de headers a una fila .filters (una sola vez) en el thead visible. */
    window.kyoEnsureFilterRow = function (tableSelector, api) {
        const $thead = kyoVisibleThead(api, tableSelector);
        if (!$thead.length) return null;
        if ($thead.find('tr.filters').length) return $thead.find('tr.filters');
        const $src = $thead.find('tr').first();
        if (!$src.length) return null;
        return $src.clone(true).addClass('filters').appendTo($thead);
    };

    function bindTextFilter($cell, api, idx, delay, placeholder) {
        const applyTextSearch = function (colIndex, value) {
            const v = (value || '').trim();
            api.column(colIndex).search(v, false, false);
            api.draw();
        };

        const $input = $('<input type="text" class="kyo-col-filter" autocomplete="off" />')
            .attr('placeholder', placeholder || 'Buscar…')
            .appendTo($cell.empty());

        const run = debounce(function () {
            applyTextSearch(idx, this.value);
        }, delay);

        $input
            .off('input.kyoCol keydown.kyoCol')
            .on('input.kyoCol', function (e) {
                e.stopPropagation();
                run.call(this);
            })
            .on('keydown.kyoCol', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    applyTextSearch(idx, this.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.value = '';
                    applyTextSearch(idx, '');
                }
            });
    }

    /**
     * Bind filtros por columna — estilo Oro Ambiental (rápido).
     * Compatible con scrollX: apunta al thead de .dataTables_scrollHead (el visible).
     *
     * @param {DataTables.Api} api
     * @param {Object} opts
     * @param {Array<{index:number, filterType?:'text'|'select', fetchDataFunc?:Function, placeholder?:string}>} opts.columns
     * @param {number[]} [opts.skipIndexes=[0]]
     * @param {number} [opts.debounceMs] override
     * @param {string} [opts.filtersSelector] ej '#grd_X thead tr.filters th'
     * @param {boolean} [opts.force] rebind aunque ya esté inicializado
     */
    window.kyoBindColumnFilters = async function (api, opts) {
        if (!api) return;
        opts = opts || {};
        const columns = Array.isArray(opts.columns) ? opts.columns.slice() : [];
        const skip = new Set(opts.skipIndexes || [0]);
        const serverSide = !!(api.settings && api.settings()[0] && api.settings()[0].oFeatures && api.settings()[0].oFeatures.bServerSide);
        const delay = Number.isFinite(opts.debounceMs)
            ? opts.debounceMs
            : (serverSide ? 220 : 90);

        const tableNode = api.table().node();
        if (tableNode && tableNode.dataset.kyoColFilters === '1' && !opts.force) {
            return;
        }

        const tableId = tableNode && tableNode.id ? '#' + tableNode.id : null;
        window.kyoEnsureFilterRow(tableId, api);

        const $thead = kyoVisibleThead(api, tableId);
        let $ths = opts.filtersSelector
            ? $(opts.filtersSelector)
            : $thead.find('tr.filters th');

        // Con scrollX, #grd_X thead es el oculto: siempre preferir el thead visible
        if ($thead.length) {
            const $visibleThs = $thead.find('tr.filters th');
            if ($visibleThs.length && (!$ths.length || $ths.first().closest('thead')[0] !== $thead[0])) {
                $ths = $visibleThs;
            }
        }

        // Limpiar skips (mantener celda para no desalinear columnas)
        skip.forEach(i => {
            const $cell = $ths.eq(i);
            if (!$cell.length) return;
            $cell.empty().append('<span class="kyo-col-filter-spacer" aria-hidden="true">&nbsp;</span>');
        });

        // Completar columnas faltantes con filtro texto (todas las visibles del thead)
        const configured = new Set(columns.map(c => c.index));
        const colCount = Math.max($ths.length, (api.columns && api.columns().count) ? api.columns().count() : 0);
        for (let i = 0; i < colCount; i++) {
            if (skip.has(i) || configured.has(i)) continue;
            columns.push({ index: i, filterType: 'text' });
        }

        /** @type {Record<number, {$select: JQuery, config: any, fillSelect: Function}>} */
        const selectByIndex = {};

        for (const config of columns) {
            const idx = config.index;
            if (skip.has(idx)) continue;
            const cell = $ths.eq(idx);
            if (!cell.length) continue;

            if (config.filterType === 'select') {
                const $select = $('<select class="kyo-col-filter"><option value="">Todos</option></select>')
                    .appendTo(cell.empty());

                $select.on('change', function () {
                    const val = this.value;
                    const selectedText = $(this).find('option:selected').text();
                    if (!val) {
                        api.column(idx).search('', false, false).draw();
                        return;
                    }
                    if (serverSide) {
                        api.column(idx).search(selectedText, false, false).draw();
                    } else {
                        api.column(idx).search('^' + $.fn.dataTable.util.escapeRegex(selectedText) + '$', true, false).draw();
                    }
                });

                const fillSelect = async (parentVal) => {
                    const wasS2 = !!$select.data('select2');
                    if (wasS2) {
                        try { $select.select2('destroy'); } catch (e) { /* ignore */ }
                    }
                    const keepFirst = $select.find('option').first().clone();
                    $select.empty().append(keepFirst);
                    if (typeof config.fetchDataFunc === 'function') {
                        try {
                            const lst = await config.fetchDataFunc(parentVal);
                            (lst || []).forEach(item => {
                                const id = item.Id ?? item.id ?? '';
                                const nom = item.Nombre ?? item.nombre ?? item.text ?? '';
                                $select.append($('<option>').val(id).text(nom));
                            });
                        } catch (e) {
                            console.warn('kyoBindColumnFilters select', e);
                        }
                    }
                    if (wasS2 || window.KyoSelect2?.init) {
                        if (window.KyoSelect2?.init) window.KyoSelect2.init($select[0]);
                        else $select.select2({ width: '100%', allowClear: true, placeholder: 'Todos' });
                    }
                };

                selectByIndex[idx] = { $select, config, fillSelect };

                if (config.dependsOnIndex == null) {
                    await fillSelect();
                }
                continue;
            }

            bindTextFilter(cell, api, idx, delay, config.placeholder);
        }

        // Encadenar filtros dependientes (ej. Local ← Unidad de negocio)
        Object.keys(selectByIndex).forEach((key) => {
            const idx = Number(key);
            const child = selectByIndex[idx];
            const parentIdx = child.config.dependsOnIndex;
            if (parentIdx == null) return;
            const parent = selectByIndex[parentIdx];
            if (!parent) return;

            const reloadChild = async () => {
                const parentVal = parent.$select.val();
                child.$select.val('');
                api.column(idx).search('', false, false);
                await child.fillSelect(parentVal);
                api.draw();
            };

            parent.$select.off('change.kyoDepends').on('change.kyoDepends', function () {
                reloadChild();
            });
            parent.$select.off('select2:select.kyoDepends select2:clear.kyoDepends')
                .on('select2:select.kyoDepends select2:clear.kyoDepends', function () {
                    reloadChild();
                });

            child.fillSelect(parent.$select.val());
        });

        // Evitar que el click en filtros dispare sort del header
        $thead.find('tr.filters th').off('click.DT').on('click.DT', function (e) {
            e.stopPropagation();
        });

        if (tableNode) tableNode.dataset.kyoColFilters = '1';

        try { api.columns.adjust(); } catch (e) { /* ignore */ }
    };

    /**
     * Scroll H/V sin scrollX de DataTables (evita desalineación header/body/filtros).
     * Envuelve la <table> en .kyo-dt-scroll. Opt-out: { kyoScroll: false }
     */
    window.kyoEnsureTableScrollWrap = function (api) {
        if (!api || !window.jQuery) return null;
        const $ = window.jQuery;
        const table = api.table().node();
        if (!table) return null;

        const $table = $(table);
        // Si DataTables ya creó scrollX/Y nativo, no duplicar
        if ($table.closest('.dataTables_scrollBody').length) return $table.closest('.dataTables_scrollBody');
        if ($table.parent().hasClass('kyo-dt-scroll')) return $table.parent();

        $table.wrap('<div class="kyo-dt-scroll" role="region" aria-label="Tabla con desplazamiento"></div>');
        return $table.parent();
    };

    /**
     * Defaults globales de DataTables:
     * - wrap de scroll CSS (sin scrollX nativo)
     * - filtros por columna en initComplete
     * Opt-out: { kyoScroll: false } | { kyoColumnFilters: false }
     */
    window.kyoPatchDataTableColumnFilters = function () {
        const $ = window.jQuery;
        if (!$ || !$.fn || !$.fn.DataTable || $.fn.DataTable.__kyoColFiltersPatched) return false;

        const original = $.fn.DataTable;
        $.fn.DataTable = function () {
            const args = Array.prototype.slice.call(arguments);
            const opts = args[0];
            const isInit = opts && typeof opts === 'object' && !Array.isArray(opts) &&
                (opts.columns || opts.data !== undefined || opts.ajax || opts.serverSide);

            if (isInit) {
                const wantScroll = opts.kyoScroll !== false;
                // Preferir wrap CSS (.kyo-dt-scroll). scrollX nativo solo con kyoNativeScroll: true
                if (wantScroll && opts.kyoNativeScroll !== true) {
                    opts.scrollX = false;
                }

                const wantFilters = opts.kyoColumnFilters !== false;
                if (wantFilters) {
                    if (opts.orderCellsTop == null) opts.orderCellsTop = true;
                    // Clonar fila .filters ANTES del init (si se agrega después, se desalinea todo)
                    this.each(function () {
                        const id = this.id ? '#' + this.id : null;
                        if (!id) return;
                        const $thead = $(id + ' thead');
                        if (!$thead.length || $thead.find('tr.filters').length) return;
                        const $src = $thead.find('tr').first();
                        if (!$src.length) return;
                        const $filters = $src.clone(true).addClass('filters').appendTo($thead);
                        $filters.find('th').each(function () {
                            const $th = $(this);
                            $th.removeClass('sorting sorting_asc sorting_desc sorting_disabled');
                            $th.removeAttr('aria-sort tabindex');
                            $th.off('click');
                            $th.html('');
                        });
                    });
                }

                const userInit = opts.initComplete;
                opts.initComplete = async function () {
                    const api = this.api();
                    try {
                        if (typeof userInit === 'function') {
                            await userInit.apply(this, arguments);
                        }
                    } finally {
                        if (wantFilters) {
                            const node = api.table().node();
                            if (!node || node.dataset.kyoColFilters !== '1') {
                                await window.kyoBindColumnFilters(api, {
                                    columns: opts.kyoColumnFilterColumns || [],
                                    skipIndexes: opts.kyoColumnFilterSkip || [0]
                                });
                            }
                        }

                        if (wantScroll && opts.kyoNativeScroll !== true) {
                            try { window.kyoEnsureTableScrollWrap(api); } catch (e) { /* ignore */ }
                        }

                        try { api.columns.adjust(); } catch (e) { /* ignore */ }
                    }
                };
            }

            return original.apply(this, args);
        };

        Object.keys(original).forEach(function (key) {
            $.fn.DataTable[key] = original[key];
        });
        $.fn.DataTable.__kyoColFiltersPatched = true;

        if (!$.fn.DataTable.__kyoScrollResizeBound) {
            let resizeTimer = null;
            $(window).on('resize.kyoDtScroll orientationchange.kyoDtScroll', function () {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(function () {
                    try {
                        $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust();
                    } catch (e) { /* ignore */ }
                }, 120);
            });
            $.fn.DataTable.__kyoScrollResizeBound = true;
        }

        return true;
    };

    (function bootColFiltersPatch() {
        function tryPatch() {
            if (window.kyoPatchDataTableColumnFilters()) return;
            let n = 0;
            const t = setInterval(function () {
                n += 1;
                if (window.kyoPatchDataTableColumnFilters() || n > 120) clearInterval(t);
            }, 100);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryPatch);
        } else {
            tryPatch();
        }
        window.addEventListener('load', tryPatch);
    })();

    /** Ajax server-side con cancelación de requests viejos (tipeo rápido). */
    window.kyoServerGridAjax = function (url, extraParamsFn) {
        let controller = null;
        let lastDraw = 0;

        return function (data, callback) {
            if (controller) {
                try { controller.abort(); } catch { /* ignore */ }
            }
            controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            const myDraw = data.draw;
            lastDraw = myDraw;

            const params = new URLSearchParams();
            params.set('draw', String(data.draw));
            params.set('start', String(data.start));
            params.set('length', String(data.length));

            if (data.search && data.search.value) {
                params.set('search[value]', data.search.value);
            }

            if (data.order && data.order.length) {
                params.set('order[0][column]', String(data.order[0].column));
                params.set('order[0][dir]', data.order[0].dir);
            }

            if (data.columns) {
                data.columns.forEach(function (col, i) {
                    if (col.search && col.search.value) {
                        params.set('columns[' + i + '][search][value]', col.search.value);
                    }
                });
            }

            const extra = typeof extraParamsFn === 'function' ? extraParamsFn() : {};
            Object.keys(extra || {}).forEach(function (k) {
                const v = extra[k];
                if (v !== undefined && v !== null) params.set(k, String(v));
            });

            const fetchOpts = { method: 'GET', headers: authHeaders() };
            if (controller) fetchOpts.signal = controller.signal;

            fetch(url + '?' + params.toString(), fetchOpts)
                .then(function (r) { return r.json(); })
                .then(function (json) {
                    // Ignorar respuestas viejas si llegó otra más nueva
                    if (myDraw !== lastDraw) return;
                    callback(json);
                })
                .catch(function (err) {
                    if (err && (err.name === 'AbortError' || err.code === 20)) return;
                    if (myDraw !== lastDraw) return;
                    callback({ draw: data.draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
                })
                .finally(function () {
                    if (typeof window.kyoOnServerGridRequestEnd === 'function') {
                        try { window.kyoOnServerGridRequestEnd(myDraw, lastDraw); } catch { /* ignore */ }
                    }
                });
        };
    };

    window.kyoGridReload = function (tableApi) {
        if (!tableApi) return;
        const api = tableApi.ajax ? tableApi : null;
        if (api && api.ajax) api.ajax.reload(null, false);
    };

    /** Idioma español para DataTables (sin CDN externo). */
    window.kyoDtLanguageEs = {
        decimal: ',',
        thousands: '.',
        processing: 'Procesando...',
        search: 'Buscar:',
        lengthMenu: 'Mostrar _MENU_ registros',
        info: 'Mostrando _START_ a _END_ de _TOTAL_ registros',
        infoEmpty: 'Mostrando 0 a 0 de 0 registros',
        infoFiltered: '(filtrado de _MAX_ registros)',
        infoPostFix: '',
        loadingRecords: 'Cargando...',
        zeroRecords: 'No se encontraron resultados',
        emptyTable: 'Sin datos para mostrar',
        paginate: {
            first: 'Primero',
            previous: 'Anterior',
            next: 'Siguiente',
            last: 'Último'
        },
        aria: {
            sortAscending: ': activar para ordenar ascendente',
            sortDescending: ': activar para ordenar descendente'
        }
    };
})(window);
