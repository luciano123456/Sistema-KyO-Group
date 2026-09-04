/* ============================================================================
 * GastosNuevoModif.js — Alta y edición de un gasto, con pago opcional de contado
 * ========================================================================== */

const gnEstado = {
    id: 0,
    cuentas: [],
    gasto: null      // gasto cargado cuando es edición
};

$(document).ready(async function () {
    gnEstado.id = Number(document.querySelector('[data-id-gasto]')?.dataset.idGasto || 0);

    document.getElementById('gnFecha').value = TS.hoy();
    document.getElementById('gnFechaPago').value = TS.hoy();

    gnBind();
    await gnCargarCatalogos();

    if (gnEstado.id > 0) await gnCargarGasto();

    gnActualizarResumen();
});

/* ═════════════════════════════ Catálogos ═════════════════════════════ */

async function gnCargarCatalogos() {
    try {
        const [cat, saldos] = await Promise.all([
            TS.catalogos(),
            TS.get('/Cajas/Saldos', { soloActivas: true })
        ]);
        gnEstado.cuentas = saldos || [];

        TS.llenar('#gnCategoria', cat.Categorias, { text: 'NombreCompleto', vacio: 'Elegí una categoría' });
        TS.llenar('#gnProveedor', cat.Proveedores, { vacio: 'Sin proveedor' });
        TS.llenar('#gnUnidad', cat.UnidadesNegocio, { vacio: 'Sin unidad' });
        TS.llenar('#gnLocal', cat.Locales, { vacio: 'Sin local' });
        TS.llenar('#gnCuentaPago', cat.Cuentas, { vacio: false });
        TS.llenar('#gnMedioPago', cat.MediosPago, { vacio: 'Sin especificar' });
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los catálogos: ' + err.message);
    }
}

/* ═════════════════════════════ Eventos ═════════════════════════════ */

function gnBind() {
    document.getElementById('gnProveedor').addEventListener('change', gnSincronizarCuentaCorriente);
    document.getElementById('gnImpactaCc').addEventListener('change', gnActualizarResumen);
    document.getElementById('gnImporte').addEventListener('input', gnActualizarResumen);
    document.getElementById('gnVencimiento').addEventListener('change', gnActualizarResumen);
    document.getElementById('gnCuentaPago').addEventListener('change', gnActualizarResumen);
    document.getElementById('gnImportePago').addEventListener('input', gnActualizarResumen);

    ['gnFecha', 'gnVencimiento', 'gnCategoria', 'gnImporte', 'gnConcepto', 'gnCuentaPago', 'gnImportePago']
        .forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            ['input', 'change'].forEach(evt => {
                el.addEventListener(evt, () => TS.marcarCampo(el, false));
            });
        });

    document.getElementById('gnPagarAhora').addEventListener('change', function () {
        document.getElementById('gnCamposPago').style.display = this.checked ? 'block' : 'none';
        if (this.checked && window.KyoSelect2) {
            window.KyoSelect2.refresh(document.getElementById('gnCuentaPago'));
            window.KyoSelect2.refresh(document.getElementById('gnMedioPago'));
        }
        gnActualizarResumen();
    });

    document.getElementById('gnBtnGuardar').addEventListener('click', busyHandler(gnGuardar));
}

/**
 * La cuenta corriente sólo tiene sentido con proveedor: sin proveedor el gasto
 * se paga directo desde una cuenta de fondos.
 */
function gnSincronizarCuentaCorriente() {
    const idProveedor = Number(document.getElementById('gnProveedor').value || 0);
    const check = document.getElementById('gnImpactaCc');
    const nota = document.getElementById('gnNotaCc');
    const texto = nota.querySelector('span');

    check.disabled = !idProveedor;
    if (!idProveedor) {
        check.checked = false;
        nota.className = 'ts-note ts-note--sky';
        texto.textContent = 'Elegí un proveedor para poder cargar el gasto a su cuenta corriente.';
    } else {
        nota.className = 'ts-note';
        texto.innerHTML = check.checked
            ? 'El gasto va a figurar como deuda en la cuenta corriente del proveedor, y cada pago la va descontando.'
            : 'Activá la opción si el gasto queda a cuenta del proveedor en lugar de pagarse contra caja.';
    }

    gnActualizarResumen();
}

