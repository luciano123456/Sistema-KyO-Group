
/* =====================================
   GS-UI - Render Acciones Grid GLOBAL
   ===================================== */

function renderAccionesGrid(id, acciones, modulo = null) {
    const btnEditar = acciones?.editar
        ? `<button type="button" class="btn btn-sm rp-act rp-act-edit" title="Editar" onclick="${acciones.editar}(${id})"><i class="fa fa-pencil-square-o"></i></button>`
        : "";

    const btnDuplicar = acciones?.duplicar
        ? `<button type="button" class="btn btn-sm rp-act rp-act-view" title="Duplicar" onclick="${acciones.duplicar}(${id})"><i class="fa fa-clone"></i></button>`
        : "";

    const btnHistorial = acciones?.historial
        ? `<button type="button" class="btn btn-sm rp-act rp-act-view" title="Historial" onclick="${acciones.historial}(${id})"><i class="fa fa-history"></i></button>`
        : "";

    const btnEliminar = acciones?.eliminar
        ? `<button type="button" class="btn btn-sm rp-act rp-act-del" title="Eliminar" onclick="${acciones.eliminar}(${id})"><i class="fa fa-trash-o"></i></button>`
        : "";

    const btnVer = acciones?.ver
        ? `<button type="button" class="btn btn-sm rp-act rp-act-view" title="Ver" onclick="${acciones.ver}(${id})"><i class="fa fa-file-text-o"></i></button>`
        : "";

    return `<div class="rp-row-actions" data-id="${id}">${btnVer}${btnEditar}${btnDuplicar}${btnHistorial}${btnEliminar}</div>`;
}

function columnDefsGridLista() {
    return [
        { targets: 0, className: "rp-col-acciones", width: "148px", orderable: false },
        { targets: 1, className: "rp-col-id", width: "92px" }
    ];
}

function columnaGridAcciones(acciones, modulo, renderCustom) {
    return {
        data: "Id",
        name: "grid_acciones",
        title: "",
        width: "148px",
        className: "text-center rp-col-acciones",
        orderable: false,
        searchable: false,
        render: function (data, type, row) {
            if (type === "sort" || type === "filter" || type === "type") return "";
            if (type === "export" || type === "print") return "";
            const id = row?.Id ?? row?.id ?? data;
            if (typeof renderCustom === "function") return renderCustom(id, type, row);
            if (acciones) return renderAccionesGrid(id, acciones, modulo);
            return "";
        }
    };
}

function columnaGridId() {
    return {
        data: "Id",
        title: "Id",
        width: "92px",
        className: "rp-col-id text-center",
        render: function (data, type) {
            if (data === null || data === undefined || data === "") return "";
            if (type === "sort" || type === "filter" || type === "type") return data;
            return `<span class="rp-grid-id" title="ID ${data}"><span class="rp-grid-id-hash">#</span>${data}</span>`;
        }
    };
}

function mostrarErrorDuplicado(mensaje, idReferencia, urlAbrir) {
    const msg = mensaje || "Ya existe un registro con esos datos.";
    if (idReferencia && urlAbrir) {
        KyoToast.show('error', msg, {
            duration: 7000,
            actionHtml: `<a href="${String(urlAbrir).replace(/"/g, '&quot;')}" class="kyo-toast__btn kyo-toast__btn--primary">Ver registro #${Number(idReferencia) || idReferencia}</a>`
        });
    } else {
        errorModal(msg);
    }
}

function interpretarRespuestaApi(data) {
    const valor = data?.valor ?? data?.Valor ?? data?.ok ?? data?.Ok;
    const tipo = data?.tipo ?? data?.Tipo ?? "";
    const mensaje = data?.mensaje ?? data?.Mensaje ?? "";
    const idReferencia = data?.idReferencia ?? data?.IdReferencia ?? null;
    return { valor, tipo, mensaje, idReferencia };
}

/* =====================================
   Configuración de columnas (global)
   ===================================== */

