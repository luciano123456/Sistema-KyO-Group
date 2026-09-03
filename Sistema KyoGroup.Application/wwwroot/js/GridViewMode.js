/**
 * Vista global de listados: auto / tabla / cards.
 * Preferencia en localStorage (rpGridViewPref).
 */
(function (window, $) {
    "use strict";

    if (!$) return;

    const STORAGE_KEY = "rpGridViewPref";
    const LEGACY_KEY = "cgViewPref";
    const BREAKPOINT = 992;
    const VALID_PREFS = ["auto", "table", "cards"];

    const schemas = {};
    const grids = {};
    let resizeTimer;

    function normalizePref(pref) {
        return VALID_PREFS.includes(pref) ? pref : "auto";
    }

    function migrateLegacyPref() {
        if (localStorage.getItem(STORAGE_KEY)) return;
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
            localStorage.setItem(STORAGE_KEY, normalizePref(legacy));
        }
    }

    function getPref() {
        migrateLegacyPref();
        return normalizePref(localStorage.getItem(STORAGE_KEY) || "auto");
    }

    function setPref(pref, options = {}) {
        const value = normalizePref(pref);
        localStorage.setItem(STORAGE_KEY, value);
        if (!options.silent) {
            localStorage.setItem(LEGACY_KEY, value);
        }
        syncSwitchUi(value);
        applyGlobalMode(value);
        if (!options.skipAdjust) {
            programarAjuste();
        }
        $(document).trigger("rpGridViewChanged", [value]);
        return value;
    }

    function debeMostrarTabla(pref) {
        const mode = normalizePref(pref ?? getPref());
        if (mode === "cards") return false;
        if (mode === "table") return true;
        return window.innerWidth > BREAKPOINT;
    }

    function findPageRoot($el) {
        const $page = $el.closest(".cg-page, .cl-page, .page-99, [class*='-page']");
        if ($page.length) return $page.first();
        return $el.closest(".container-fluid, main, body");
    }

    function syncSwitchUi(pref) {
        const value = normalizePref(pref ?? getPref());
        $(".rp-view-switch, .cg-view-switch").each(function () {
            $(this).find(".rp-view-btn, .cg-view-btn").removeClass("is-active");
            $(this).find(`.rp-view-btn[data-rp-view="${value}"], .cg-view-btn[data-cg-view="${value}"]`).addClass("is-active");
        });
        $(".rp-config-view-opt").removeClass("is-active");
        $(`.rp-config-view-card[data-rp-view="${value}"], .rp-config-view-opt[data-rp-view="${value}"]`).addClass("is-active");
        const $select = $("#rpConfigViewMode");
        if ($select.length) $select.val(value);
    }

    function applyModeToRoot($root, pref) {
        if (!$root?.length) return;
        const mode = normalizePref(pref ?? getPref());
        $root.removeClass("rp-view-mode-auto rp-view-mode-table rp-view-mode-cards cg-mode-auto cg-mode-table cg-mode-cards");
        $root.addClass(`rp-view-mode-${mode}`);
        if ($root.hasClass("cg-page")) {
            $root.addClass(`cg-mode-${mode}`);
        }
    }

    function applyGlobalMode(pref) {
        const mode = normalizePref(pref ?? getPref());
        $(".cg-page, .cl-page, .page-99, .ld-index, .container.page-99").each(function () {
            applyModeToRoot($(this), mode);
        });

        if (debeMostrarTabla(mode)) {
            Object.keys(grids).forEach(key => lazyInitGrid(key));
            programarAjuste();
        } else {
            Object.keys(grids).forEach(key => renderCards(key));
        }
    }

    function viewSwitchHtml(id) {
        return `
<div class="rp-view-switch" id="${id}" title="Modo de visualizacion de listados">
    <span class="rp-view-switch-label">Vista</span>
    <button type="button" class="rp-view-btn is-active" data-rp-view="auto" title="Automatico"><i class="fa fa-magic"></i><span>Auto</span></button>
    <button type="button" class="rp-view-btn" data-rp-view="table" title="Tabla"><i class="fa fa-table"></i><span>Tabla</span></button>
    <button type="button" class="rp-view-btn" data-rp-view="cards" title="Tarjetas"><i class="fa fa-th-large"></i><span>Cards</span></button>
</div>`;
    }

    function ensureViewSwitch() {
        /* Vista de listados: solo en Configuraciones del navbar */
    }

    function deriveGridKey(tableId) {
        return tableId
            .replace(/^grd_/i, "")
            .replace(/Cg$/i, "")
            .replace(/([A-Z])/g, "_$1")
            .toLowerCase()
            .replace(/^_/, "")
            .replace(/_/g, "");
    }

    function ensureCardsContainer($wrap, key) {
        const legacyId = `#cgCards_${key}`;
        let $cards = $(legacyId);
        if (!$cards.length) {
            $cards = $(`#rpCards_${key}`);
        }
        if (!$cards.length) {
            $cards = $(`<div class="rp-cards-grid cg-cards-grid" id="rpCards_${key}"></div>`);
            $wrap.before($cards);
        }

        let $panel = $wrap.parent(".rp-grid-panel");
        if (!$panel.length) {
            $wrap.add($cards).wrapAll('<div class="rp-grid-panel"></div>');
            $panel = $wrap.parent(".rp-grid-panel");
        }

        $wrap.addClass("rp-table-wrap cg-table-wrap");
        return { $cards, $panel };
    }

    function escapeHtml(text) {
        return String(text ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function buildGenericCard(api, rowIdx, schema) {
        const row = api.row(rowIdx).data();
        if (!row) return "";

        if (schema && !schema.manual) {
            return buildSchemaCard(row, schema);
        }

        const cols = api.settings()[0].aoColumns;
        const visibleCols = [];
        api.columns().every(function (i) {
            if (!api.column(i).visible()) return;
            visibleCols.push({
                index: i,
                title: cols[i].sTitle || "",
                display: api.cell(rowIdx, i).render("display")
            });
        });

        const dataCols = visibleCols.filter(c => c.index > 1);
        const actionsHtml = visibleCols.find(c => c.index === 0)?.display || "";
        const idDisplay = visibleCols.find(c => c.index === 1)?.display || "";
        const titleCol = dataCols[0];
        const subCol = dataCols[1];
        const fields = dataCols.slice(2).map(c => `
            <div class="rp-card-field ${dataCols.length <= 3 ? "rp-card-field--full" : ""}">
                <span>${escapeHtml(c.title)}</span>
                <strong>${c.display || "-"}</strong>
            </div>`).join("");

        const rowId = row.Id ?? row.id ?? "";
        const dblUrl = api.table().node().getAttribute("data-dt-dblclick-url") || "";

        return `
<article class="rp-data-card cg-data-card rp-data-card--blue cg-data-card--blue rp-card-selectable" data-row-id="${escapeHtml(rowId)}" tabindex="0" role="button">
    <div class="rp-data-card-head cg-data-card-head">
        <div>
            <div class="rp-data-card-title cg-data-card-title">${titleCol?.display || "-"}</div>
            ${subCol ? `<div class="rp-data-card-sub cg-data-card-sub">${subCol.display || ""}</div>` : ""}
        </div>
        ${idDisplay ? `<span class="rp-data-card-badge cg-data-card-badge">${idDisplay}</span>` : ""}
    </div>
    ${fields ? `<div class="rp-data-card-body cg-data-card-body">${fields}</div>` : ""}
    ${actionsHtml ? `<div class="rp-data-card-foot cg-data-card-foot">${actionsHtml}</div>` : ""}
</article>`;
    }

    function buildSchemaCard(row, schema) {
        const fields = (schema.fields || []).map(f => `
            <div class="rp-card-field cg-card-field ${f.full ? "rp-card-field--full cg-card-field--full" : ""}">
                <span>${escapeHtml(f.label)}</span>
                <strong class="${f.cls || ""}">${escapeHtml(f.value ? f.value(row) : "")}</strong>
            </div>`).join("");

        const tone = schema.tone ? schema.tone(row) : "rp-data-card--blue cg-data-card--blue";
        const badge = schema.badge ? schema.badge(row) : (row.Id ? `#${row.Id}` : "");
        const actions = schema.actions ? schema.actions(row) : "";

        const rowId = row.Id ?? row.id ?? "";
        return `
<article class="rp-data-card cg-data-card ${tone} rp-card-selectable" data-row-id="${escapeHtml(rowId)}" tabindex="0" role="button">
    <div class="rp-data-card-head cg-data-card-head">
        <div>
            <div class="rp-data-card-title cg-data-card-title">${escapeHtml(schema.title ? schema.title(row) : "")}</div>
            ${schema.subtitle ? `<div class="rp-data-card-sub cg-data-card-sub">${escapeHtml(schema.subtitle(row) || "")}</div>` : ""}
        </div>
        ${badge ? `<span class="rp-data-card-badge cg-data-card-badge">${escapeHtml(badge)}</span>` : ""}
    </div>
    ${fields ? `<div class="rp-data-card-body cg-data-card-body">${fields}</div>` : ""}
    ${actions ? `<div class="rp-data-card-foot cg-data-card-foot">${actions}</div>` : ""}
</article>`;
    }

    function renderCards(key) {
        const grid = grids[key];
        if (!grid) return;

        if (debeMostrarTabla()) return;

        const schema = schemas[key];
        if (grid.manualRender || schema?.manualRender) {
            if (typeof grid.renderManual === "function") {
                const data = typeof grid.getData === "function" ? grid.getData() : [];
                grid.renderManual(data);
            }
            return;
        }

        if (!grid?.api) return;

        const $cards = grid.$cards;
        if (!$cards?.length) return;

        const api = grid.api;
        const indexes = api.rows({ page: 'current', search: 'applied' }).indexes();
        if (!indexes.length) {
            $cards.html('<div class="rp-cards-empty cg-cards-empty"><i class="fa fa-inbox" aria-hidden="true"></i><span class="kyo-empty-text">Sin registros para mostrar.</span></div>');
            return;
        }

        const html = [];
        indexes.each(idx => {
            html.push(buildGenericCard(api, idx, schema));
        });
        $cards.html(html.join(""));
        restoreCardSelection($cards);
    }

    function isInteractiveCardTarget(e) {
        return $(e.target).closest("a, button, .btn, .cg-card-btn, .rp-card-btn, input, select, label, .rp-switch, .dropdown-menu").length > 0;
    }

    function cardSelectionKey($card) {
        const rowId = $card.data("rowId");
        if (rowId !== undefined && rowId !== "") return `id:${rowId}`;
        if ($card.data("anio") !== undefined && $card.data("mes") !== undefined) {
            return `cm:${$card.data("anio")}-${$card.data("mes")}`;
        }
        return `idx:${$card.index()}`;
    }

    function seleccionarCard($card) {
        const $grid = $card.closest(".rp-cards-grid, .cg-cards-grid");
        if (!$grid.length) return;

        const key = cardSelectionKey($card);
        const wasSelected = $card.hasClass("is-selected");

        $grid.find(".rp-data-card.is-selected, .cg-data-card.is-selected").removeClass("is-selected");
        $grid.data("rpSelectedKey", "");

        if (!wasSelected) {
            $card.addClass("is-selected");
            $grid.data("rpSelectedKey", key);
        }
    }

    function restoreCardSelection($grid) {
        const key = $grid.data("rpSelectedKey");
        if (!key) return;

        const $match = $grid.find(".rp-data-card, .cg-data-card").filter(function () {
            return cardSelectionKey($(this)) === key;
        }).first();

        if ($match.length) $match.addClass("is-selected");
    }

    function findGridTable($grid) {
        const $panel = $grid.closest(".rp-grid-panel, .cg-list-panel, .card-glass, .cl-grid-card, .cl-page, .page-99");
        return $panel.find("table[id^='grd_']").first();
    }

    function findRowForCard(gridKey, rowId) {
        const grid = grids[gridKey];
        if (grid?.api) {
            const rows = grid.api.rows().data().toArray();
            return rows.find(r => String(r.Id ?? r.id ?? "") === String(rowId));
        }
        if (window.CG?.listMeta?.[gridKey]?.data) {
            return window.CG.listMeta[gridKey].data.find(r => String(r.Id ?? r.id ?? "") === String(rowId));
        }
        return null;
    }

    function gridKeyFromCardsContainer($grid) {
        const id = $grid.attr("id") || "";
        return id.replace(/^cgCards_/i, "").replace(/^rpCards_/i, "");
    }

    function ejecutarDobleClickCard($card) {
        const rowId = $card.data("rowId");
        const $grid = $card.closest(".rp-cards-grid, .cg-cards-grid");
        const gridKey = gridKeyFromCardsContainer($grid);

        if ($card.hasClass("cg-data-card--cm")) {
            if (typeof window.abrirModalControlMensual === "function") {
                window.abrirModalControlMensual(Number($card.data("anio")), Number($card.data("mes")));
            }
            return;
        }

        const $table = findGridTable($grid);
        if ($table.length && rowId) {
            const urlTpl = $table.attr("data-dt-dblclick-url") || $table.data("dtDblclickUrl");
            if (urlTpl) {
                window.location.href = String(urlTpl).replace("{id}", rowId);
                return;
            }
        }

        const schema = schemas[gridKey];
        if (schema?.dblClick && rowId) {
            const row = findRowForCard(gridKey, rowId);
            if (row) {
                schema.dblClick(row);
                return;
            }
        }
    }

    function initCardInteractions() {
        $(document)
            .off("click.rpCardSelect")
            .on("click.rpCardSelect", ".rp-cards-grid .rp-data-card, .rp-cards-grid .cg-data-card, .cg-cards-grid .rp-data-card, .cg-cards-grid .cg-data-card", function (e) {
                if (isInteractiveCardTarget(e)) return;
                seleccionarCard($(this));
            });

        $(document)
            .off("dblclick.rpCardNav")
            .on("dblclick.rpCardNav", ".rp-cards-grid .rp-data-card, .rp-cards-grid .cg-data-card, .cg-cards-grid .rp-data-card, .cg-cards-grid .cg-data-card", function (e) {
                if (isInteractiveCardTarget(e)) return;
                e.preventDefault();
                seleccionarCard($(this));
                ejecutarDobleClickCard($(this));
            });
    }

    function ajustarGrilla(key) {
        const grid = grids[key];
        if (!grid?.api?.columns) return;
        try {
            const settings = grid.api.settings()[0];
            const scrollBody = settings?.nScrollBody;
            if (settings?.oScroll?.sX && scrollBody && !scrollBody.style) return;
            grid.api.columns.adjust();
            if (grid.api.fixedHeader?.adjust) {
                grid.api.fixedHeader.adjust();
            }
        } catch { /* noop */ }
    }

    function programarAjuste() {
        requestAnimationFrame(() => {
            ajustarTodas();
            setTimeout(ajustarTodas, 80);
        });
    }

    function ajustarTodas() {
        if (!debeMostrarTabla()) return;
        Object.keys(grids).forEach(ajustarGrilla);
        try {
            if ($.fn.dataTable?.tables) {
                $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust();
            }
        } catch { /* noop */ }
    }

    function lazyInitGrid(key) {
        const grid = grids[key];
        if (!grid || grid.api || !grid.pendingInit) return;
        if (!debeMostrarTabla()) return;

        const meta = grid.meta;
        if (!meta?.selector) return;

        grid.api = $(meta.selector).DataTable(meta.options);
        grid.pendingInit = false;
        programarAjuste();
    }

    function registerGrid(key, info) {
        grids[key] = Object.assign(grids[key] || {}, info);
    }

    function attachFromSettings(settings) {
        const table = settings.nTable;
        const tableId = table.id;
        if (!tableId || !tableId.startsWith("grd_")) return;

        const $table = $(table);
        if ($table.is("[data-rp-no-cards]")) return;

        const key = deriveGridKey(tableId);
        const api = new $.fn.dataTable.Api(settings);
        const $wrap = $table.closest(".dt-dark-wrap, .cg-table-wrap");
        if (!$wrap.length) return;

        const pageRoot = findPageRoot($table);
        const { $cards } = ensureCardsContainer($wrap, key);

        registerGrid(key, {
            key,
            tableId,
            selector: `#${tableId}`,
            api,
            $cards,
            $wrap,
            pageRoot
        });

        applyModeToRoot(pageRoot);
        renderCards(key);

        if (debeMostrarTabla()) {
            programarAjuste();
        }
    }

    function registerSchema(key, schema) {
        schemas[key] = schema || {};
    }

    function initSwitch(containerSelector, pageSelector) {
        const $container = containerSelector ? $(containerSelector) : $(document);
        $container.on("click", ".rp-view-btn, .cg-view-btn, .rp-config-view-opt, .rp-config-view-card", function () {
            const pref = $(this).data("rpView") || $(this).data("cgView") || "auto";
            setPref(pref);
        });
        syncSwitchUi(getPref());
        if (pageSelector) {
            applyModeToRoot($(pageSelector), getPref());
        }
    }

    function initConfigPanel() {
        syncSwitchUi(getPref());
    }

    function configurarGrillaLista(key, selector, data, columns, opts = {}) {
        const cardsSelector = opts.cardsSelector || `#cgCards_${key}`;
        let $cards = $(cardsSelector);
        if (!$cards.length) {
            $cards = $(`#rpCards_${key}`);
        }

        registerGrid(key, {
            key,
            selector,
            meta: { selector, options: buildDtOptions(data, columns, opts) },
            pendingInit: false,
            $cards,
            manualRender: !!schemas[key]?.manualRender,
            getData: () => data
        });

        if (grids[key].api) {
            grids[key].api.clear().rows.add(data).draw(false);
            if (debeMostrarTabla()) programarAjuste();
        } else if (debeMostrarTabla()) {
            grids[key].api = $(selector).DataTable(grids[key].meta.options);
        } else {
            grids[key].pendingInit = true;
        }

        if (schemas[key]?.manualRender && typeof opts.renderCards === "function") {
            opts.renderCards(data);
        } else if (!schemas[key]?.manualRender) {
            renderCards(key);
        }

        return grids[key].api;
    }

    function buildDtOptions(data, columns, opts) {
        return {
            data,
            columns,
            language: { url: "//cdn.datatables.net/plug-ins/2.0.7/i18n/es-MX.json" },
            autoWidth: false,
            scrollX: false,
            pageLength: opts.pageLength ?? 10,
            paging: opts.paging !== false,
            searching: opts.searching !== false,
            info: opts.info !== false,
            dom: opts.dom || "frtip",
            order: opts.order || [[1, "desc"]]
        };
    }

    function registerManualList(key, options = {}) {
        const $wrap = $(options.wrap);
        if (!$wrap.length) return null;

        const $page = options.pageRoot ? $(options.pageRoot) : findPageRoot($wrap);
        let $cards = options.cards ? $(options.cards) : $(`#rpCards_${key}`);
        if (!$cards.length) {
            $cards = $(`<div class="rp-cards-grid cg-cards-grid" id="rpCards_${key}"></div>`);
            $wrap.before($cards);
        }

        if (!$wrap.parent(".rp-grid-panel").length) {
            $wrap.add($cards).wrapAll('<div class="rp-grid-panel"></div>');
        }

        $wrap.addClass("rp-table-wrap cg-table-wrap");

        registerSchema(key, { manualRender: true });
        registerGrid(key, {
            key,
            manualRender: true,
            $cards,
            $wrap,
            pageRoot: $page,
            getData: options.getData,
            renderManual: options.renderCards
        });

        applyModeToRoot($page.length ? $page : findPageRoot($wrap));
        renderCards(key);
        return grids[key];
    }

    const RpGridView = {
        STORAGE_KEY,
        BREAKPOINT,
        getPref,
        setPref,
        debeMostrarTabla,
        applyGlobalMode,
        applyModeToRoot,
        syncSwitchUi,
        initSwitch,
        initConfigPanel,
        registerSchema,
        registerGrid,
        renderCards,
        restoreCardSelection,
        programarAjuste,
        ajustarTodas,
        configurarGrillaLista,
        registerManualList,
        ensureViewSwitch,
        viewSwitchHtml
    };

    window.RpGridView = RpGridView;

    $(function () {
        migrateLegacyPref();
        initSwitch(document);
        initConfigPanel();
        initCardInteractions();
        applyGlobalMode(getPref());

        $(document).on("init.dt", function (e, settings) {
            attachFromSettings(settings);
        });

        $(document).on("draw.dt", function (e, settings) {
            const tableId = settings.nTable.id;
            if (!tableId?.startsWith("grd_")) return;
            renderCards(deriveGridKey(tableId));
        });

        $(window).on("resize", function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (getPref() === "auto") {
                    applyGlobalMode("auto");
                    programarAjuste();
                }
            }, 120);
        });

        $(document).on("rpGridViewChanged", function () {
            Object.keys(grids).forEach(renderCards);
        });
    });
})(window, window.jQuery);
