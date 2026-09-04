/* ============================================================================
 * Gastos.js — Listado de gastos, tablero del período y gestión de pagos
 * ========================================================================== */

const gsEstado = {
    cuentas: [],
    grid: { dt: null },
    gasto: null,       // gasto abierto en el modal de pagos
    anular: null
};

$(document).ready(async function () {
    if (document.getElementById('fgHub')) return;
    if (!document.getElementById('gsDesde')) return;
    await initFinanzasGastos();
});

window.initFinanzasGastos = initFinanzasGastos;

async function initFinanzasGastos(opts = {}) {
    if (gsEstado._listo) {
        if (opts.desde) document.getElementById('gsDesde').value = opts.desde;
        if (opts.hasta) document.getElementById('gsHasta').value = opts.hasta;
        if (opts.desde || opts.hasta) {
            document.querySelectorAll('#gsChipsRango .ts-chip').forEach(c => c.classList.remove('active'));
        }
        await gsCargar();
        try { gsEstado.grid.dt?.columns.adjust(); } catch { /* noop */ }
        return;
    }
    gsEstado._listo = true;

    const rg = TS.rango('mes');
    document.getElementById('gsDesde').value = opts.desde || rg.desde;
    document.getElementById('gsHasta').value = opts.hasta || rg.hasta;

    gsBindFiltros();
    gsBindModales();

    await gsCargarCatalogos();
    await gsCargar();
}

/* ═════════════════════════════ Catálogos ═════════════════════════════ */

async function gsCargarCatalogos() {
    try {
        const [cat, saldos] = await Promise.all([
            TS.catalogos(),
            TS.get('/Cajas/Saldos', { soloActivas: true })
        ]);
        gsEstado.cuentas = saldos || [];

        TS.llenar('#gsCategoria', cat.Categorias, { text: 'NombreCompleto', vacio: 'Todas las categorías' });
        TS.llenar('#gsProveedor', cat.Proveedores, { vacio: 'Todos los proveedores' });
        TS.llenar('#gsEstado', cat.EstadosGasto, { vacio: 'Todos los estados' });
        TS.llenar('#gsLocal', cat.Locales, { vacio: 'Todos los locales' });

        TS.llenar('#pgCuenta', cat.Cuentas, { vacio: false });
        TS.llenar('#pgMedioPago', cat.MediosPago, { vacio: 'Sin especificar' });
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los catálogos: ' + err.message);
    }
}

/* ═════════════════════════════ Filtros ═════════════════════════════ */

function gsBindFiltros() {
    document.querySelectorAll('#gsChipsRango .ts-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const rg = TS.rango(TS.chipActivo('#gsChipsRango', chip));
            document.getElementById('gsDesde').value = rg.desde;
            document.getElementById('gsHasta').value = rg.hasta;
            gsCargar();
        });
    });

    ['gsDesde', 'gsHasta'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            document.querySelectorAll('#gsChipsRango .ts-chip').forEach(c => c.classList.remove('active'));
            gsCargar();
        });
    });

    ['gsCategoria', 'gsProveedor', 'gsEstado', 'gsLocal',
     'gsSoloPendientes', 'gsSoloVencidos', 'gsIncluirAnulados']
        .forEach(id => document.getElementById(id).addEventListener('change', gsCargar));

    document.getElementById('gsBtnBuscar').addEventListener('click', gsCargar);
    document.getElementById('gsTexto').addEventListener('input', debounce(gsCargar, 400));
    document.getElementById('gsTexto').addEventListener('keydown', e => { if (e.key === 'Enter') gsCargar(); });
}

function gsFiltro() {
    return {
        fechaDesde: document.getElementById('gsDesde').value,
        fechaHasta: document.getElementById('gsHasta').value,
        idCategoria: document.getElementById('gsCategoria').value,
        idProveedor: document.getElementById('gsProveedor').value,
        idEstado: document.getElementById('gsEstado').value,
        idLocal: document.getElementById('gsLocal').value,
        texto: document.getElementById('gsTexto').value.trim(),
        soloPendientes: document.getElementById('gsSoloPendientes').checked,
        soloVencidos: document.getElementById('gsSoloVencidos').checked,
        incluirAnulados: document.getElementById('gsIncluirAnulados').checked
    };
}

/* ═════════════════════════════ Carga ═════════════════════════════ */