const RP_COLUMN_LABELS = {
    Codigo: "Código",
    Descripcion: "Descripción",
    PorcDesc: "% Descuento",
    CostoUnitario: "Costo unitario",
    FechaActualizacion: "Fecha actualización",
    FechaEmision: "Fecha emisión",
    FechaEntrega: "Fecha entrega",
    NotaInterna: "Nota interna",
    UnidadNegocio: "Unidad de negocio",
    IdUnidadNegocio: "Unidad de negocio",
    Direccion: "Dirección",
    Telefono: "Teléfono",
    Correo: "Correo",
    Apodo: "Apodo",
    Ubicacion: "Ubicación",
    Cuit: "CUIT",
    Cbu: "CBU",
    Cantidad: "Cantidad",
    Costo: "Costo",
    Proveedor: "Proveedor",
    Estado: "Estado",
    Local: "Local",
    Rol: "Rol",
    Nombre: "Nombre",
    Apellido: "Apellido",
    DNI: "DNI",
    Usuario: "Usuario",
    Nota: "Nota",
    CostoTotal: "Costo total",
    CantCompras: "Compras",
    TieneComprasAsociadas: "Tiene compras",
};

function humanizeColumnLabel(raw) {
    if (raw == null || raw === "") return "";
    const key = String(raw).trim();
    if (RP_COLUMN_LABELS[key]) return RP_COLUMN_LABELS[key];
    return key
        .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ0-9])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (c) => c.toUpperCase());
}

function initGridColumnConfig(options) {
    const {
        gridSelector,
        menuSelector,
        storageKey,
        skipColumn = null,
        getLabel = null,
        adjustOnChange = true,
    } = options || {};

    if (!gridSelector || !menuSelector || !storageKey) return;
    if (!window.jQuery || !$.fn.DataTable) return;

    const $gridEl = $(gridSelector);
    if (!$gridEl.length || !$.fn.DataTable.isDataTable($gridEl)) return;

    const grid = $gridEl.DataTable();
    const columns = grid.settings().init().columns || [];
    const $menu = $(menuSelector);
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");

    const defaultSkip = (col, index) => {
        if (index === 0 && (col.name === "grid_acciones" || !col.data)) return true;
        if (!col.data || col.data === "Id") return true;
        return false;
    };
    const shouldSkip = typeof skipColumn === "function" ? skipColumn : defaultSkip;

    const entries = [];
    columns.forEach((col, index) => {
        if (shouldSkip(col, index, grid)) return;

        const isChecked = saved[`col_${index}`] !== undefined ? !!saved[`col_${index}`] : true;
        grid.column(index).visible(isChecked);

        let label;
        if (typeof getLabel === "function") {
            label = getLabel(col, index, grid);
        } else {
            label = col.title || humanizeColumnLabel(col.data) || `Columna ${index}`;
        }

        entries.push({ index, label: label || `Columna ${index}`, isChecked });
    });

    $menu.empty()
        .addClass("rp-col-config-menu dropdown-menu-end")
        .attr("data-rp-col-menu", storageKey);

    $menu.html(`
        <div class="rp-col-config-head">
            <div class="rp-col-config-head-icon"><i class="fa fa-columns"></i></div>
            <div>
                <div class="rp-col-config-title">Columnas visibles</div>
                <div class="rp-col-config-sub">Elegí qué columnas mostrar en la grilla</div>
            </div>
        </div>
        <div class="rp-col-config-toolbar">
            <div class="rp-col-config-search">
                <i class="fa fa-search"></i>
                <input type="text" class="rp-col-config-search-input" placeholder="Buscar columna…" autocomplete="off" />
            </div>
            <div class="rp-col-config-quick">
                <button type="button" class="rp-col-config-quick-btn" data-action="all">Todas</button>
                <button type="button" class="rp-col-config-quick-btn" data-action="none">Ninguna</button>
            </div>
        </div>
        <div class="rp-col-config-list"></div>
        <div class="rp-col-config-foot">
            <i class="fa fa-info-circle"></i> Preferencia guardada en este navegador
        </div>
    `);

    const $list = $menu.find(".rp-col-config-list");
    if (!entries.length) {
        $list.html('<div class="rp-col-config-empty">No hay columnas configurables.</div>');
        return;
    }

    entries.forEach(({ index, label, isChecked }) => {
        $list.append(`
            <label class="rp-col-config-item" data-label="${String(label).toLowerCase()}">
                <input type="checkbox" class="rp-col-config-check toggle-column" data-column="${index}" ${isChecked ? "checked" : ""} />
                <span class="rp-col-config-box" aria-hidden="true"><i class="fa fa-check"></i></span>
                <span class="rp-col-config-label">${label}</span>
            </label>
        `);
    });

    const persistAndApply = (index, visible) => {
        saved[`col_${index}`] = visible;
        localStorage.setItem(storageKey, JSON.stringify(saved));
        grid.column(index).visible(visible);
        if (adjustOnChange) setTimeout(() => grid.columns.adjust(), 40);
    };

    $menu.off("change.rpColCfg click.rpColCfg input.rpColCfg")
        .on("change.rpColCfg", ".rp-col-config-check", function () {
            persistAndApply(parseInt(this.dataset.column, 10), this.checked);
        })
        .on("click.rpColCfg", ".rp-col-config-quick-btn", function (e) {
            e.preventDefault();
            e.stopPropagation();
            const showAll = this.dataset.action === "all";
            $menu.find(".rp-col-config-check:visible, .rp-col-config-check").each(function () {
                const $item = $(this).closest(".rp-col-config-item");
                if ($item.hasClass("is-hidden")) return;
                const idx = parseInt(this.dataset.column, 10);
                this.checked = showAll;
                persistAndApply(idx, showAll);
            });
        })
        .on("input.rpColCfg", ".rp-col-config-search-input", function () {
            const q = (this.value || "").trim().toLowerCase();
            let visibles = 0;
            $menu.find(".rp-col-config-item").each(function () {
                const match = !q || (this.dataset.label || "").includes(q);
                this.classList.toggle("is-hidden", !match);
                if (match) visibles++;
            });
            $menu.find(".rp-col-config-empty-search").toggle(!visibles && !!q);
        });

    if (!$menu.find(".rp-col-config-empty-search").length) {
        $list.after('<div class="rp-col-config-empty rp-col-config-empty-search d-none">No hay columnas que coincidan.</div>');
    }

    $menu.on("click", (e) => e.stopPropagation());
}

