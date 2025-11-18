/********************  ComprasNuevoModif.js — COMPLETO  ********************/
let detallesCompra = [];
let compraIdInicial = 0;

try {
    if (typeof CompraData === "number" || typeof CompraData === "string") {
        compraIdInicial = Number(CompraData) || 0;
    } else if (CompraData && typeof CompraData === "object") {
        compraIdInicial = Number(CompraData.Id ?? CompraData.id ?? 0) || 0;
    }
} catch {
    compraIdInicial = 0;
}

/* ================== AUTH / FETCH HELPERS ================== */
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

/* ================== FORMATOS ================== */
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

function formatearMiles(valor) {
    let num = String(valor).replace(/\D/g, '');
    if (!num) return "0";
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatearSinMiles(valor) {
    if (valor == null) return 0;

    let s = String(valor).trim();
    if (!s) return 0;

    s = s.replace(/[^\d.,-]/g, '');

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
        s = s.replace(',', '.');
    }

    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
}

/* ================== INIT ================== */
$(document).ready(async () => {
    try {
        initFechaCompra();
        initSelect2OC();
        hookDescuentosBlur();

        if (typeof IdOrdenCompraInicial === "number" && IdOrdenCompraInicial > 0) {
            await seleccionarOCInicial(IdOrdenCompraInicial);
        }

        if (compraIdInicial > 0) {
            await cargarCompraExistente(compraIdInicial);
        }

        wireDetalleEvents();
    } catch (e) {
        console.error(e);
    }
});

/* ================== FECHA / CABECERA ================== */
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

/* ========== SET CABECERA DESDE ORDEN DE COMPRA ========== */
function setCabeceraDesdeOC(oc) {
    $("#IdUnidadNegocio").val(oc.IdUnidadNegocio);
    $("#IdLocal").val(oc.IdLocal);
    $("#IdProveedor").val(oc.IdProveedor);

    $("#UnidadNegocioNombre").val(oc.UnidadNegocio ?? "");
    $("#LocalNombre").val(oc.Local ?? "");
    $("#ProveedorNombre").val(oc.Proveedor ?? "");

    if (oc.NotaInterna && !$("#NotaInterna").val()) {
        $("#NotaInterna").val(oc.NotaInterna);
    }

    if (oc.FechaEmision) {
        const f = String(oc.FechaEmision).substring(0, 10);
        $("#FechaCompra").val(f);
    }

    $("#tituloCompra").text(`Nueva Compra basada en OC #${oc.Id}`);
}

/* ================== SELECT2 ORDEN DE COMPRA ================== */
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
            data: params => ({
                term: params.term || ""
            }),
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
        if (idOC > 0) {
            await cargarDesdeOrdenCompra(idOC);
        }
    });

    sel.on("select2:clear", function () {
        detallesCompra = [];
        actualizarEtiquetaOC(null);
        renderDetalleCompra();
        recalcularTotales();
    });
}

async function seleccionarOCInicial(idOC) {
    const sel = $("#OrdenCompraSelect");
    const resp = await fetchJson(`/OrdenesCompras/EditarInfo?id=${idOC}`, { headers: authHeaders() });

    const oc = resp.OrdenCompra;
    const text = `OC #${oc.Id} - ${oc.Proveedor} - ${formatDateShort(oc.FechaEmision)}`;

    const opt = new Option(text, oc.Id, true, true);
    sel.append(opt).trigger("change");

    await cargarDesdeOCCompleta(oc, resp.OrdenesComprasInsumos);
}

/* ================== DETALLE DESDE OC ================== */
async function cargarDesdeOrdenCompra(idOC) {
    try {
        const resp = await fetchJson(`/OrdenesCompras/EditarInfo?id=${idOC}`, { headers: authHeaders() });

        const oc = resp.OrdenCompra || {};
        const detArray = resp.OrdenesComprasInsumos || [];

        await cargarDesdeOCCompleta(oc, detArray);
    } catch (e) {
        console.error(e);
        advertenciaModal?.("Error cargando la Orden de Compra.");
    }
}

