/**
 * Selección múltiple + eliminación masiva en DataTables.
 * Click = una fila | Ctrl/Cmd = toggle | Shift = rango.
 * FAB "Eliminar (N)" al seleccionar.
 *
 * Config por tabla (data-* o registro KYO_BULK_GRIDS):
 *   data-dt-row-select="multi" | "single" | "off"
 *   data-bulk-delete-url="/Entidad/Eliminar"
 *   data-bulk-delete-masivo="/Entidad/EliminarMasivo"
 *   data-bulk-entity="insumo"
 *   data-bulk-method="DELETE" | "POST"
 */
(function (w, $) {
    if (!$) return;

    const INTERACTIVE_SEL = [
        'button', 'a', 'input', 'select', 'textarea', 'label',
        '.rp-row-actions', '.btn', '.dropdown-menu', '.btn-ico',
        '.vp-edit', '.vp-accept', '.vp-cancel', '.select2-container',
        '.icon-btn'
    ].join(',');

    const SEL_CLASSES = ['dt-row-selected', 'selected', 'seleccionada', 'row-selected'];

    /** Grillas conocidas (Index) — se pueden sobrescribir con data-* */
    const KYO_BULK_GRIDS = {
        '#grd_Insumos': {
            deleteUrl: '/Insumos/Eliminar',
            entity: 'insumo',
            onDeleted: function () {
                if (typeof aplicarFiltrosInsumos === 'function') aplicarFiltrosInsumos();
                else if (w.gridInsumos) kyoGridReload(w.gridInsumos);
            }
        },
        '#grd_Proveedores': {
            deleteUrl: '/Proveedores/Eliminar',
            entity: 'proveedor',
            onDeleted: function () {
                if (typeof listaProveedores === 'function') listaProveedores();
                else if (w.gridProveedores) kyoGridReload(w.gridProveedores);
            }
        },
        '#grd_InsumosProveedor': {
            deleteMasivoUrl: '/ProveedoresInsumos/EliminarMasivo',
            deleteUrl: '/ProveedoresInsumos/Eliminar',
            entity: 'insumo de proveedor',
            onDeleted: function () {
                if (typeof aplicarFiltros === 'function') aplicarFiltros();
                else if (w.gridInsumos) kyoGridReload(w.gridInsumos);
            }
        },
        '#grd_Recetas': {
            deleteUrl: '/Recetas/Eliminar',
            entity: 'receta',
            onDeleted: function () {
                if (typeof aplicarFiltros === 'function') aplicarFiltros();
                else if (w.gridRecetas) kyoGridReload(w.gridRecetas);
            }
        },
        '#grd_SubRecetas': {
            deleteUrl: '/SubRecetas/Eliminar',
            entity: 'subreceta',
            onDeleted: function () {
                if (typeof aplicarFiltros === 'function') aplicarFiltros();
                else if (w.gridSubRecetas) kyoGridReload(w.gridSubRecetas);
            }
        },
        '#grd_OrdenesCompra': {
            deleteUrl: '/OrdenesCompras/Eliminar',
            entity: 'orden de compra',
            onDeleted: function () {
                if (typeof aplicarFiltrosOC === 'function') aplicarFiltrosOC();
                else if (w.gridOrdenes) kyoGridReload(w.gridOrdenes);
            }
        },
        '#grd_Compras': {
            deleteUrl: '/Compras/Eliminar',
            entity: 'compra',
            onDeleted: function () {
                if (typeof aplicarFiltrosCompras === 'function') aplicarFiltrosCompras();
                else if (w.gridCompras) kyoGridReload(w.gridCompras);
            }
        },
        '#grd_Usuarios': {
            deleteUrl: '/Usuarios/Eliminar',
            entity: 'usuario',
            onDeleted: function () {
                if (typeof listaUsuarios === 'function') listaUsuarios();
                else if (w.gridUsuarios) kyoGridReload(w.gridUsuarios);
            }
        },
        '#grd_Ventas': {
            deleteUrl: '/Ventas/Eliminar',
            method: 'POST',
            bodyMode: 'jsonId',
            entity: 'importación',
            onDeleted: function () {
                if (w.gridVentas && typeof kyoGridReload === 'function') kyoGridReload(w.gridVentas);
                if (typeof cargarKpis === 'function') cargarKpis();
            }
        }
    };

    const stateByTable = new WeakMap();

    function authHdrs() {
        if (typeof authHeaders === 'function') return authHeaders();
        const t = w.token
            || (typeof token !== 'undefined' ? token : null)
            || localStorage.getItem('JwtToken')
            || localStorage.getItem('token')
            || '';
        const h = { Accept: 'application/json', 'Content-Type': 'application/json' };
        if (t) h.Authorization = 'Bearer ' + t;
        return h;
    }

    function ensureFab() {
        let fab = document.getElementById('kyoBulkDeleteFab');
        if (fab) return fab;
        fab = document.createElement('button');
        fab.id = 'kyoBulkDeleteFab';
        fab.type = 'button';
        fab.className = 'kyo-bulk-fab';
        fab.setAttribute('aria-label', 'Eliminar seleccionados');
        fab.innerHTML = '<i class="fa fa-trash" aria-hidden="true"></i><span class="kyo-bulk-fab__label">Eliminar</span><span class="kyo-bulk-fab__count">(0)</span>';
        fab.hidden = true;
        document.body.appendChild(fab);
        fab.addEventListener('click', onFabClick);
        return fab;
    }

    function getActiveBulkState() {
        let found = null;
        document.querySelectorAll('table.dataTable, table.dt-dark').forEach((table) => {
            const st = stateByTable.get(table);
            if (st && st.selected.size > 0) found = st;
        });
        return found;
    }

    function updateFab(st) {
        const fab = ensureFab();
        const active = st && st.selected.size > 0 ? st : getActiveBulkState();
        const cfg = active && (active.config || resolveConfig(active.table));
        const canDelete = !!(cfg && (cfg.deleteUrl || cfg.deleteMasivoUrl));
        if (!active || active.selected.size === 0 || !canDelete) {
            fab.classList.remove('is-visible');
            fab.hidden = true;
            fab.dataset.tableId = '';
            return;
        }
        const n = active.selected.size;
        fab.querySelector('.kyo-bulk-fab__count').textContent = '(' + n + ')';
        fab.dataset.tableId = active.table.id || '';
        fab.hidden = false;
        fab.classList.add('is-visible');
    }

    function rowIdFromData(data) {
        if (!data) return '';
        const id = data.Id ?? data.id;
        return id == null || id === '' ? '' : String(id);
    }

    function getDt(table) {
        if (!$.fn.dataTable || !$.fn.dataTable.isDataTable(table)) return null;
        return $(table).DataTable();
    }

    function clearClasses(tr) {
        if (!tr) return;
        SEL_CLASSES.forEach((c) => tr.classList.remove(c));
    }

    function applyClasses(tr) {
        if (!tr) return;
        tr.classList.add('dt-row-selected', 'selected', 'row-selected');
    }

    function syncVisual(st) {
        const dt = st.dt || getDt(st.table);
        if (!dt) return;
        dt.rows({ page: 'current' }).every(function () {
            const id = rowIdFromData(this.data());
            const tr = this.node();
            if (!tr) return;
            if (id && st.selected.has(id)) applyClasses(tr);
            else clearClasses(tr);
        });
        updateFab(st);
    }

    function resolveConfig(table) {
        const idSel = table.id ? '#' + table.id : '';
        const preset = (idSel && KYO_BULK_GRIDS[idSel]) ? { ...KYO_BULK_GRIDS[idSel] } : {};
        const ds = table.dataset || {};
        if (ds.bulkDeleteUrl) preset.deleteUrl = ds.bulkDeleteUrl;
        if (ds.bulkDeleteMasivo) preset.deleteMasivoUrl = ds.bulkDeleteMasivo;
        if (ds.bulkEntity) preset.entity = ds.bulkEntity;
        if (ds.bulkMethod) preset.method = ds.bulkMethod;
        return preset;
    }

    function getMode(table) {
        const raw = (table.getAttribute('data-dt-row-select') || '').toLowerCase();
        if (raw === 'off' || raw === 'none') return 'off';
        if (raw === 'single') return 'single';
        if (raw === 'multi') return 'multi';
        // Por defecto: multi si hay config de delete, si no single
        const cfg = resolveConfig(table);
        if (cfg.deleteUrl || cfg.deleteMasivoUrl) return 'multi';
        return 'single';
    }

    function isSelectable(table) {
        if (!table) return false;
        if (getMode(table) === 'off') return false;
        return table.classList.contains('dataTable')
            || table.classList.contains('dt-dark')
            || ($.fn.dataTable && $.fn.dataTable.isDataTable(table));
    }

    function ensureState(table) {
        let st = stateByTable.get(table);
        if (st) return st;
        st = {
            table,
            selected: new Set(),
            lastIndex: null,
            dt: null,
            config: resolveConfig(table),
            mode: getMode(table)
        };
        stateByTable.set(table, st);
        return st;
    }

    function handleRowClick(e) {
        const tr = e.currentTarget;
        const table = tr.closest('table');
        if (!isSelectable(table)) return;
        if ($(e.target).closest(INTERACTIVE_SEL).length) return;

        const st = ensureState(table);
        st.mode = getMode(table);
        st.config = resolveConfig(table);
        if (st.mode === 'off') return;

        const dt = getDt(table);
        st.dt = dt;
        if (!dt) {
            // Sin DataTable: toggle simple
            if (st.mode === 'multi' && (e.ctrlKey || e.metaKey)) {
                if (tr.classList.contains('dt-row-selected')) clearClasses(tr);
                else applyClasses(tr);
            } else {
                table.querySelectorAll('tbody tr').forEach((r) => clearClasses(r));
                applyClasses(tr);
            }
            return;
        }

        const row = dt.row(tr);
        const id = rowIdFromData(row.data());
        if (!id) return;

        const nodes = Array.from(dt.rows({ order: 'applied', search: 'applied' }).nodes());
        const currentIndex = nodes.indexOf(tr);

        if (st.mode === 'single') {
            st.selected.clear();
            st.selected.add(id);
            st.lastIndex = currentIndex;
        } else if (e.shiftKey && st.lastIndex != null) {
            const start = Math.min(st.lastIndex, currentIndex);
            const end = Math.max(st.lastIndex, currentIndex);
            st.selected.clear();
            for (let i = start; i <= end; i++) {
                const rid = rowIdFromData(dt.row(nodes[i]).data());
                if (rid) st.selected.add(rid);
            }
        } else if (e.ctrlKey || e.metaKey) {
            if (st.selected.has(id)) st.selected.delete(id);
            else st.selected.add(id);
            st.lastIndex = currentIndex;
        } else {
            st.selected.clear();
            st.selected.add(id);
            st.lastIndex = currentIndex;
        }

        syncVisual(st);
    }

    function bindTable(table) {
        if (!table || table.dataset.kyoBulkBound) return;
        table.dataset.kyoBulkBound = '1';
        ensureState(table);
        $(table).on('click.kyoBulk', 'tbody tr', handleRowClick);

        if ($.fn.dataTable && $.fn.dataTable.isDataTable(table)) {
            const dt = $(table).DataTable();
            const st = ensureState(table);
            st.dt = dt;
            dt.on('draw.kyoBulk', function () {
                syncVisual(st);
            });
        }
    }

    function scanTables(root) {
        (root || document).querySelectorAll('table.dataTable, table.dt-dark').forEach(bindTable);
    }

    async function deleteOne(cfg, id, cascade) {
        const method = (cfg.method || 'DELETE').toUpperCase();
        const headers = authHdrs();

        if (cfg.bodyMode === 'jsonId') {
            const r = await fetch(cfg.deleteUrl, {
                method: method === 'DELETE' ? 'POST' : method,
                headers,
                body: JSON.stringify({ Id: Number(id) })
            });
            if (!r.ok) throw new Error(await r.text().catch(() => 'Error al eliminar'));
            return r.json();
        }

        let url = cfg.deleteUrl || '';
        const sep = url.includes('?') ? '&' : '?';
        if (!/[?&]id=/i.test(url)) url += `${sep}id=${encodeURIComponent(id)}`;
        if (cascade) url += (url.includes('?') ? '&' : '?') + 'cascade=true';

        const r = await fetch(url, { method, headers });
        if (!r.ok) throw new Error(await r.text().catch(() => 'Error al eliminar'));
        return r.json();
    }

    function needsCascade(j) {
        return (j?.tipo === 'relacion' || j?.Tipo === 'relacion')
            || (Array.isArray(j?.dependencias) && j.dependencias.length > 0)
            || (Array.isArray(j?.Dependencias) && j.Dependencias.length > 0);
    }

    async function onFabClick() {
        const st = getActiveBulkState();
        if (!st || st.selected.size === 0) return;

        const cfg = st.config || resolveConfig(st.table);
        if (!cfg.deleteUrl && !cfg.deleteMasivoUrl) {
            if (typeof advertenciaModal === 'function')
                advertenciaModal('Esta grilla no permite eliminación masiva.');
            return;
        }

        const ids = Array.from(st.selected).map(Number).filter((x) => !Number.isNaN(x));
        if (ids.length === 0) return;

        const entity = cfg.entity || 'registro';
        const plural = ids.length === 1 ? entity : (entity.endsWith('s') ? entity : entity + 's');
        const ok = await (typeof confirmarModal === 'function'
            ? confirmarModal(`¿Eliminar ${ids.length} ${plural} seleccionado(s)?`, {
                title: 'Eliminar',
                okText: 'Sí, eliminar',
                cancelText: 'Cancelar'
            })
            : Promise.resolve(window.confirm(`¿Eliminar ${ids.length}?`)));
        if (!ok) return;

        try {
            let partialWarn = false;
            if (cfg.deleteMasivoUrl) {
                const res = await fetch(cfg.deleteMasivoUrl, {
                    method: 'POST',
                    headers: authHdrs(),
                    body: JSON.stringify({ ids })
                });
                if (!res.ok) throw new Error('No se pudo eliminar.');
                const j = await res.json();
                if (j?.valor !== true && j?.Valor !== true && j?.ok !== true) {
                    throw new Error(j?.mensaje || j?.Mensaje || 'La operación no pudo completarse.');
                }
            } else {
                let cascadeAll = false;
                let okCount = 0;
                const failed = [];

                for (const id of ids) {
                    let j = await deleteOne(cfg, id, cascadeAll);
                    if (j?.valor || j?.Valor || j?.ok) {
                        okCount++;
                        continue;
                    }
                    if (!cascadeAll && needsCascade(j) && (j?.cascadeDisponible === true || j?.CascadeDisponible === true)) {
                        const aceptar = typeof kyoConfirmarCascada === 'function'
                            ? await kyoConfirmarCascada({
                                titulo: 'Registros asociados',
                                mensaje: (j.mensaje || j.Mensaje || 'Hay asociaciones.') +
                                    ' ¿Eliminar en cascada los restantes seleccionados?',
                                dependencias: j.dependencias || j.Dependencias || []
                            })
                            : window.confirm('¿Eliminar en cascada?');
                        if (!aceptar) {
                            failed.push(id);
                            break;
                        }
                        cascadeAll = true;
                        j = await deleteOne(cfg, id, true);
                        if (j?.valor || j?.Valor || j?.ok) okCount++;
                        else failed.push(id);
                    } else {
                        failed.push(id);
                    }
                }

                if (failed.length && okCount === 0) {
                    throw new Error('No se pudo eliminar ninguno de los seleccionados.');
                }
                if (failed.length && typeof advertenciaModal === 'function') {
                    partialWarn = true;
                    advertenciaModal(`Se eliminaron ${okCount}. No se pudieron eliminar ${failed.length}.`);
                }
            }

            st.selected.clear();
            st.lastIndex = null;
            syncVisual(st);
            updateFab(null);

            if (typeof cfg.onDeleted === 'function') await cfg.onDeleted();
            else if (st.dt) {
                if (typeof kyoGridReload === 'function') kyoGridReload(st.dt);
                else st.dt.ajax.reload(null, false);
            }

            if (!partialWarn && typeof exitoModal === 'function')
                exitoModal('Eliminados correctamente.');
        } catch (err) {
            console.error(err);
            if (typeof errorModal === 'function') errorModal(err.message || 'No se pudo eliminar.');
        }
    }

    $(document).ready(function () {
        ensureFab();
        scanTables();

        if (typeof MutationObserver !== 'undefined') {
            const obs = new MutationObserver((muts) => {
                muts.forEach((m) => {
                    m.addedNodes.forEach((node) => {
                        if (node.nodeType !== 1) return;
                        if (node.matches?.('table.dataTable, table.dt-dark')) bindTable(node);
                        else scanTables(node);
                    });
                });
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }
    });

    if ($.fn.dataTable && !$.fn.dataTable.ext._kyoBulkInit) {
        $.fn.dataTable.ext._kyoBulkInit = true;
        $(document).on('init.dt', function (_e, settings) {
            bindTable(settings.nTable);
            const st = ensureState(settings.nTable);
            st.dt = $(settings.nTable).DataTable();
            st.config = resolveConfig(settings.nTable);
            st.mode = getMode(settings.nTable);
        });
    }

    w.KyoBulkSelect = {
        grids: KYO_BULK_GRIDS,
        bind: bindTable,
        clear: function (tableOrSel) {
            const table = typeof tableOrSel === 'string'
                ? document.querySelector(tableOrSel)
                : tableOrSel;
            if (!table) return;
            const st = stateByTable.get(table);
            if (!st) return;
            st.selected.clear();
            st.lastIndex = null;
            syncVisual(st);
        },
        getSelected: function (tableOrSel) {
            const table = typeof tableOrSel === 'string'
                ? document.querySelector(tableOrSel)
                : tableOrSel;
            const st = table && stateByTable.get(table);
            return st ? Array.from(st.selected) : [];
        }
    };

    // Compat con API previa
    w.KyoDataTableRows = {
        clearTableSelection: function (table, except) {
            if (!table) return;
            const st = stateByTable.get(table);
            if (st) {
                st.selected.clear();
                if (except) {
                    const id = except.getAttribute?.('data-id');
                    // best-effort: re-read from DT
                    const dt = getDt(table);
                    if (dt) {
                        const row = dt.row(except);
                        const rid = rowIdFromData(row.data());
                        if (rid) st.selected.add(rid);
                    }
                }
                syncVisual(st);
                return;
            }
            table.querySelectorAll('tbody tr').forEach((tr) => {
                if (tr !== except) clearClasses(tr);
            });
        },
        clearRowSelection: clearClasses,
        applyRowSelection: applyClasses,
        bindTable: bindTable
    };
})(window, window.jQuery);