/* =====================================
   Historial — chips de cambios coloreados
   ===================================== */
function kyoEscHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatHistorialDetalleHtml(detalle) {
    if (!detalle) return '';
    const raw = String(detalle).trim();
    if (!raw) return '';

    const hasArrow = /->|→/.test(raw);
    let parts;
    if (raw.includes('|') || hasArrow) {
        parts = raw.split(/\s*\|\s*/).map(p => p.trim()).filter(Boolean);
    } else {
        // Alta: "Insumos: 1. Subrecetas: 0. Costo unitario: 2979.85."
        parts = raw.split(/\.\s+(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/).map(p => p.replace(/\.$/, '').trim()).filter(Boolean);
    }

    const chips = parts.map(part => {
        const m = part.match(/^(.+?):\s*(.*?)\s*(?:→|->)\s*(.*)$/);
        if (m) {
            const label = m[1].trim();
            const oldRaw = m[2].trim();
            const newRaw = m[3].trim();
            // Ocultar falsos cambios numéricos ya guardados (4.00 → 4)
            if (kyoHistNumsEqual(oldRaw, newRaw)) return '';

            return `
            <span class="kyo-hist-chip kyo-hist-chip--diff">
                <span class="kyo-hist-field">${kyoEscHtml(label)}</span>
                <span class="kyo-hist-old" title="Antes">${kyoEscHtml(kyoHistFmtNum(oldRaw))}</span>
                <span class="kyo-hist-arrow" aria-hidden="true">→</span>
                <span class="kyo-hist-new" title="Después">${kyoEscHtml(kyoHistFmtNum(newRaw))}</span>
            </span>`;
        }

        const info = part.match(/^(.+?):\s*(.+)$/);
        if (info) {
            return `
            <span class="kyo-hist-chip kyo-hist-chip--info">
                <span class="kyo-hist-field">${kyoEscHtml(info[1].trim())}</span>
                <span class="kyo-hist-val">${kyoEscHtml(kyoHistFmtNum(info[2].trim()))}</span>
            </span>`;
        }

        const lower = part.toLowerCase();
        let kind = 'info';
        if (lower.includes('agreg') || lower.includes('alta') || lower.includes('cread')) kind = 'add';
        else if (lower.includes('elimin') || lower.includes('quit')) kind = 'del';
        else if (lower.includes('actualiz')) kind = 'upd';

        return `<span class="kyo-hist-chip kyo-hist-chip--${kind}">${kyoEscHtml(part)}</span>`;
    }).filter(Boolean).join('');

    return chips ? `<div class="kyo-hist-chips">${chips}</div>` : '';
}

function kyoHistParseNum(v) {
    if (v == null) return NaN;
    const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
}

function kyoHistNumsEqual(a, b) {
    const na = kyoHistParseNum(a);
    const nb = kyoHistParseNum(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
    return Math.abs(na - nb) < 1e-9;
}

function kyoHistFmtNum(v) {
    const n = kyoHistParseNum(v);
    if (!Number.isFinite(n)) return String(v ?? '');
    // mismo criterio que backend: sin ceros basura
    return String(Number(n.toFixed(8)));
}

function renderHistorialModal(items, titulo) {
    const titleEl = document.getElementById('historialModalTitle');
    const bodyEl = document.getElementById('historialModalBody');
    if (!bodyEl) {
        if (typeof errorModal === 'function') errorModal('No se encontró el modal de historial en la página.');
        return;
    }
    if (titleEl) titleEl.textContent = titulo || 'Historial';

    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
        bodyEl.innerHTML = '<div class="kyo-hist-empty">Todavía no hay movimientos registrados para este ítem.</div>';
    } else {
        bodyEl.innerHTML = `<div class="kyo-hist-list">${list.map(h => {
            const fecha = h.Fecha ? new Date(h.Fecha).toLocaleString('es-AR') : '—';
            const accion = String(h.Accion || '');
            const tone =
                accion === 'Creacion' ? 'create' :
                accion === 'Eliminacion' ? 'delete' : 'update';
            const badgeLabel =
                accion === 'Creacion' ? 'Creación' :
                accion === 'Eliminacion' ? 'Eliminación' :
                accion === 'Modificacion' ? 'Modificación' : (accion || 'Cambio');
            const usuario = h.UsuarioNombre || ('Usuario #' + (h.IdUsuario || ''));

            return `
            <article class="kyo-hist-card kyo-hist-card--${tone}">
                <div class="kyo-hist-card__top">
                    <span class="kyo-hist-badge kyo-hist-badge--${tone}">${kyoEscHtml(badgeLabel)}</span>
                    <time class="kyo-hist-time">${kyoEscHtml(fecha)}</time>
                </div>
                <h6 class="kyo-hist-resumo">${kyoEscHtml(h.Resumen || '')}</h6>
                ${h.Detalle ? formatHistorialDetalleHtml(h.Detalle) : ''}
                <div class="kyo-hist-user"><i class="fa fa-user"></i> ${kyoEscHtml(usuario)}</div>
            </article>`;
        }).join('')}</div>`;
    }

    const modalEl = document.getElementById('historialModal');
    if (modalEl && window.bootstrap?.Modal) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
}

/** Historial genérico por entidad: /Historial/Entidad?tipo=Insumo&id=1 */
async function verHistorialEntidad(tipo, id, titulo) {
    try {
        const t = (typeof token !== 'undefined' && token) ? token : localStorage.getItem('JwtToken');
        const r = await fetch(`/Historial/Entidad?tipo=${encodeURIComponent(tipo)}&id=${encodeURIComponent(id)}`, {
            headers: t ? { 'Authorization': 'Bearer ' + t } : {}
        });
        if (!r.ok) throw new Error('No se pudo cargar el historial.');
        const data = await r.json();
        renderHistorialModal(data || [], titulo || `Historial ${tipo} #${id}`);
    } catch (e) {
        console.error(e);
        if (typeof errorModal === 'function') errorModal(e.message || 'No se pudo cargar el historial.');
    }
}

window.verHistorialEntidad = verHistorialEntidad;
window.verHistorialInsumo = (id) => verHistorialEntidad('Insumo', id, `Historial Insumo #${id}`);
window.verHistorialProveedor = (id) => verHistorialEntidad('Proveedor', id, `Historial Proveedor #${id}`);
window.verHistorialUsuario = (id) => verHistorialEntidad('Usuario', id, `Historial Usuario #${id}`);
window.verHistorialCompra = (id) => verHistorialEntidad('Compra', id, `Historial Compra #${id}`);
window.verHistorialOrdenCompra = (id) => verHistorialEntidad('OrdenCompra', id, `Historial OC #${id}`);


/* Historial de precios (Proveedores-Insumos): variación % ↑rojo / ↓verde */
function kyoHistMoney(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function kyoHistVarBadge(pct) {
    if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) return '';
    const n = Number(pct);
    if (Math.abs(n) < 0.005) {
        return `<span class="kyo-hist-var kyo-hist-var--flat">= 0%</span>`;
    }
    const up = n > 0;
    const cls = up ? 'kyo-hist-var--up' : 'kyo-hist-var--down';
    const arrow = up ? '↑' : '↓';
    const sign = up ? '+' : '';
    return `<span class="kyo-hist-var ${cls}">${arrow} ${sign}${n.toFixed(2)}%</span>`;
}

function kyoHistPriceRow(label, ant, neu, pct) {
    const a = ant == null ? null : Number(ant);
    const b = neu == null ? null : Number(neu);
    const same = a != null && b != null && Math.abs(a - b) < 1e-9;
    if (ant == null && neu == null) return '';
    if (same && ant != null) {
        return `
        <div class="kyo-hist-price-row kyo-hist-price-row--same">
            <span class="kyo-hist-price-label">${kyoEscHtml(label)}</span>
            <span class="kyo-hist-price-val">${kyoEscHtml(kyoHistMoney(neu))}</span>
        </div>`;
    }
    return `
    <div class="kyo-hist-price-row">
        <span class="kyo-hist-price-label">${kyoEscHtml(label)}</span>
        <span class="kyo-hist-old">${kyoEscHtml(kyoHistMoney(ant))}</span>
        <span class="kyo-hist-arrow">→</span>
        <span class="kyo-hist-new">${kyoEscHtml(kyoHistMoney(neu))}</span>
        ${kyoHistVarBadge(pct)}
    </div>`;
}

function renderHistorialPreciosModal(items, titulo) {
    const titleEl = document.getElementById('historialModalTitle');
    const bodyEl = document.getElementById('historialModalBody');
    if (!bodyEl) {
        if (typeof errorModal === 'function') errorModal('No se encontró el modal de historial en la página.');
        return;
    }
    if (titleEl) titleEl.textContent = titulo || 'Historial de precios';

    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
        bodyEl.innerHTML = '<div class="kyo-hist-empty">Todavía no hay cambios de precio registrados.</div>';
    } else {
        bodyEl.innerHTML = `<div class="kyo-hist-list kyo-hist-list--precios">${list.map(h => {
            const fecha = h.Fecha ? new Date(h.Fecha).toLocaleString('es-AR') : '—';
            const accion = String(h.Accion || '');
            const tone =
                accion === 'Creacion' ? 'create' :
                accion === 'Eliminacion' ? 'delete' : 'update';
            const badgeLabel =
                accion === 'Creacion' ? 'Alta' :
                accion === 'Eliminacion' ? 'Eliminación' : 'Cambio de precio';
            const origen = String(h.Origen || '');
            const origenBadge = origen === 'Importacion'
                ? '<span class="kyo-hist-origen kyo-hist-origen--import">Importación</span>'
                : (origen ? `<span class="kyo-hist-origen">${kyoEscHtml(origen)}</span>` : '');
            const usuario = h.UsuarioNombre || ('Usuario #' + (h.IdUsuario || ''));
            const varUnit = h.VariacionUnitarioPct;
            const trendClass =
                Number(varUnit) > 0.005 ? 'kyo-hist-card--price-up' :
                Number(varUnit) < -0.005 ? 'kyo-hist-card--price-down' : '';

            const prices = [
                kyoHistPriceRow('Costo', h.CostoAnterior, h.CostoNuevo, h.VariacionCostoPct),
                kyoHistPriceRow('Costo unitario', h.CostoUnitarioAnterior, h.CostoUnitarioNuevo, h.VariacionUnitarioPct),
                kyoHistPriceRow('Cantidad', h.CantidadAnterior, h.CantidadNueva, null),
                kyoHistPriceRow('Desc. %', h.PorcDescAnterior, h.PorcDescNuevo, null)
            ].filter(Boolean).join('');

            return `
            <article class="kyo-hist-card kyo-hist-card--${tone} ${trendClass}">
                <div class="kyo-hist-card__top">
                    <span class="kyo-hist-badge kyo-hist-badge--${tone}">${kyoEscHtml(badgeLabel)}</span>
                    ${origenBadge}
                    <time class="kyo-hist-time">${kyoEscHtml(fecha)}</time>
                </div>
                <h6 class="kyo-hist-resumo">${kyoEscHtml(h.Resumen || '')}</h6>
                ${prices ? `<div class="kyo-hist-prices">${prices}</div>` : (h.Detalle ? formatHistorialDetalleHtml(h.Detalle) : '')}
                <div class="kyo-hist-user"><i class="fa fa-user"></i> ${kyoEscHtml(usuario)}</div>
            </article>`;
        }).join('')}</div>`;
    }

    const modalEl = document.getElementById('historialModal');
    if (modalEl && window.bootstrap?.Modal) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
}

