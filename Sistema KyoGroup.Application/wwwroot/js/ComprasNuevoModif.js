/********************  ComprasNuevoModif.js — FULL + COMPARATIVOS  ********************/
let detallesCompra = [];
let compraIdInicial = 0;

/* ===========================================================
   ID inicial de compra (traído por Razor)
   =========================================================== */
try {
    if (typeof CompraData === "number" || typeof CompraData === "string") {
        compraIdInicial = Number(CompraData) || 0;
    } else if (CompraData && typeof CompraData === "object") {
        compraIdInicial = Number(CompraData.Id ?? CompraData.id ?? 0) || 0;
    }
} catch {
    compraIdInicial = 0;
}

/* ===========================================================
   HELPERS FETCH + FORMATOS
   =========================================================== */
function authHeaders(extra = {}) {
    const t = (typeof token !== "undefined" && token) ? token : "";
    return t ? { "Authorization": "Bearer " + t, ...extra } : { ...extra };
}

async function fetchJson(url, options = {}) {
    const opts = { ...options, headers: authHeaders(options.headers || {}) };
    const r = await fetch(url, opts);

    if ((r.status === 401 || r.status === 403) && typeof advertenciaModal === "function") {
        advertenciaModal("Sesión expirada o sin permisos.");
    }

    if (!r.ok) throw new Error(await r.text().catch(() => "Error HTTP"));
    return await r.json();
}

const _num = v => Number(v ?? 0);

const fmtDec = v =>
    new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
        .format(_num(v));

const fmtMoney = v =>
    "$" + new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(_num(v));

function formatDateShort(value) {
    if (!value) return "";
    try {
        const d = new Date(value);
        return d.toLocaleDateString("es-AR");
    } catch {
        return String(value);
    }
}