async function gsCargar() {
    TS.loading('gsLoading', true);
    const f = gsFiltro();

    try {
        const [gastos, resumen] = await Promise.all([
            TS.get('/Gastos/Lista', f),
            TS.get('/Gastos/Resumen', f)
        ]);

        gsPintarKpis(resumen);
        gsPintarRanking(resumen.PorCategoria || []);
        gsPintarGrid(gastos || []);

        const cant = gastos?.length || 0;
        document.getElementById('gsSubtitulo').textContent =
            cant ? `${cant} ${cant === 1 ? 'comprobante' : 'comprobantes'} en el filtro actual` : 'Sin resultados';
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los gastos: ' + err.message);
    } finally {
        TS.loading('gsLoading', false);
    }
}

function gsPintarKpis(r) {
    TS.setMoney('gsKpiTotal', r.Total);
    TS.setMoney('gsKpiPagado', r.Pagado);
    TS.setMoney('gsKpiPendiente', r.Pendiente);
    TS.setMoney('gsKpiVencido', r.Vencido);

    const total = Number(r.Total ?? 0);
    const pct = total > 0 ? Math.round((Number(r.Pagado ?? 0) / total) * 100) : 0;

    TS.setTexto('gsKpiCantidad', `${r.Cantidad || 0} comprobantes`);
    TS.setTexto('gsKpiPagadoPct', `${pct}% del total`);
    TS.setTexto('gsKpiCantPendientes', `${r.CantidadPendientes || 0} con saldo`);
    TS.setTexto('gsKpiCantVencidos', (r.CantidadVencidos || 0)
        ? `${r.CantidadVencidos} a regularizar`
        : 'todo al día');

    document.getElementById('gsPillPendiente').innerHTML =
        `<i class="fa fa-hourglass-half"></i>Pendiente <strong>${TS.money(r.Pendiente)}</strong>`;
}

function gsPintarRanking(items) {
    const cont = document.getElementById('gsPorCategoria');

    if (!items.length) {
        cont.innerHTML = TS.vacio('Sin datos', 'No hay gastos que coincidan con el filtro.', 'tags');
        return;
    }

    const max = Math.max(1, ...items.map(i => Number(i.Monto ?? 0)));

    cont.innerHTML = items.map(i => {
        const pct = Math.round((Number(i.Monto ?? 0) / max) * 100);
        const icono = i.Icono ? `<i class="fa fa-${TS.icono(i.Icono)}"></i> ` : '';
        return `
            <div class="ts-rank-item">
                <div class="ts-rank-head">
                    <span class="ts-rank-name">${icono}${TS.html(i.Nombre)}<small> · ${i.Cantidad || 0}</small></span>
                    <span class="ts-rank-value">${TS.money(i.Monto)}</span>
                </div>
                <div class="ts-rank-bar"><span style="width:${pct}%${i.Color ? `;background:${TS.html(i.Color)}` : ''}"></span></div>
            </div>`;
    }).join('');
}

/* ═════════════════════════════ Grilla ═════════════════════════════ */