/* ═════════════════════════════ Edición ═════════════════════════════ */

async function gnCargarGasto() {
    try {
        const g = await TS.get('/Gastos/Obtener', { id: gnEstado.id });
        gnEstado.gasto = g;

        document.getElementById('gnTitulo').textContent = `Gasto #${g.Id}`;
        document.getElementById('gnSubtitulo').textContent =
            `Registrado el ${TS.dateTime(g.FechaRegistra)}${g.UsuarioRegistra ? ' por ' + g.UsuarioRegistra : ''}`;

        document.getElementById('gnFecha').value = TS.isoDate(g.Fecha);
        document.getElementById('gnVencimiento').value = g.FechaVencimiento ? TS.isoDate(g.FechaVencimiento) : '';
        document.getElementById('gnCategoria').value = g.IdCategoria || '';
        document.getElementById('gnImporte').value = g.Importe;
        document.getElementById('gnConcepto').value = g.Concepto || '';
        document.getElementById('gnComprobanteTipo').value = g.ComprobanteTipo || '';
        document.getElementById('gnComprobanteNumero').value = g.ComprobanteNumero || '';
        document.getElementById('gnDetalle').value = g.Detalle || '';
        document.getElementById('gnProveedor').value = g.IdProveedor || '';
        document.getElementById('gnUnidad').value = g.IdUnidadNegocio || '';
        document.getElementById('gnLocal').value = g.IdLocal || '';
        ['gnCategoria', 'gnProveedor', 'gnUnidad', 'gnLocal', 'gnComprobanteTipo'].forEach(id => {
            if (window.KyoSelect2) window.KyoSelect2.refresh(document.getElementById(id));
        });
        document.getElementById('gnImpactaCc').checked = !!g.ImpactaCuentaCorriente;
        document.getElementById('gnNota').value = g.NotaInterna || '';

        const pill = document.getElementById('gnPillEstado');
        pill.style.display = '';
        pill.innerHTML = g.Anulado
            ? '<i class="fa fa-ban"></i>Anulado'
            : `<i class="fa fa-info-circle"></i>${TS.html(g.Estado)} · pendiente <strong>${TS.money(g.Pendiente)}</strong>`;

        // Con pagos hechos, el importe se toca sólo hacia arriba del pagado y el
        // pago de contado ya no aplica: se administra desde el listado.
        if (Number(g.ImportePagado ?? 0) > 0) {
            document.getElementById('gnPanelPago').style.display = 'none';
            await gnCargarPagosPrevios();
        }

        if (g.Anulado) {
            document.getElementById('gnBtnGuardar').disabled = true;
            advertenciaModal('Este gasto está anulado: sólo se puede consultar.');
        }

        gnSincronizarCuentaCorriente();
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar el gasto: ' + err.message);
    }
}

async function gnCargarPagosPrevios() {
    const panel = document.getElementById('gnPanelPagosPrevios');
    const cont = document.getElementById('gnPagosPrevios');

    try {
        const pagos = await TS.get('/Gastos/Pagos', { idGasto: gnEstado.id });
        if (!pagos?.length) return;

        panel.style.display = '';
        cont.innerHTML = pagos.map(p => `
            <div class="ts-pago${p.Anulado ? ' is-anulado' : ''}">
                <div class="ts-pago-body">
                    <div class="ts-pago-title">${TS.date(p.Fecha)} · ${TS.html(p.Cuenta || '')}</div>
                    <div class="ts-pago-meta">${TS.html(p.MedioPago || 'Sin medio')}</div>
                </div>
                <div class="ts-pago-amount">${TS.money(p.Importe)}</div>
            </div>`).join('');
    } catch (err) {
        console.error(err);
    }
}