async function cargarDesdeOCCompleta(oc, detArray = []) {
    if (!oc) return;

    // Cabecera y badge "Basado en OC #"
    setCabeceraDesdeOC(oc);
    actualizarEtiquetaOC(oc.Id);

    // Detalle desde la OC
    const origen = Array.isArray(detArray) ? detArray : [];
    detallesCompra = origen.map(d => mapLineaDesdeOC(d));

    renderDetalleCompra();
    recalcularTotales();

    // ===== TÍTULO Y BOTÓN (Registrar / Guardar) =====
    const btn = document.getElementById("btnNuevoModificarCompra");
    const titulo = document.getElementById("tituloCompra");

    // Id de compra actual (por variable global o hidden)
    const hiddenIdEl = document.getElementById("IdCompra");
    const idHidden = hiddenIdEl ? _num(hiddenIdEl.value) : 0;
    const idCompra = compraIdInicial > 0 ? compraIdInicial : idHidden;

    if (idCompra > 0) {
        // MODO EDICIÓN: debe comportarse como Ordenes de Compra
        if (titulo) titulo.textContent = `Editar Compra #${idCompra}`;
        if (btn) btn.innerHTML = `<i class="fa fa-save"></i> Guardar`;
    } else {
        // MODO NUEVA COMPRA (aunque esté basada en una OC)
        if (titulo) titulo.textContent = `Nueva Compra basada en OC #${oc.Id}`;
        if (btn) btn.innerHTML = `<i class="fa fa-save"></i> Registrar`;
    }
}

/* ================== MAPEO LINEA OC ================== */
function mapLineaDesdeOC(d) {
    const cant = _num(d.CantidadPedida ?? d.Cantidad ?? 0);

    const linea = {
        IdOrdenCompraInsumo: d.Id ?? 0,
        IdInsumo: d.IdInsumo,
        NombreInsumo: d.Nombre ?? d.Descripcion ?? ("#" + d.IdInsumo),
        Sku: d.Sku,

        CantPedida: cant,
        CantPendienteOC: _num(d.CantidadRestante ?? cant),
        CantRecibida: _num(d.CantidadRestante ?? cant),

        PrecioListaOC: _num(d.PrecioLista),
        PrecioFactura: _num(d.PrecioLista),

        DifCant: 0,
        DifPrecio: 0,

        Subtotal: 0,

        EstadoId: d.IdEstado ?? 1,
        EstadoNombre: d.Estado ?? "Pendiente",

        EstadoManual: false,

        IdProveedorLista: _num(d.IdProveedorLista ?? 0)
    };

    recalcularLinea(linea);
    autoEstado(linea);
    return linea;
}

/* ================== ETIQUETA OC ================== */
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

/* ================== ESTADO AUTO ================== */
function autoEstado(linea) {
    if (linea.EstadoManual) return;

    const ped = _num(linea.CantPendienteOC);
    const rec = _num(linea.CantRecibida);

    let id = 1, nombre = "Pendiente";
    if (rec >= ped && ped > 0) {
        id = 2; nombre = "Entregado";
    } else if (rec > 0 && rec < ped) {
        id = 3; nombre = "Incompleto";
    }

    linea.EstadoId = id;
    linea.EstadoNombre = nombre;
}