function gsPintarGrid(gastos) {
    const columnas = [
        columnaGridId(),
        { data: 'Fecha', title: 'Fecha', render: (d, t) => t === 'display' ? TS.date(d) : d },
        {
            data: 'FechaVencimiento', title: 'Vence',
            render: (d, t, row) => {
                if (t !== 'display') return d || '';
                if (!d) return '<span class="ts-amt ts-amt--muted">—</span>';
                const texto = TS.date(d);
                if (row.Vencido) return `<span class="ts-amt ts-amt--out">${texto}</span>`;
                if (row.DiasParaVencer != null && row.DiasParaVencer <= 7 && row.IdEstado !== 3)
                    return `<span class="ts-amt" style="color:var(--ts-warn)">${texto}</span>`;
                return texto;
            }
        },
        {
            data: 'Categoria', title: 'Categoría',
            render: (d, t, row) => {
                if (t !== 'display') return d || '';
                const icono = row.CategoriaIcono ? `<i class="fa fa-${TS.icono(row.CategoriaIcono)}"></i> ` : '';
                return `${icono}${TS.html(d || '—')}`;
            }
        },
        { data: 'Proveedor', title: 'Proveedor', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        {
            data: 'Concepto', title: 'Concepto',
            render: (d, t, row) => {
                if (t !== 'display') return d || '';
                const cc = row.ImpactaCuentaCorriente
                    ? '<span class="ts-concepto-origen"><i class="fa fa-exchange"></i> Impacta cuenta corriente</span>'
                    : '';
                return `${TS.html(d || '')}${cc}`;
            }
        },
        {
            data: 'ComprobanteNumero', title: 'Comprobante',
            render: (d, t, row) => {
                if (t !== 'display') return d || '';
                if (!d && !row.ComprobanteTipo) return '<span class="ts-amt ts-amt--muted">—</span>';
                return TS.html([row.ComprobanteTipo, d].filter(Boolean).join(' '));
            }
        },
        { data: 'Importe', title: 'Importe', className: 'text-end', render: (d, t) => t === 'display' ? TS.saldo(d) : d },
        {
            data: 'ImportePagado', title: 'Pagado', className: 'text-end',
            render: (d, t, row) => t === 'display'
                ? `${TS.importe(d, 'in')}${TS.progreso(d, row.Importe)}`
                : d
        },
        {
            data: 'Pendiente', title: 'Pendiente', className: 'text-end',
            render: (d, t) => t === 'display' ? TS.importe(d, 'out') : d
        },
        {
            data: 'Estado', title: 'Estado', className: 'text-center',
            render: (d, t, row) => t === 'display'
                ? (row.Anulado ? TS.badge('Anulado', 'muted', 'ban') : TS.badgeEstadoGasto(row.IdEstado, d, row.Vencido))
                : d
        },
        {
            data: null, title: 'Acciones', orderable: false, searchable: false, className: 'text-center',
            render: (d, t, row) => t === 'display' ? gsAcciones(row) : ''
        }
    ];

    TS.grilla(gsEstado.grid, '#grd_Gastos', columnas, gastos, {
        order: [[1, 'desc'], [0, 'desc']],
        skipFiltros: [11],
        createdRow: (tr, data) => { if (data.Anulado) tr.classList.add('ts-row-anulada'); }
    });

    $('#grd_Gastos tbody')
        .off('click', '[data-accion]')
        .on('click', '[data-accion]', function () {
            const row = gastos.find(g => g.Id === Number(this.dataset.id));
            if (!row) return;

            switch (this.dataset.accion) {
                case 'pagar': gsAbrirPagos(row); break;
                case 'anular': gsAbrirAnular(row); break;
                case 'eliminar': gsEliminar(row); break;
            }
        });
}

function gsAcciones(row) {
    if (row.Anulado) return TS.badge('Anulado', 'muted', 'ban');

    const pendiente = Number(row.Pendiente ?? 0) > 0.005;
    const pagar = `
        <button type="button" class="ts-btn ${pendiente ? 'ts-btn--in' : 'ts-btn--ghost'} ts-btn--sm"
                data-accion="pagar" data-id="${row.Id}" title="${pendiente ? 'Registrar pago' : 'Ver pagos'}">
            <i class="fa fa-${pendiente ? 'money' : 'history'}"></i>
        </button>`;

    const editar = `
        <a class="ts-btn ts-btn--ghost ts-btn--sm" href="/Gastos/NuevoModif/${row.Id}" title="Editar">
            <i class="fa fa-pencil"></i>
        </a>`;

    // Sin pagos todavía se puede borrar de verdad; con pagos sólo queda anular.
    const baja = Number(row.ImportePagado ?? 0) > 0
        ? `<button type="button" class="ts-btn ts-btn--out ts-btn--sm" data-accion="anular" data-id="${row.Id}" title="Anular">
               <i class="fa fa-ban"></i>
           </button>`
        : `<button type="button" class="ts-btn ts-btn--out ts-btn--sm" data-accion="eliminar" data-id="${row.Id}" title="Eliminar">
               <i class="fa fa-trash"></i>
           </button>`;

    return pagar + editar + baja;
}

/* ═════════════════════════ Modal de pagos ═════════════════════════ */

function gsBindModales() {
    document.getElementById('pgCuenta').addEventListener('change', gsActualizarHintPago);
    document.getElementById('pgImporte').addEventListener('input', gsActualizarHintPago);
    document.getElementById('pgBtnGuardar').addEventListener('click', busyHandler(gsRegistrarPago));

    document.getElementById('pgBtnPagarTodo').addEventListener('click', function () {
        const pendiente = Number(gsEstado.gasto?.Pendiente ?? 0);
        if (pendiente <= 0) return advertenciaModal('Este gasto ya está totalmente pagado.');
        document.getElementById('pgImporte').value = pendiente.toFixed(2);
        gsActualizarHintPago();
        document.getElementById('pgBtnGuardar').focus();
    });

    document.getElementById('anlGastoBtnConfirmar').addEventListener('click', busyHandler(gsConfirmarAnulacion));
}

async function gsAbrirPagos(row) {
    gsEstado.gasto = row;

    const pendiente = Number(row.Pendiente ?? 0);
    document.getElementById('pgTitulo').textContent = pendiente > 0
        ? `Pagar gasto #${row.Id}`
        : `Pagos del gasto #${row.Id}`;

    document.querySelector('#pgResumenGasto span').innerHTML =
        `<strong>${TS.html(row.Concepto || '')}</strong> · ${TS.html(row.Categoria || 'Sin categoría')}` +
        (row.Proveedor ? ` · ${TS.html(row.Proveedor)}` : '') +
        `<br>Importe ${TS.money(row.Importe)} · pagado ${TS.money(row.ImportePagado)} · ` +
        `<strong>pendiente ${TS.money(pendiente)}</strong>`;

    document.getElementById('pgImporte').value = pendiente > 0 ? pendiente.toFixed(2) : '';
    document.getElementById('pgFecha').value = TS.hoy();
    document.getElementById('pgNota').value = '';
    document.getElementById('pgPendienteHint').textContent = pendiente > 0
        ? `Máximo ${TS.money(pendiente)}`
        : 'Sin saldo pendiente';

    const sinSaldo = pendiente <= 0.005;
    document.getElementById('pgBtnGuardar').disabled = sinSaldo;
    document.getElementById('pgBtnPagarTodo').disabled = sinSaldo;

    gsActualizarHintPago();
    await gsCargarPagos(row.Id);
    TS.modal('#mdlPagoGasto').show();
}

function gsActualizarHintPago() {
    const idCuenta = Number(document.getElementById('pgCuenta').value || 0);
    const cuenta = gsEstado.cuentas.find(c => c.Id === idCuenta);
    const hint = document.getElementById('pgSaldoHint');

    if (!cuenta) { hint.textContent = ''; return; }

    const importe = TS.leerDecimal(document.getElementById('pgImporte'));
    const resultante = Number(cuenta.Saldo ?? 0) - importe;
    const insuficiente = importe > 0 && resultante < 0 && !cuenta.PermiteNegativo;

    hint.innerHTML = `Disponible <strong>${TS.money(cuenta.Saldo)}</strong>` +
        (importe > 0 ? ` → queda ${TS.money(resultante)}` : '') +
        (insuficiente ? ' — no admite saldo negativo' : '');
    hint.style.color = insuficiente ? 'var(--ts-out)' : '';
}

async function gsCargarPagos(idGasto) {
    const cont = document.getElementById('pgListaPagos');
    cont.innerHTML = '<div class="ts-loading"><span class="ts-spinner"></span> Cargando pagos…</div>';

    try {
        const pagos = await TS.get('/Gastos/Pagos', { idGasto });

        if (!pagos?.length) {
            cont.innerHTML = TS.vacio('Sin pagos', 'Todavía no se registró ningún pago para este gasto.', 'money');
            return;
        }

        cont.innerHTML = pagos.map(p => `
            <div class="ts-pago${p.Anulado ? ' is-anulado' : ''}">
                <div class="ts-pago-body">
                    <div class="ts-pago-title">
                        ${TS.date(p.Fecha)} · ${TS.html(p.Cuenta || 'Cuenta')}
                        ${p.Anulado ? TS.badge('Anulado', 'muted', 'ban') : ''}
                    </div>
                    <div class="ts-pago-meta">
                        ${TS.html(p.MedioPago || 'Sin medio')}${p.NotaInterna ? ' · ' + TS.html(p.NotaInterna) : ''}
                        ${p.UsuarioRegistra ? ' · ' + TS.html(p.UsuarioRegistra) : ''}
                    </div>
                </div>
                <div class="ts-pago-amount">${TS.money(p.Importe)}</div>
                ${p.Anulado ? '' : `
                    <button type="button" class="ts-btn ts-btn--out ts-btn--sm" data-anular-pago="${p.Id}" title="Anular pago">
                        <i class="fa fa-ban"></i>
                    </button>`}
            </div>`).join('');

        cont.querySelectorAll('[data-anular-pago]').forEach(btn =>
            btn.addEventListener('click', () => gsAnularPago(Number(btn.dataset.anularPago))));
    } catch (err) {
        console.error(err);
        cont.innerHTML = TS.vacio('Error', err.message, 'exclamation-triangle');
    }
}

async function gsRegistrarPago() {
    const gasto = gsEstado.gasto;
    if (!gasto) return;

    const importe = TS.leerDecimal(document.getElementById('pgImporte'));
    const idCuenta = Number(document.getElementById('pgCuenta').value || 0);
    const pendiente = Number(gasto.Pendiente ?? 0);

    if (importe <= 0) return advertenciaModal('El importe debe ser mayor a cero.');
    if (importe > pendiente + 0.005)
        return advertenciaModal(`El importe supera lo pendiente (${TS.money(pendiente)}).`);
    if (!idCuenta) return advertenciaModal('Seleccioná la cuenta de la que sale el pago.');

    const r = await TS.ejecutar(TS.post('/Gastos/RegistrarPago', {
        IdGasto: gasto.Id,
        Fecha: document.getElementById('pgFecha').value || TS.hoy(),
        Importe: importe,
        IdCuenta: idCuenta,
        IdMedioPago: Number(document.getElementById('pgMedioPago').value || 0) || null,
        NotaInterna: document.getElementById('pgNota').value.trim() || null
    }));

    if (!r) return;

    TS.modal('#mdlPagoGasto').hide();
    await Promise.all([gsRefrescarSaldos(), gsCargar()]);
}

async function gsAnularPago(idPago) {
    const ok = await confirmarModal('¿Anular este pago? Se revierte el egreso en la caja y el gasto vuelve a quedar pendiente.');
    if (!ok) return;

    const r = await TS.ejecutar(TS.post(`/Gastos/AnularPago?${TS.qs({ id: idPago, motivo: 'Anulado desde la gestión de gastos' })}`));
    if (!r) return;

    await Promise.all([gsRefrescarSaldos(), gsCargar()]);

    // Reflejar el nuevo pendiente sin cerrar el modal.
    const actualizado = await TS.get('/Gastos/Obtener', { id: gsEstado.gasto.Id });
    gsEstado.gasto = { ...gsEstado.gasto, ...actualizado };
    await gsAbrirPagos(gsEstado.gasto);
}

async function gsRefrescarSaldos() {
    try {
        gsEstado.cuentas = await TS.get('/Cajas/Saldos', { soloActivas: true }) || [];
    } catch (err) {
        console.error(err);
    }
}

/* ═════════════════════════ Anulación / borrado ═════════════════════════ */

function gsAbrirAnular(row) {
    gsEstado.anular = row;

    document.getElementById('anlGastoTitulo').textContent = `Anular gasto #${row.Id}`;
    document.querySelector('#anlGastoDetalle span').innerHTML =
        `<strong>${TS.html(row.Concepto || '')}</strong> por ${TS.money(row.Importe)}` +
        (Number(row.ImportePagado ?? 0) > 0
            ? `. Tiene ${TS.money(row.ImportePagado)} pagados: se anulan esos pagos y se devuelve la plata a las cuentas.`
            : '.');

    document.getElementById('anlGastoMotivo').value = '';
    TS.modal('#mdlAnularGasto').show();
}

async function gsConfirmarAnulacion() {
    const row = gsEstado.anular;
    if (!row) return;

    const motivo = document.getElementById('anlGastoMotivo').value.trim();
    if (!motivo) return advertenciaModal('Indicá el motivo de la anulación.');

    const r = await TS.ejecutar(TS.post(`/Gastos/Anular?${TS.qs({ id: row.Id, motivo })}`));
    if (!r) return;

    TS.modal('#mdlAnularGasto').hide();
    gsEstado.anular = null;
    await gsCargar();
}

async function gsEliminar(row) {
    await eliminarConCascada({
        url: `/Gastos/Eliminar?id=${row.Id}`,
        headers: () => TS.headers(),
        confirmMsg: `¿Eliminar el gasto "${row.Concepto}" por ${TS.money(row.Importe)}? No tiene pagos registrados, así que se borra por completo.`,
        onSuccess: async j => {
            exitoModal(j.mensaje || 'Gasto eliminado.');
            await gsCargar();
        }
    });
}