/* ═════════════════════════════ Resumen ═════════════════════════════ */

function gnActualizarResumen() {
    const importe = TS.leerDecimal(document.getElementById('gnImporte'));
    const pagarAhora = document.getElementById('gnPagarAhora').checked
        && document.getElementById('gnPanelPago').style.display !== 'none';
    const impactaCc = document.getElementById('gnImpactaCc').checked;
    const yaPagado = Number(gnEstado.gasto?.ImportePagado ?? 0);

    const importePago = pagarAhora
        ? (TS.leerDecimal(document.getElementById('gnImportePago')) || importe)
        : 0;
    const pagado = yaPagado + importePago;
    const pendiente = Math.max(0, importe - pagado);

    const estado = importe <= 0 ? '—'
        : pendiente <= 0.005 ? 'Pagado'
        : pagado > 0 ? 'Pago parcial'
        : 'Pendiente';

    const filas = [
        ['Importe del gasto', TS.money(importe)],
        ['Pagado', TS.money(pagado)],
        ['Pendiente', TS.money(pendiente)],
        ['Estado resultante', estado]
    ];

    document.getElementById('gnResumen').innerHTML = filas.map(([k, v]) => `
        <div class="ts-pago">
            <div class="ts-pago-body"><div class="ts-pago-title">${TS.html(k)}</div></div>
            <div class="ts-pago-amount" style="color:var(--oa-ink)">${TS.html(v)}</div>
        </div>`).join('');

    gnActualizarNotaImpacto({ importe, importePago, pagarAhora, impactaCc });
    gnActualizarHintSaldo(importePago);
}

function gnActualizarNotaImpacto({ importe, importePago, pagarAhora, impactaCc }) {
    const nota = document.getElementById('gnNotaImpacto');
    const texto = nota.querySelector('span');

    if (importe <= 0) {
        nota.className = 'ts-note';
        texto.textContent = 'Completá el importe para ver el impacto.';
        return;
    }

    const partes = [];
    if (impactaCc) partes.push(`suma <strong>${TS.money(importe)}</strong> de deuda en la cuenta corriente del proveedor`);
    if (pagarAhora && importePago > 0) {
        const cuenta = gnEstado.cuentas.find(c => c.Id === Number(document.getElementById('gnCuentaPago').value || 0));
        partes.push(`registra un egreso de <strong>${TS.money(importePago)}</strong> en ${TS.html(cuenta?.Nombre || 'la cuenta elegida')}`);
    }
    if (!partes.length) partes.push('queda pendiente de pago, sin mover caja todavía');

    nota.className = 'ts-note ts-note--sage';
    texto.innerHTML = 'Al guardar: ' + partes.join(' y ') + '.';
}

function gnActualizarHintSaldo(importePago) {
    const hint = document.getElementById('gnSaldoHint');
    const cuenta = gnEstado.cuentas.find(c => c.Id === Number(document.getElementById('gnCuentaPago').value || 0));

    if (!cuenta) { hint.textContent = ''; return; }

    const resultante = Number(cuenta.Saldo ?? 0) - importePago;
    const insuficiente = importePago > 0 && resultante < 0 && !cuenta.PermiteNegativo;

    hint.innerHTML = `Disponible <strong>${TS.money(cuenta.Saldo)}</strong>` +
        (importePago > 0 ? ` → queda ${TS.money(resultante)}` : '') +
        (insuficiente ? ' — no admite saldo negativo' : '');
    hint.style.color = insuficiente ? 'var(--ts-out)' : '';
}

/* ═════════════════════════════ Guardado ═════════════════════════════ */