/* ================== RENDER DETALLE ================== */
function renderDetalleCompra() {
    const tbody = document.querySelector("#grd_DetalleCompra tbody");
    if (!tbody) return;

    if (!detallesCompra.length) {
        tbody.innerHTML = "";
        return;
    }

    let html = "";

    detallesCompra.forEach((d, idx) => {
        const claseDifCant = d.DifCant > 0 ? "badge-dif-pos" : (d.DifCant < 0 ? "badge-dif-neg" : "");
        const claseDifPrecio = d.DifPrecio > 0 ? "badge-dif-pos" : (d.DifPrecio < 0 ? "badge-dif-neg" : "");

        let estadoClase = "estado-pendiente";
        if (d.EstadoId === 2) estadoClase = "estado-entregado";
        else if (d.EstadoId === 3) estadoClase = "estado-incompleto";

        const skuTexto = d.Sku ? d.Sku : "-";

        html += `
<tr data-index="${idx}">
    <td class="col-insumo">
        <div class="compras-insumo-nombre">${d.NombreInsumo}</div>
        <div class="compras-insumo-extra">SKU: ${skuTexto}</div>
    </td>

    <td class="text-center">${fmtDec(d.CantPedida)}</td>
    <td class="text-center">${fmtDec(d.CantPendienteOC)}</td>

    <td class="text-center">
        <div class="compras-cell-editable">
            <span class="compras-cell-text" data-field="cantidad">${fmtDec(d.CantRecibida)}</span>
            <button type="button" class="compras-edit-btn" data-edit="cantidad"><i class="fa fa-pencil"></i></button>
        </div>
    </td>

    <td class="text-center ${claseDifCant}">${fmtDec(d.DifCant)}</td>

    <td class="text-center">${fmtMoney(d.PrecioListaOC)}</td>

    <td class="text-center">
        <div class="compras-cell-editable">
            <span class="compras-cell-text compras-cell-text-right" data-field="precio">${fmtMoney(d.PrecioFactura)}</span>
            <button type="button" class="compras-edit-btn" data-edit="precio"><i class="fa fa-pencil"></i></button>
        </div>
    </td>

    <td class="text-center ${claseDifPrecio}">${fmtMoney(d.DifPrecio)}</td>

    <td class="text-center">
        <div class="compras-cell-editable">
            <span class="badge-estado ${estadoClase}" data-field="estado">${d.EstadoNombre}</span>
            <button type="button" class="compras-edit-btn" data-edit="estado"><i class="fa fa-pencil"></i></button>
        </div>
    </td>

    <td class="text-center">${fmtMoney(d.Subtotal)}</td>
</tr>`;
    });

    tbody.innerHTML = html;
}

/* ================== EVENTOS DETALLE ================== */
function wireDetalleEvents() {
    const tbody = document.querySelector("#grd_DetalleCompra tbody");
    if (!tbody) return;

    tbody.addEventListener("click", function (e) {
        const btn = e.target.closest(".compras-edit-btn");
        if (!btn) return;
        const tr = e.target.closest("tr");
        const idx = Number(tr.dataset.index);
        const field = btn.getAttribute("data-edit");

        if (field === "cantidad") startInlineEditCantidad(tr, idx);
        if (field === "precio") startInlineEditPrecio(tr, idx);
        if (field === "estado") startInlineEditEstado(tr, idx);
    });
}

/* ========== EDITAR CANTIDAD ========== */
function startInlineEditCantidad(tr, idx) {
    const linea = detallesCompra[idx];
    if (!linea) return;

    const span = tr.querySelector('span[data-field="cantidad"]');
    const cont = span.parentElement;

    cont.innerHTML = `
<input type="text" class="compras-edit-input" value="${formatearMiles(linea.CantRecibida)}" />
<button type="button" class="compras-edit-accept"><i class="fa fa-check"></i></button>
<button type="button" class="compras-edit-cancel"><i class="fa fa-times"></i></button>`;

    const input = cont.querySelector("input");
    input.focus();
    input.select();

    const finish = apply => {
        if (apply) {
            const num = formatearSinMiles(input.value);
            linea.CantRecibida = num;
            recalcularLinea(linea);
            autoEstado(linea);
            renderDetalleCompra();
            recalcularTotales();
        } else {
            renderDetalleCompra();
        }
    };

    cont.querySelector(".compras-edit-accept").onclick = () => finish(true);
    cont.querySelector(".compras-edit-cancel").onclick = () => finish(false);
}

/* ========== EDITAR PRECIO ========== */
function startInlineEditPrecio(tr, idx) {
    const linea = detallesCompra[idx];
    if (!linea) return;

    const span = tr.querySelector('span[data-field="precio"]');
    const cont = span.parentElement;

    cont.innerHTML = `
<input type="text" class="compras-edit-input" value="${fmtMoney(linea.PrecioFactura)}" />
<button type="button" class="compras-edit-accept"><i class="fa fa-check"></i></button>
<button type="button" class="compras-edit-cancel"><i class="fa fa-times"></i></button>`;

    const input = cont.querySelector("input");
    input.focus();
    input.select();

    const finish = apply => {
        if (apply) {
            const num = formatearSinMiles(input.value);
            linea.PrecioFactura = num;
            recalcularLinea(linea);
            renderDetalleCompra();
            recalcularTotales();
        } else {
            renderDetalleCompra();
        }
    };

    cont.querySelector(".compras-edit-accept").onclick = () => finish(true);
    cont.querySelector(".compras-edit-cancel").onclick = () => finish(false);
}