function formatearMiles(v) {
    let num = String(v).replace(/\D/g, '');
    if (!num) return "0";
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// formatearSinMiles → site.js (parseNumeroLoose)

// para evitar falsos positivos por decimales ($0,001)
function esCasiCero(n) {
    return Math.abs(_num(n)) < 0.005;
}

/* ===========================================================
   HELPER: seleccionar combos por ID (por si usás selects)
   =========================================================== */
function seleccionarCombo(selector, value) {
    const $sel = $(selector);
    if (!$sel.length || value == null) return;

    const valStr = String(value);

    if ($sel.data("select2")) {
        if ($sel.find(`option[value='${valStr}']`).length === 0) {
            const opt = new Option("", valStr, false, false);
            $sel.append(opt);
        }
        $sel.val(valStr).trigger("change");
    } else {
        $sel.val(valStr);
    }
}

/* ===========================================================
   DOCUMENT READY
   =========================================================== */
$(document).ready(async () => {
    try {
        initFechaCompra();
        initSelect2OC();
        hookDescuentosBlur();

        const duplicarId = typeof kyoQueryInt === 'function' ? kyoQueryInt('duplicar') : 0;

        // Si viene OC inicial (solo en NUEVA compra basada en OC)
        if (!duplicarId && typeof IdOrdenCompraInicial === "number" && IdOrdenCompraInicial > 0 && compraIdInicial === 0) {
            await seleccionarOCInicial(IdOrdenCompraInicial);
        }

        // Duplicar compra existente
        if (duplicarId > 0) {
            await cargarCompraExistente(duplicarId);
            aplicarModoDuplicarCompra();
        } else if (compraIdInicial > 0) {
            // Si vengo a EDITAR una compra
            await cargarCompraExistente(compraIdInicial);
        }

        wireDetalleEvents();
    } catch (e) {
        console.error(e);
    }
});

/* ===========================================================
   FECHA COMPRA
   =========================================================== */
function initFechaCompra() {
    const fc = document.getElementById("FechaCompra");
    if (!fc) return;

    if (!fc.value) {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        fc.value = `${yyyy}-${mm}-${dd}`;
    }
}

/* ===========================================================
   CABECERA DESDE OC (para NUEVA compra)
   =========================================================== */
function setCabeceraDesdeOC(oc) {
    // IDs
    $("#IdUnidadNegocio").val(oc.IdUnidadNegocio);
    $("#IdLocal").val(oc.IdLocal);
    $("#IdProveedor").val(oc.IdProveedor);

    // Nombres visibles
    $("#UnidadNegocioNombre").val(oc.UnidadNegocio ?? "");
    $("#LocalNombre").val(oc.Local ?? "");
    $("#ProveedorNombre").val(oc.Proveedor ?? "");

    if (oc.NotaInterna && !$("#NotaInterna").val()) $("#NotaInterna").val(oc.NotaInterna);

    if (oc.FechaEmision) $("#FechaCompra").val(String(oc.FechaEmision).substring(0, 10));

    $("#tituloCompra").text(`Nueva Compra basada en OC #${oc.Id}`);
}

/* ===========================================================
   CABECERA DESDE OC (para EDITAR compra, NO tocar detalle)
   =========================================================== */
function setCabeceraDesdeOCEnEdicion(oc, compra) {
    if (!oc) return;

    // IDs (deben coincidir con la compra, pero garantizamos)
    $("#IdUnidadNegocio").val(oc.IdUnidadNegocio);
    $("#IdLocal").val(oc.IdLocal);
    $("#IdProveedor").val(oc.IdProveedor);

    // Nombres visibles
    $("#UnidadNegocioNombre").val(oc.UnidadNegocio ?? "");
    $("#LocalNombre").val(oc.Local ?? "");
    $("#ProveedorNombre").val(oc.Proveedor ?? "");

    // Nota: si la compra ya tiene nota, la respetamos.
    const notaCtrl = $("#NotaInterna");
    if (!notaCtrl.val() && oc.NotaInterna) {
        notaCtrl.val(oc.NotaInterna);
    }

    // NO tocamos FechaCompra ni título acá, esos vienen de la compra
}

/* ===========================================================
   SELECT2 ORDEN COMPRA
   =========================================================== */
function initSelect2OC() {
    const sel = $("#OrdenCompraSelect");

    sel.select2({
        width: "100%",
        placeholder: "Seleccionar una Orden Pendiente...",
        allowClear: true,
        ajax: {
            url: "/OrdenesCompras/ListaPendientes",
            dataType: "json",
            delay: 250,
            headers: authHeaders(),
            data: params => ({ term: params.term || "" }),
            processResults: data => ({
                results: (data || []).map(o => ({
                    id: o.Id,
                    text: `OC #${o.Id} - ${o.Proveedor || ""} - ${formatDateShort(o.FechaEmision)}`
                }))
            })
        }
    });

    sel.on("select2:select", async function (e) {
        const idOC = Number(e.params.data.id || 0);
        if (idOC > 0) await cargarDesdeOrdenCompra(idOC);
    });

    sel.on("select2:clear", function () {
        detallesCompra = [];
        actualizarEtiquetaOC(null);
        renderDetalleCompra();
        recalcularTotales();
        actualizarAcordeonComparativo();
    });
}

/* ===========================================================
   SELECCIONAR OC INICIAL (solo NUEVA compra)
   =========================================================== */
async function seleccionarOCInicial(idOC) {
    const sel = $("#OrdenCompraSelect");
    const resp = await fetchJson(`/OrdenesCompras/EditarInfo?id=${idOC}`, { headers: authHeaders() });

    const oc = resp.OrdenCompra;
    const text = `OC #${oc.Id} - ${oc.Proveedor} - ${formatDateShort(oc.FechaEmision)}`;

    const opt = new Option(text, oc.Id, true, true);
    sel.append(opt).trigger("change");

    await cargarDesdeOCCompleta(oc, resp.OrdenesComprasInsumos);
}

/* ===========================================================
   SOLO PARA EDICIÓN: setear OC + cabecera sin tocar detalle
   =========================================================== */
async function seleccionarOCEnEdicion(idOC, compra) {
    const sel = $("#OrdenCompraSelect");
    const valStr = String(idOC);

    try {
        const resp = await fetchJson(`/OrdenesCompras/EditarInfo?id=${idOC}`, {
            headers: authHeaders()
        });

        const oc = resp.OrdenCompra || {};
        const text = `OC #${oc.Id} - ${oc.Proveedor || ""} - ${formatDateShort(oc.FechaEmision)}`;

        // Agrego opción si no existe
        if (sel.find(`option[value='${valStr}']`).length === 0) {
            const opt = new Option(text, oc.Id, false, false);
            sel.append(opt);
        }

        // Seteo valor en select2 SIN disparar nuestra lógica de "select2:select"
        sel.val(valStr).trigger("change");

        actualizarEtiquetaOC(idOC);
        setCabeceraDesdeOCEnEdicion(oc, compra);
    } catch (e) {
        console.error(e);
        actualizarEtiquetaOC(idOC);
        // Fallback muy simple
        if (sel.find(`option[value='${valStr}']`).length === 0) {
            const opt = new Option(`OC #${idOC}`, idOC, false, false);
            sel.append(opt);
        }
        sel.val(valStr).trigger("change");
    }
}

/* ===========================================================
   CARGAR ORDEN COMPRA COMPLETA (NUEVA)
   =========================================================== */
async function cargarDesdeOrdenCompra(idOC) {
    try {
        const resp = await fetchJson(`/OrdenesCompras/EditarInfo?id=${idOC}`, {
            headers: authHeaders()
        });

        const oc = resp.OrdenCompra || {};
        const detArray = resp.OrdenesComprasInsumos || [];

        await cargarDesdeOCCompleta(oc, detArray);
    } catch (e) {
        console.error(e);
        advertenciaModal?.("Error cargando la Orden de Compra.");
    }
}

/* ===========================================================
   ARMAR DETALLE DESDE OC (para NUEVA compra)
   =========================================================== */
async function cargarDesdeOCCompleta(oc, detArray = []) {
    if (!oc) return;

    setCabeceraDesdeOC(oc);
    actualizarEtiquetaOC(oc.Id);

    const origen = Array.isArray(detArray) ? detArray : [];

    detallesCompra = origen.map(d => {
        const pedida = _num(d.CantidadPedida ?? d.Cantidad ?? 0);
        const entregada = _num(d.CantidadEntregada ?? 0);
        const pendiente = pedida - entregada;

        const linea = {
            IdOrdenCompraInsumo: d.Id ?? 0,
            IdInsumo: d.IdInsumo,
            NombreInsumo: d.Nombre ?? d.Descripcion ?? ("#" + d.IdInsumo),
            Sku: d.Sku ?? null,

            CantPedida: pedida,
            CantPendienteOC: pendiente,
            CantRecibida: 0,

            PrecioListaOC: _num(d.PrecioLista),
            PrecioFactura: _num(d.PrecioLista),

            DifCant: 0,
            DifPrecio: 0,
            DifSubtotal: 0,

            Subtotal: 0,

            EstadoId: 1,
            EstadoNombre: "Pendiente",
            EstadoManual: false,

            IdProveedorLista: _num(d.IdProveedorLista ?? 0)
        };

        recalcularLinea(linea);
        autoEstado(linea);

        return linea;
    });

    renderDetalleCompra();
    recalcularTotales();
    actualizarAcordeonComparativo();

    const btn = document.getElementById("btnNuevoModificarCompra");
    const titulo = document.getElementById("tituloCompra");

    const hiddenIdEl = document.getElementById("IdCompra");
    const idHidden = hiddenIdEl ? _num(hiddenIdEl.value) : 0;
    const idCompra = compraIdInicial > 0 ? compraIdInicial : idHidden;

    if (idCompra > 0) {
        if (titulo) titulo.textContent = `Editar Compra #${idCompra}`;
        if (btn) btn.innerHTML = `<i class="fa fa-save"></i> Guardar`;
    } else {
        if (titulo) titulo.textContent = `Nueva Compra basada en OC #${oc.Id}`;
        if (btn) btn.innerHTML = `<i class="fa fa-save"></i> Registrar`;
    }
}

/* ===========================================================
   BADGE ORIGEN OC
   =========================================================== */
function actualizarEtiquetaOC(idOC) {
    const badge = document.getElementById("lblOrigenOC");
    const nro = document.getElementById("lblNroOC");
    if (!badge || !nro) return;

    if (idOC) {
        badge.classList.remove("d-none");
        nro.textContent = `#${idOC}`;
    } else {
        badge.classList.add("d-none");
        nro.textContent = "";
    }
}

/* ===========================================================
   AUTO ESTADO (Pendiente / Entregado / Incompleto)
   =========================================================== */
function autoEstado(linea) {
    if (linea.EstadoManual) return;

    const ped = _num(linea.CantPedida);
    const rec = _num(linea.CantRecibida);

    let id = 1, nombre = "Pendiente";

    if (rec >= ped && ped > 0) { id = 2; nombre = "Entregado"; }
    else if (rec > 0 && rec < ped) { id = 3; nombre = "Incompleto"; }

    linea.EstadoId = id;
    linea.EstadoNombre = nombre;
}

/* ===========================================================
   CARGAR COMPRA EXISTENTE (EDICIÓN)
   =========================================================== */
async function cargarCompraExistente(id) {
    try {
        const compra = await fetchJson(`/Compras/EditarInfo?id=${id}`, { headers: authHeaders() });
        if (!compra) return;

        $("#IdCompra").val(compra.Id);
        $("#tituloCompra").text(`Editar Compra #${compra.Id}`);

        // IDs (por si tenés selects normales en alguna variante)
        seleccionarCombo("#IdUnidadNegocio", compra.IdUnidadNegocio);
        seleccionarCombo("#IdLocal", compra.IdLocal);
        seleccionarCombo("#IdProveedor", compra.IdProveedor);

        // Fecha y montos
        if (compra.Fecha) $("#FechaCompra").val(String(compra.Fecha).substring(0, 10));

        $("#NotaInterna").val(compra.NotaInterna ?? "");
        $("#Subtotal").val(fmtMoney(compra.Subtotal));
        $("#Descuentos").val("$" + formatearMiles(Math.round(compra.Descuentos ?? 0)));
        $("#SubtotalFinal").val(fmtMoney(compra.SubtotalFinal));

        // ==== OC asociada: texto + cabecera (como si la hubieras elegido nueva) ====
        if (compra.IdOrdenCompra && compra.IdOrdenCompra > 0) {
            await seleccionarOCEnEdicion(compra.IdOrdenCompra, compra);
        } else {
            actualizarEtiquetaOC(null);
        }

        // ==== Detalle de compra (NO se recalcula desde OC) ====
        const detRaw = compra.ComprasInsumos || [];

        detallesCompra = detRaw.map(ci => {
            const pedida = _num(ci.CantidadPedidaOc ?? ci.CantPedidaOc ?? ci.Cantidad ?? 0);
            const pendiente = _num(ci.CantidadPendienteOc ?? pedida);
            const rec = _num(ci.Cantidad ?? 0);

            const pLista = _num(ci.PrecioLista ?? 0);
            const pFact = _num(ci.PrecioFactura ?? 0);

            const linea = {
                IdCompraInsumo: ci.Id ?? 0,
                IdOrdenCompraInsumo: ci.IdOrdenCompraInsumo ?? null,
                IdInsumo: ci.IdInsumo,
                NombreInsumo: ci.NombreInsumo ?? ci.Nombre ?? ("#" + ci.IdInsumo),
                Sku: ci.Sku ?? null,

                CantPedida: pedida,
                CantPendienteOC: pendiente,
                CantRecibida: rec,

                PrecioListaOC: pLista,
                PrecioFactura: pFact,

                DifCant: 0,
                DifPrecio: ci.Diferencia ?? 0,
                DifSubtotal: 0,

                Subtotal: ci.SubtotalFinal ?? ci.SubtotalConDescuento ?? (rec * pFact),

                EstadoId: ci.IdEstadoOcInsumo ?? 1,
                EstadoNombre: ci.EstadoOcNombre ?? "Pendiente",
                EstadoManual: !!ci.EstadoManualOC,

                IdProveedorLista: _num(ci.IdProveedorLista ?? 0)
            };

            recalcularLinea(linea);
            return linea;
        });

        renderDetalleCompra();
        recalcularTotales();

        const btn = document.getElementById("btnNuevoModificarCompra");
        if (btn) btn.innerHTML = `<i class="fa fa-save"></i> Guardar`;

    } catch (e) {
        console.error(e);
    }
}

function aplicarModoDuplicarCompra() {
    compraIdInicial = 0;
    $("#IdCompra").val("");
    $("#tituloCompra").text("Duplicar Compra");
    const btn = document.getElementById("btnNuevoModificarCompra");
    if (btn) btn.innerHTML = `<i class="fa fa-save"></i> Registrar`;

    detallesCompra = detallesCompra.map(d => ({
        ...d,
        IdCompraInsumo: 0
    }));
    renderDetalleCompra();
    recalcularTotales();
}

/********************  BLOQUE 2 — DETALLE Y EDICIÓN INLINE  ********************/

/* ===========================================================
   RENDER DETALLE TABLA
   =========================================================== */
function renderDetalleCompra() {
    const tbody = document.querySelector("#grd_DetalleCompra tbody");
    if (!tbody) return;

    if (!detallesCompra.length) {
        tbody.innerHTML = "";
        actualizarAcordeonComparativo();
        return;
    }

    let html = "";

    detallesCompra.forEach((d, idx) => {

        const claseDifCant = d.DifCant === 0 ? "" : (d.DifCant > 0 ? "badge-dif-pos" : "badge-dif-neg");
        const claseDifPrecio = d.DifPrecio === 0 ? "" : (d.DifPrecio > 0 ? "badge-dif-pos" : "badge-dif-neg");
        const claseDifSubtotal = d.DifSubtotal === 0 ? "" : (d.DifSubtotal > 0 ? "badge-dif-pos" : "badge-dif-neg");

        let estadoClase = "estado-pendiente";
        if (d.EstadoId === 2) estadoClase = "estado-entregado";
        else if (d.EstadoId === 3) estadoClase = "estado-incompleto";

        html += `
<tr data-index="${idx}">
    <td class="col-insumo">
        <div class="compras-insumo-nombre">${d.NombreInsumo}</div>
        <div class="compras-insumo-extra">SKU: ${d.Sku ?? "-"}</div>
    </td>

    <td class="text-center">${fmtDec(d.CantPedida)}</td>
    <td class="text-center">${fmtDec(d.CantPendienteOC)}</td>

    <!-- Cant. Recibida -->
    <td class="text-center">
        <div class="compras-cell-editable">
            <span class="compras-cell-text" data-field="cantidad">${fmtDec(d.CantRecibida)}</span>
            <button type="button" class="compras-edit-btn" data-edit="cantidad">
                <i class="fa fa-pencil"></i>
            </button>
        </div>
    </td>

    <td class="text-center ${claseDifCant}">${fmtDec(d.DifCant)}</td>

    <td class="text-center">${fmtMoney(d.PrecioListaOC)}</td>

    <!-- Precio factura -->
    <td class="text-center">
        <div class="compras-cell-editable">
            <span class="compras-cell-text compras-cell-text-right" data-field="precio">
                ${fmtMoney(d.PrecioFactura)}
            </span>
            <button type="button" class="compras-edit-btn" data-edit="precio">
                <i class="fa fa-pencil"></i>
            </button>
        </div>
    </td>

    <td class="text-center ${claseDifPrecio}">${fmtMoney(d.DifPrecio)}</td>

    <!-- DIFERENCIA SUBTOTAL -->
    <td class="text-center ${claseDifSubtotal}">${fmtMoney(d.DifSubtotal)}</td>

    <!-- Estado -->
    <td class="text-center">
        <div class="compras-cell-editable">
            <span class="badge-estado ${estadoClase}" data-field="estado">
                ${d.EstadoNombre}
            </span>
            <button type="button" class="compras-edit-btn" data-edit="estado">
                <i class="fa fa-pencil"></i>
            </button>
        </div>
    </td>

    <td class="text-center">${fmtMoney(d.Subtotal)}</td>
</tr>`;
    });

    tbody.innerHTML = html;
    actualizarAcordeonComparativo();
}

/* ===========================================================
   EVENTOS INLINE EDIT
   =========================================================== */
function wireDetalleEvents() {
    const tbody = document.querySelector("#grd_DetalleCompra tbody");
    if (!tbody) return;

    tbody.addEventListener("click", function (e) {
        const btn = e.target.closest(".compras-edit-btn");
        if (!btn) return;

        const tr = e.target.closest("tr");
        const idx = Number(tr.dataset.index);
        const field = btn.getAttribute("data-edit");

        switch (field) {
            case "cantidad": startInlineEditCantidad(tr, idx); break;
            case "precio": startInlineEditPrecio(tr, idx); break;
            case "estado": startInlineEditEstado(tr, idx); break;
        }
    });
}

/* ===========================================================
   INLINE EDIT CANTIDAD
   =========================================================== */
function startInlineEditCantidad(tr, idx) {
    const linea = detallesCompra[idx];
    const span = tr.querySelector('span[data-field="cantidad"]');
    const cont = span.parentElement;

    cont.innerHTML = `
        <input type="text" class="compras-edit-input" value="${formatearMiles(linea.CantRecibida)}" />
        <button class="compras-edit-accept"><i class="fa fa-check"></i></button>
        <button class="compras-edit-cancel"><i class="fa fa-times"></i></button>`;

    const input = cont.querySelector("input");
    input.focus(); input.select();

    const finish = apply => {
        if (apply) {
            linea.CantRecibida = formatearSinMiles(input.value);
            recalcularLinea(linea);
            autoEstado(linea);
        }
        renderDetalleCompra();
        recalcularTotales();
    };

    cont.querySelector(".compras-edit-accept").onclick = () => finish(true);
    cont.querySelector(".compras-edit-cancel").onclick = () => finish(false);
}

/* ===========================================================
   INLINE EDIT PRECIO
   =========================================================== */
function startInlineEditPrecio(tr, idx) {
    const linea = detallesCompra[idx];
    const span = tr.querySelector('span[data-field="precio"]');
    const cont = span.parentElement;

    cont.innerHTML = `
        <input type="text" class="compras-edit-input" value="${fmtMoney(linea.PrecioFactura)}" />
        <button class="compras-edit-accept"><i class="fa fa-check"></i></button>
        <button class="compras-edit-cancel"><i class="fa fa-times"></i></button>`;

    const input = cont.querySelector("input");
    input.focus(); input.select();

    const finish = apply => {
        if (apply) {
            linea.PrecioFactura = formatearSinMiles(input.value);
            recalcularLinea(linea);
        }
        renderDetalleCompra();
        recalcularTotales();
    };

    cont.querySelector(".compras-edit-accept").onclick = () => finish(true);
    cont.querySelector(".compras-edit-cancel").onclick = () => finish(false);
}

/* ===========================================================
   INLINE EDIT ESTADO (select)
   =========================================================== */
function startInlineEditEstado(tr, idx) {
    const linea = detallesCompra[idx];
    const cont = tr.querySelector('span[data-field="estado"]').parentElement;

    cont.innerHTML = `
<select class="compras-edit-input">
    <option value="1">Pendiente</option>
    <option value="2">Entregado</option>
    <option value="3">Incompleto</option>
</select>
<button class="compras-edit-accept"><i class="fa fa-check"></i></button>
<button class="compras-edit-cancel"><i class="fa fa-times"></i></button>`;

    const sel = cont.querySelector("select");
    sel.value = String(linea.EstadoId);

    cont.querySelector(".compras-edit-accept").onclick = () => {
        linea.EstadoId = Number(sel.value);
        linea.EstadoNombre = sel.options[sel.selectedIndex].text;
        linea.EstadoManual = true;
        renderDetalleCompra();
    };

    cont.querySelector(".compras-edit-cancel").onclick = () => renderDetalleCompra();
}

/* ===========================================================
   RECALCULO FINANCIERO
   =========================================================== */
function recalcularLinea(linea) {

    const cant = _num(linea.CantRecibida);
    const ped = _num(linea.CantPedida);
    const pLista = _num(linea.PrecioListaOC);
    const pFact = _num(linea.PrecioFactura);

    linea.DifCant = cant - ped;

    // DifPrecio: positivo si factura > lista (pagás más)
    linea.DifPrecio = pFact - pLista;

    const subtotalOC = ped * pLista;
    const subtotalFact = cant * pFact;

    linea.Subtotal = subtotalFact;
    linea.DifSubtotal = subtotalFact - subtotalOC;

    if (esCasiCero(linea.DifPrecio)) linea.DifPrecio = 0;
    if (esCasiCero(linea.DifSubtotal)) linea.DifSubtotal = 0;
}

/* ===========================================================
   RECALCULAR TOTALES CABECERA
   =========================================================== */
function recalcularTotales() {
    let subtotal = 0;
    detallesCompra.forEach(d => subtotal += d.Subtotal);

    $("#Subtotal").val(fmtMoney(subtotal));

    const desc = formatearSinMiles($("#Descuentos").val());
    $("#SubtotalFinal").val(fmtMoney(subtotal - desc));

    actualizarAcordeonComparativo();
}

/* ===========================================================
   DESCUENTOS
   =========================================================== */
function hookDescuentosBlur() {
    const d = document.getElementById("Descuentos");
    if (!d) return;

    d.addEventListener("blur", () => {
        const num = formatearSinMiles(d.value);
        d.value = "$" + formatearMiles(Math.round(num));
        recalcularTotales();
    });
}

/* ===========================================================
   ACORDEÓN COMPARATIVO
   =========================================================== */
function actualizarAcordeonComparativo() {
    const panel = document.getElementById("panelAcordeonComparativo");
    if (!panel) return;

    if (!detallesCompra.length) {
        panel.classList.add("d-none");
        return;
    }

    let diferencias = [];

    for (let d of detallesCompra) {

        if (d.DifCant !== 0) {
            const msg = d.DifCant > 0
                ? `Se recibieron ${fmtDec(d.CantRecibida)} unidades de ${d.NombreInsumo}, ${fmtDec(d.DifCant)} más de lo pedido.`
                : `Faltan ${fmtDec(Math.abs(d.DifCant))} unidades de ${d.NombreInsumo}.`;
            diferencias.push(msg);
        }

        if (!esCasiCero(d.DifPrecio)) {
            const msg = d.DifPrecio < 0
                ? `El precio factura de ${d.NombreInsumo} es menor al de la OC (${fmtMoney(d.PrecioFactura)} vs ${fmtMoney(d.PrecioListaOC)}).`
                : `El precio factura de ${d.NombreInsumo} es mayor al de la OC (${fmtMoney(d.PrecioFactura)} vs ${fmtMoney(d.PrecioListaOC)}).`;
            diferencias.push(msg);
        }

        if (!esCasiCero(d.DifSubtotal)) {
            const msg = d.DifSubtotal > 0
                ? `El subtotal factura de ${d.NombreInsumo} supera al subtotal OC en ${fmtMoney(d.DifSubtotal)}.`
                : `El subtotal factura de ${d.NombreInsumo} es menor al subtotal OC por ${fmtMoney(Math.abs(d.DifSubtotal))}.`;
            diferencias.push(msg);
        }
    }

    const header = document.getElementById("cmpAcordeonHeader");
    const body = document.getElementById("cmpAcordeonBody");
    const titulo = document.getElementById("cmpAcordeonTitulo");

    panel.classList.remove("d-none");

    if (diferencias.length === 0) {
        header.classList.remove("alerta");
        header.classList.add("ok");
        titulo.innerHTML = `<i class="fa fa-check-circle me-2"></i>Sin diferencias detectadas`;
        body.innerHTML = `<p class="m-0">La compra coincide perfectamente con la Orden de Compra.</p>`;
    } else {
        header.classList.remove("ok");
        header.classList.add("alerta");
        titulo.innerHTML = `<i class="fa fa-warning me-2"></i>Diferencias detectadas (${diferencias.length})`;

        let listHtml = `<ul>`;
        diferencias.forEach(df => listHtml += `<li>${df}</li>`);
        listHtml += `</ul>`;

        body.innerHTML = listHtml;
    }

    // toggle del acordeón
    header.onclick = () => {
        header.classList.toggle("abierto");
        body.style.display = body.style.display === "block" ? "none" : "block";
    };
}

/********************  VALIDACIONES + GUARDAR  ********************/

function validarCabeceraCompra() {
    let ok = true;
    const form = document.getElementById("frmCabeceraCompra");
    if (!form) return true;

    const requeridos = form.querySelectorAll("[data-required='true']");
    requeridos.forEach(ctrl => {
        const val = ctrl.value;
        const invalid = ctrl.parentElement.querySelector(".invalid-feedback");
        const vacio = !val || val === "0" || val === "-1";

        if (vacio) {
            ok = false;
            ctrl.classList.add("is-invalid");
            invalid?.classList.remove("d-none");
        } else {
            ctrl.classList.remove("is-invalid");
            invalid?.classList.add("d-none");
        }
    });

    const alert = document.getElementById("alertRequeridosCompra");
    if (alert) alert.classList.toggle("d-none", ok);

    return ok;
}

function validarDetalleCompra() {
    if (!detallesCompra.length) {
        document.getElementById("alertDetalleCompra")?.classList.remove("d-none");
        return false;
    }

    const ok = detallesCompra.some(d => _num(d.CantRecibida) > 0);
    document.getElementById("alertDetalleCompra")?.classList.toggle("d-none", ok);

    return ok;
}

async function guardarCompra() {
    if (!validarCabeceraCompra() || !validarDetalleCompra()) return;

    return withBusy("#btnNuevoModificarCompra", async () => {
        try {
            const id = _num($("#IdCompra").val());

            const payload = {
                Id: id,
                IdUnidadNegocio: _num($("#IdUnidadNegocio").val()),
                IdLocal: _num($("#IdLocal").val()),
                IdProveedor: _num($("#IdProveedor").val()),
                IdOrdenCompra: _num($("#OrdenCompraSelect").val()),
                Fecha: $("#FechaCompra").val(),
                NotaInterna: $("#NotaInterna").val(),

                Subtotal: formatearSinMiles($("#Subtotal").val()),
                Descuentos: formatearSinMiles($("#Descuentos").val()),
                SubtotalFinal: formatearSinMiles($("#SubtotalFinal").val()),

                ComprasInsumos: detallesCompra.map(d => ({
                    Id: d.IdCompraInsumo || 0,
                    IdInsumo: d.IdInsumo,
                    IdProveedorLista: d.IdProveedorLista,

                    Cantidad: d.CantRecibida,

                    PrecioLista: d.PrecioListaOC,
                    PrecioFactura: d.PrecioFactura,
                    Diferencia: d.DifPrecio,

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

            const url = id > 0 ? "/Compras/Actualizar" : "/Compras/Insertar";
            const method = id > 0 ? "PUT" : "POST";

            let cambios = [];
            try {
                const rImpacto = await fetch("/Compras/ImpactoPreciosGuardar", {
                    method: "POST",
                    headers: authHeaders({ "Content-Type": "application/json" }),
                    body: JSON.stringify(payload)
                });
                if (rImpacto.ok) {
                    const impacto = await rImpacto.json();
                    cambios = impacto?.cambios || impacto?.Cambios || [];
                }
            } catch (e) {
                console.warn("No se pudo obtener impacto de precios", e);
            }

            const okPrecios = await confirmarImpactoPreciosCompra("guardar", cambios, {
                mensaje: cambios.length
                    ? "Al aceptar esta compra, estos productos cambiarán de precio en la lista del proveedor:"
                    : (id > 0 ? "¿Guardar los cambios de la compra?" : "¿Registrar esta compra?")
            });
            if (!okPrecios) return;

            const r = await fetch(url, {
                method: method,
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(payload)
            });

            if (!r.ok) throw new Error(await r.text());

            const resp = await r.json();

            if (resp.valor) {
                window.location.href = "/Compras";
            } else {
                advertenciaModal?.(resp.mensaje ?? "No se pudo guardar.");
            }

        } catch (e) {
            console.error(e);
            advertenciaModal?.("Error inesperado al guardar la compra.");
        }
    });
}

/********************  FIN COMPLETO  ********************/