async function gnGuardar() {
    TS.limpiarErrores('.ts-page');

    const importe = TS.leerDecimal(document.getElementById('gnImporte'));
    const idCategoria = Number(document.getElementById('gnCategoria').value || 0);
    const concepto = document.getElementById('gnConcepto').value.trim();
    const pagarAhora = document.getElementById('gnPagarAhora').checked
        && document.getElementById('gnPanelPago').style.display !== 'none';

    const fecha = document.getElementById('gnFecha').value;
    const vencimiento = document.getElementById('gnVencimiento').value || null;
    const importePago = pagarAhora
        ? (TS.leerDecimal(document.getElementById('gnImportePago')) || importe)
        : null;

    const marcar = (id, msg) => TS.marcarCampo(document.getElementById(id), true, msg);
    const avisos = [];

    if (!fecha) { marcar('gnFecha', 'Campo obligatorio'); avisos.push('Indicá la fecha del gasto.'); }
    if (!idCategoria) { marcar('gnCategoria', 'Campo obligatorio'); avisos.push('Elegí una categoría.'); }
    if (importe <= 0) { marcar('gnImporte', 'Debe ser mayor que 0'); avisos.push('El importe debe ser mayor a cero.'); }
    if (!concepto) { marcar('gnConcepto', 'Campo obligatorio'); avisos.push('Escribí el concepto del gasto.'); }
    if (vencimiento && fecha && vencimiento < fecha) {
        marcar('gnVencimiento', 'No puede ser anterior a la fecha del gasto.');
        avisos.push('El vencimiento no puede ser anterior a la fecha del gasto.');
    }

    if (pagarAhora) {
        if (!Number(document.getElementById('gnCuentaPago').value || 0)) {
            marcar('gnCuentaPago', 'Campo obligatorio');
            avisos.push('Elegí la cuenta de la que sale el pago.');
        }
        if (importePago > importe + 0.005) {
            marcar('gnImportePago', 'No puede superar el total del gasto.');
            avisos.push('El importe pagado no puede superar el total del gasto.');
        }
    }

    if (avisos.length) {
        const primero = document.querySelector('.ts-page .is-invalid');
        primero?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        primero?.focus();
        return advertenciaModal(avisos[0]);
    }

    const model = {
        Id: gnEstado.id,
        IdCategoria: idCategoria,
        IdProveedor: Number(document.getElementById('gnProveedor').value || 0) || null,
        IdUnidadNegocio: Number(document.getElementById('gnUnidad').value || 0) || null,
        IdLocal: Number(document.getElementById('gnLocal').value || 0) || null,
        Fecha: fecha,
        FechaVencimiento: vencimiento,
        Concepto: concepto,
        Detalle: document.getElementById('gnDetalle').value.trim() || null,
        ComprobanteTipo: document.getElementById('gnComprobanteTipo').value || null,
        ComprobanteNumero: document.getElementById('gnComprobanteNumero').value.trim() || null,
        Importe: importe,
        ImpactaCuentaCorriente: document.getElementById('gnImpactaCc').checked,
        NotaInterna: document.getElementById('gnNota').value.trim() || null,
        PagarAhora: pagarAhora,
        IdCuentaPago: pagarAhora ? Number(document.getElementById('gnCuentaPago').value) : null,
        IdMedioPago: pagarAhora ? (Number(document.getElementById('gnMedioPago').value || 0) || null) : null,
        ImportePago: importePago,
        FechaPago: pagarAhora ? (document.getElementById('gnFechaPago').value || fecha) : null
    };

    const r = await TS.ejecutar(TS.post('/Gastos/Guardar', model), { silencioso: true });
    if (!r) return;

    const eraNuevo = gnEstado.id === 0;
    gnEstado.id = r.id || gnEstado.id;

    const opcion = await kyoDespuesGuardar({
        titulo: eraNuevo ? 'Gasto registrado' : 'Gasto actualizado',
        mensaje: r.mensaje || '¿Qué querés hacer ahora?',
        labelListado: 'Ir al listado de gastos',
        labelEditar: eraNuevo ? 'Cargar otro gasto' : 'Seguir en este gasto'
    });

    if (opcion === 'listado') {
        location.href = '/Finanzas?tab=gastos';
    } else if (eraNuevo) {
        location.href = '/Gastos/NuevoModif';
    } else {
        await gnCargarGasto();
        gnActualizarResumen();
    }
}