/* ========== EDITAR ESTADO ========== */
function startInlineEditEstado(tr, idx) {
    const linea = detallesCompra[idx];
    if (!linea) return;

    const span = tr.querySelector('span[data-field="estado"]');
    const cont = span.parentElement;

    cont.innerHTML = `
<select class="compras-edit-input">
  <option value="1">Pendiente</option>
  <option value="2">Entregado</option>
  <option value="3">Incompleto</option>
</select>
<button type="button" class="compras-edit-accept"><i class="fa fa-check"></i></button>
<button type="button" class="compras-edit-cancel"><i class="fa fa-times"></i></button>`;

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

/* ================== RECÁLCULO ================== */
function recalcularLinea(linea) {
    const cant = _num(linea.CantRecibida);
    const ped = _num(linea.CantPendienteOC);
    const pLista = _num(linea.PrecioListaOC);
    const pFact = _num(linea.PrecioFactura);

    linea.DifCant = cant - ped;

    linea.DifPrecio = pLista - pFact;

    linea.Subtotal = cant * pFact;
}

function recalcularTotales() {
    let subtotal = 0;
    detallesCompra.forEach(d => subtotal += d.Subtotal);

    $("#Subtotal").val(fmtMoney(subtotal));

    let desc = formatearSinMiles($("#Descuentos").val());
    const total = subtotal - desc;

    $("#SubtotalFinal").val(fmtMoney(total));
}

function hookDescuentosBlur() {
    const d = document.getElementById("Descuentos");
    if (!d) return;

    d.addEventListener("blur", () => {
        const num = formatearSinMiles(d.value);
        d.value = "$" + formatearMiles(Math.round(num));
        recalcularTotales();
    });
}

async function cargarCompraExistente(id) {
    try {
        const compra = await fetchJson(`/Compras/EditarInfo?id=${id}`, { headers: authHeaders() });
        if (!compra) return;

        // ----- Cabecera -----
        $("#IdCompra").val(compra.Id);
        $("#tituloCompra").text(`Editar Compra #${compra.Id}`);

        $("#IdUnidadNegocio").val(compra.IdUnidadNegocio);
        $("#IdLocal").val(compra.IdLocal);
        $("#IdProveedor").val(compra.IdProveedor);

        $("#UnidadNegocioNombre").val(compra.UnidadNegocioNombre ?? "");
        $("#LocalNombre").val(compra.LocalNombre ?? "");
        $("#ProveedorNombre").val(compra.ProveedorNombre ?? "");

        if (compra.Fecha) {
            $("#FechaCompra").val(String(compra.Fecha).substring(0, 10));
        }

        $("#NotaInterna").val(compra.NotaInterna ?? "");

        $("#Subtotal").val(fmtMoney(compra.Subtotal));
        $("#Descuentos").val("$" + formatearMiles(Math.round(compra.Descuentos ?? 0)));
        $("#SubtotalFinal").val(fmtMoney(compra.SubtotalFinal));

        // Si la compra está asociada a una OC, marco la etiqueta y cargo la OC
        if (compra.IdOrdenCompra) {
            actualizarEtiquetaOC(compra.IdOrdenCompra);
            // Esto solo posiciona el select2 y carga la info de la OC,
            // no pisa el detalle que armamos abajo.
            await seleccionarOCInicial(compra.IdOrdenCompra);
        }

        // ----- Detalle -----
        const detRaw = compra.ComprasInsumos || [];
        detallesCompra = detRaw.map(ci => {
            // Cantidades
            const cantPedidaOc = _num(
                ci.CantPedidaOc ??
                ci.cantPedidaOc ??
                ci.CantidadPedidaOc ?? // por las dudas
                ci.Cantidad ??          // fallback
                ci.cantidad ?? 0
            );

            const cantPendOc = _num(
                ci.CantidadPendienteOc ??
                ci.cantidadPendienteOc ??
                ci.CantPendienteOc ??   // otro posible nombre
                cantPedidaOc
            );

            const cantRecibida = _num(ci.Cantidad ?? ci.cantidad ?? 0);

            // Precios
            const pLista = _num(ci.PrecioLista ?? ci.precioLista ?? 0);
            const pFact  = _num(ci.PrecioFactura ?? ci.precioFactura ?? 0);

            // Diferencias: si vienen del backend las uso, si no las calculo
            let difCant = ci.DifCant ?? ci.difCant;
            if (difCant === undefined || difCant === null) {
                difCant = cantRecibida - cantPendOc;
            }
            difCant = _num(difCant);

            let difPrecio = ci.DifPrecio ?? ci.difPrecio;
            if (difPrecio === undefined || difPrecio === null) {
                // regla que definimos: positivo si la factura es MÁS BARATA
                // Lista 2431,45 / Factura 2200,00 => Dif = +231,45
                difPrecio = pLista - pFact;
            }
            difPrecio = _num(difPrecio);

            // Subtotal
            let sub = _num(
                ci.SubtotalFinal ?? ci.subtotalFinal ??
                ci.SubtotalConDescuento ?? ci.subtotalConDescuento ??
                ci.Subtotal ?? ci.subtotal ?? 0
            );
            if (!sub) {
                sub = cantRecibida * pFact;
            }

            const linea = {
                IdCompraInsumo: ci.Id ?? ci.id ?? 0,
                IdOrdenCompraInsumo: ci.IdOrdenCompraInsumo ?? ci.idOrdenCompraInsumo ?? 0,
                IdInsumo: ci.IdInsumo ?? ci.idInsumo,
                NombreInsumo:
                    ci.NombreInsumo ?? ci.nombreInsumo ??
                    ci.Nombre ?? ci.nombre ??
                    ci.Insumo ?? ci.insumo ??
                    ("#" + (ci.IdInsumo ?? ci.idInsumo)),
                Sku: ci.Sku ?? ci.sku ?? null,

                CantPedida: cantPedidaOc,
                CantPendienteOC: cantPendOc,
                CantRecibida: cantRecibida,

                PrecioListaOC: pLista,
                PrecioFactura: pFact,

                DifCant: difCant,
                DifPrecio: difPrecio,

                Subtotal: sub,

                EstadoId: ci.IdEstadoOcInsumo ?? ci.idEstadoOcInsumo ?? 1,
                EstadoNombre: ci.EstadoOcInsumoNombre ?? ci.estadoOcInsumoNombre ?? "Pendiente",
                EstadoManual: true,

                IdProveedorLista: _num(ci.IdProveedorLista ?? ci.idProveedorLista ?? 0)
            };

            // No hace falta recalcular acá, pero si querés asegurarte que
            // siga la misma fórmula cuando se edite, podés dejar esto:
            // recalcularLinea(linea);

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

/* ================== VALIDACIONES ================== */
function validarCabeceraCompra() {
    let ok = true;
    const form = document.getElementById("frmCabeceraCompra");

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

    const ok = detallesCompra.some(d => d.CantRecibida > 0);
    document.getElementById("alertDetalleCompra")?.classList.toggle("d-none", ok);

    return ok;
}

/* ================== GUARDAR ================== */
async function guardarCompra() {
    try {
        if (!validarCabeceraCompra() || !validarDetalleCompra()) return;

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
                IdOrdenCompraInsumo: d.IdOrdenCompraInsumo || 0,
                IdInsumo: d.IdInsumo,
                IdProveedorLista: d.IdProveedorLista,
                Cantidad: d.CantRecibida,
                PrecioLista: d.PrecioListaOC,
                PrecioFactura: d.PrecioFactura,
                Diferencia: d.DifPrecio,
                PorcDescuento: d.PorcDescuento ?? null,
                DescuentoUnitario: d.DescuentoUnitario ?? null,
                PrecioFinal: d.PrecioFactura,
                DescuentoTotal: d.DescuentoTotal ?? null,
                SubtotalConDescuento: d.Subtotal,
                SubtotalFinal: d.Subtotal,
                IdEstadoOcInsumo: d.EstadoId
            }))
        };

        const url = id > 0 ? "/Compras/Actualizar" : "/Compras/Insertar";
        const method = id > 0 ? "PUT" : "POST";

        const r = await fetch(url, {
            method,
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
}

/********************  FIN COMPLETO  ********************/
