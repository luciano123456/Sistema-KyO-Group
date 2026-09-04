/* ============================================================================
 * Cajas.js — Libro de caja: movimientos, saldos y transferencias
 * ========================================================================== */

const cjEstado = {
    catalogos: null,
    cuentas: [],
    idCuenta: null,
    gridMovs: { dt: null },
    gridTrf: { dt: null },
    anular: null       // { tipo: 'movimiento' | 'transferencia', id, detalle }
};

$(document).ready(async function () {
    if (document.getElementById('fgHub')) return;
    if (!document.getElementById('cjDesde')) return;
    await initFinanzasCajas();
});

window.initFinanzasCajas = initFinanzasCajas;

async function initFinanzasCajas(opts = {}) {
    if (cjEstado._listo) {
        if (opts.idCuenta > 0) cjEstado.idCuenta = opts.idCuenta;
        if (opts.desde) document.getElementById('cjDesde').value = opts.desde;
        if (opts.hasta) document.getElementById('cjHasta').value = opts.hasta;
        if (opts.desde || opts.hasta) {
            document.querySelectorAll('#cjChipsRango .ts-chip').forEach(c => c.classList.remove('active'));
        }
        await cjCargar();
        cjAjustarGrillas();
        return;
    }
    cjEstado._listo = true;

    const rg = TS.rango('mes');
    document.getElementById('cjDesde').value = opts.desde || rg.desde;
    document.getElementById('cjHasta').value = opts.hasta || rg.hasta;

    const idCuentaUrl = Number(opts.idCuenta || new URLSearchParams(location.search).get('idCuenta') || 0);
    if (idCuentaUrl > 0) cjEstado.idCuenta = idCuentaUrl;

    cjBindFiltros();
    cjBindModales();

    await cjCargarCatalogos();
    await cjCargar();
}

function cjAjustarGrillas() {
    try { cjEstado.gridMovs.dt?.columns.adjust(); } catch { /* noop */ }
    try { cjEstado.gridTrf.dt?.columns.adjust(); } catch { /* noop */ }
}

/* ═════════════════════════════ Catálogos ═════════════════════════════ */

async function cjCargarCatalogos() {
    try {
        const cat = await TS.catalogos();
        cjEstado.catalogos = cat;

        TS.llenar('#cjTipoMov', cat.TiposMovimiento, { vacio: 'Todos los tipos' });
        TS.llenar('#cjLocal', cat.Locales, { vacio: 'Todos los locales' });

        TS.llenar('#movCuenta', cat.Cuentas, { vacio: false });
        TS.llenar('#movMedioPago', cat.MediosPago, { vacio: 'Sin especificar' });
        TS.llenar('#movLocal', cat.Locales, { vacio: 'Sin local' });
        TS.llenar('#movUnidad', cat.UnidadesNegocio, { vacio: 'Sin unidad' });

        TS.llenar('#trfOrigen', cat.Cuentas, { vacio: false });
        TS.llenar('#trfDestino', cat.Cuentas, { vacio: false });
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los catálogos: ' + err.message);
    }
}

/* ═════════════════════════════ Filtros ═════════════════════════════ */

function cjBindFiltros() {
    document.querySelectorAll('#cjChipsRango .ts-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const rg = TS.rango(TS.chipActivo('#cjChipsRango', chip));
            document.getElementById('cjDesde').value = rg.desde;
            document.getElementById('cjHasta').value = rg.hasta;
            cjCargar();
        });
    });

    ['cjDesde', 'cjHasta'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            document.querySelectorAll('#cjChipsRango .ts-chip').forEach(c => c.classList.remove('active'));
            cjCargar();
        });
    });

    document.getElementById('cjTipoMov').addEventListener('change', cjCargar);
    document.getElementById('cjLocal').addEventListener('change', cjCargar);
    document.getElementById('cjIncluirAnulados').addEventListener('change', cjCargar);
    document.getElementById('cjBtnBuscar').addEventListener('click', cjCargar);
    document.getElementById('cjTexto').addEventListener('input', debounce(cjCargar, 400));
    document.getElementById('cjTexto').addEventListener('keydown', e => { if (e.key === 'Enter') cjCargar(); });

    document.getElementById('cjBtnTodasCuentas').addEventListener('click', () => {
        cjEstado.idCuenta = null;
        cjCargar();
    });
}

function cjFiltro() {
    return {
        idCuenta: cjEstado.idCuenta || '',
        idLocal: document.getElementById('cjLocal').value,
        tipoMov: document.getElementById('cjTipoMov').value,
        fechaDesde: document.getElementById('cjDesde').value,
        fechaHasta: document.getElementById('cjHasta').value,
        texto: document.getElementById('cjTexto').value.trim(),
        incluirAnulados: document.getElementById('cjIncluirAnulados').checked
    };
}

/* ═════════════════════════════ Carga ═════════════════════════════ */

async function cjCargar() {
    TS.loading('cjLoading', true);
    const f = cjFiltro();

    try {
        const [saldos, movs, resumen, transferencias] = await Promise.all([
            TS.get('/Cajas/Saldos', { soloActivas: true }),
            TS.get('/Cajas/Movimientos', f),
            TS.get('/Cajas/Resumen', f),
            TS.get('/Cajas/Transferencias', {
                fechaDesde: f.fechaDesde, fechaHasta: f.fechaHasta, idCuenta: f.idCuenta
            })
        ]);

        cjEstado.cuentas = saldos || [];
        cjPintarCuentas();
        cjPintarKpis(resumen, movs?.length || 0);
        cjPintarGridMovimientos(movs || [], resumen);
        cjPintarGridTransferencias(transferencias || []);
        cjPintarEncabezado();
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los movimientos: ' + err.message);
    } finally {
        TS.loading('cjLoading', false);
    }
}

function cjCuentaActual() {
    return cjEstado.cuentas.find(c => c.Id === cjEstado.idCuenta) || null;
}

function cjPintarEncabezado() {
    const cuenta = cjCuentaActual();
    const pill = document.getElementById('cjPillSaldo');

    if (cuenta) {
        pill.innerHTML = `<i class="fa fa-balance-scale"></i>${TS.html(cuenta.Nombre)} <strong>${TS.money(cuenta.Saldo)}</strong>`;
        document.getElementById('cjSubtituloGrilla').textContent = `${cuenta.Nombre}${cuenta.Local ? ' · ' + cuenta.Local : ''}`;
    } else {
        const total = cjEstado.cuentas.reduce((a, c) => a + Number(c.Saldo ?? 0), 0);
        pill.innerHTML = `<i class="fa fa-balance-scale"></i>Saldo total <strong>${TS.money(total)}</strong>`;
        document.getElementById('cjSubtituloGrilla').textContent = 'Todas las cuentas';
    }
}

function cjPintarCuentas() {
    const cont = document.getElementById('cjCuentas');

    if (!cjEstado.cuentas.length) {
        cont.innerHTML = TS.vacio('No hay cuentas activas', 'Creá una cuenta de fondos para operar.', 'briefcase');
        return;
    }

    cont.innerHTML = cjEstado.cuentas.map(c => {
        const activa = c.Id === cjEstado.idCuenta ? ' is-active' : '';
        const negativo = Number(c.Saldo ?? 0) < 0 ? ' is-negativo' : '';

        return `
            <div class="ts-cuenta${activa}" data-id="${c.Id}" role="button" tabindex="0">
                <div class="ts-cuenta-top">
                    <span class="ts-cuenta-icon"${c.Color ? ` style="background:${TS.html(c.Color)}"` : ''}>
                        <i class="fa fa-${TS.icono(c.Icono, c.EsEfectivo ? 'money' : 'bank')}"></i>
                    </span>
                    <div>
                        <div class="ts-cuenta-nombre">${TS.html(c.Nombre)}</div>
                        <div class="ts-cuenta-tipo">${TS.html(c.Tipo || '')}${c.Local ? ' · ' + TS.html(c.Local) : ''}</div>
                    </div>
                </div>
                <div class="ts-cuenta-saldo${negativo}">${TS.money(c.Saldo)}</div>
                <div class="ts-cuenta-meta">
                    <span class="ts-cuenta-flow">
                        <span class="is-in"><i class="fa fa-arrow-down"></i>${TS.moneyCorto(c.Ingresos)}</span>
                        <span class="is-out"><i class="fa fa-arrow-up"></i>${TS.moneyCorto(c.Egresos)}</span>
                    </span>
                </div>
            </div>`;
    }).join('');

    cont.querySelectorAll('.ts-cuenta').forEach(el => {
        const seleccionar = () => {
            const id = Number(el.dataset.id);
            cjEstado.idCuenta = cjEstado.idCuenta === id ? null : id;
            cjCargar();
        };
        el.addEventListener('click', seleccionar);
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seleccionar(); } });
    });
}

function cjPintarKpis(r, cantidad) {
    const unaCuenta = !!cjEstado.idCuenta;

    // El saldo arrastrado sólo tiene sentido leyendo una cuenta sola.
    TS.setTexto('cjKpiSaldoAnterior', unaCuenta ? TS.money(r.SaldoAnterior) : '—');
    TS.setMoney('cjKpiIngresos', r.Ingresos);
    TS.setMoney('cjKpiEgresos', r.Egresos);
    TS.setTexto('cjKpiSaldoFinal', unaCuenta ? TS.money(r.SaldoFinal) : TS.money(r.Neto));

    TS.setTexto('cjKpiCantidad', `${r.Cantidad ?? cantidad} movimientos`);

    const neto = Number(r.Neto ?? 0);
    const hint = document.getElementById('cjKpiNeto');
    hint.textContent = `Neto ${neto >= 0 ? '+' : ''}${TS.money(neto)}`;
    hint.style.color = neto >= 0 ? 'var(--ts-in)' : 'var(--ts-out)';

    TS.setTexto('cjKpiAlcance', unaCuenta ? 'al cierre del período' : 'neto del período (multicuenta)');
}

/* ═════════════════════════ Grilla de movimientos ═════════════════════════ */

/** Agrega el saldo acumulado partiendo del saldo anterior de la cuenta. */
function cjConSaldoAcumulado(movs, resumen) {
    const rows = movs.slice().sort((a, b) => {
        const da = new Date(a.Fecha).getTime() - new Date(b.Fecha).getTime();
        return da !== 0 ? da : a.Id - b.Id;
    });

    if (!cjEstado.idCuenta) return rows.map(m => ({ ...m, Saldo: null }));

    let saldo = Number(resumen?.SaldoAnterior ?? 0);
    return rows.map(m => {
        if (!m.Anulado) saldo += Number(m.Ingreso ?? 0) - Number(m.Egreso ?? 0);
        return { ...m, Saldo: saldo };
    });
}

function cjPintarGridMovimientos(movs, resumen) {
    const rows = cjConSaldoAcumulado(movs, resumen);

    const columnas = [
        columnaGridId(),
        { data: 'Fecha', title: 'Fecha', render: (d, t) => t === 'display' ? TS.date(d) : d },
        { data: 'Cuenta', title: 'Cuenta', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        {
            data: 'TipoMovNombre', title: 'Tipo',
            render: (d, t, row) => t === 'display' ? TS.badgeTipoMov(row.TipoMov, d) : d
        },
        {
            data: 'Concepto', title: 'Concepto',
            render: (d, t, row) => {
                if (t !== 'display') return d;
                const origen = row.IdMov && !row.EsManual
                    ? `<span class="ts-concepto-origen">Origen #${row.IdMov}</span>`
                    : (row.Anulado && row.MotivoAnula ? `<span class="ts-concepto-origen">Anulado: ${TS.html(row.MotivoAnula)}</span>` : '');
                return `${TS.html(d || '')}${origen}`;
            }
        },
        { data: 'MedioPago', title: 'Medio', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        {
            data: 'Ingreso', title: 'Ingreso', className: 'text-end',
            render: (d, t) => t === 'display' ? TS.importe(d, 'in') : d
        },
        {
            data: 'Egreso', title: 'Egreso', className: 'text-end',
            render: (d, t) => t === 'display' ? TS.importe(d, 'out') : d
        },
        {
            data: 'Saldo', title: 'Saldo', className: 'text-end',
            render: (d, t) => t !== 'display' ? (d ?? 0) : (d === null ? '<span class="ts-amt ts-amt--muted">—</span>' : TS.saldo(d))
        },
        { data: 'UsuarioRegistra', title: 'Usuario', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        {
            data: null, title: 'Acciones', orderable: false, searchable: false, className: 'text-center',
            render: (d, t, row) => t === 'display' ? cjAccionesMovimiento(row) : ''
        }
    ];

    TS.grilla(cjEstado.gridMovs, '#grd_CajaMovimientos', columnas, rows, {
        order: [[1, 'desc'], [0, 'desc']],
        skipFiltros: [10],
        createdRow: (tr, data) => { if (data.Anulado) tr.classList.add('ts-row-anulada'); }
    });

    $('#grd_CajaMovimientos tbody')
        .off('click', '[data-accion]')
        .on('click', '[data-accion]', function () {
            const id = Number(this.dataset.id);
            const row = rows.find(r => r.Id === id);
            if (!row) return;
            if (this.dataset.accion === 'editar') cjAbrirMovimiento(row);
            if (this.dataset.accion === 'anular') cjAbrirAnular('movimiento', row);
        });
}

function cjAccionesMovimiento(row) {
    if (row.Anulado) return TS.badge('Anulado', 'muted', 'ban');

    if (!row.EsManual) {
        return `<span class="ts-badge ts-badge--sky" title="Generado por otro módulo: se revierte desde su origen">
                    <i class="fa fa-link"></i>Automático
                </span>`;
    }

    return `
        <button type="button" class="ts-btn ts-btn--ghost ts-btn--sm" data-accion="editar" data-id="${row.Id}" title="Editar">
            <i class="fa fa-pencil"></i>
        </button>
        <button type="button" class="ts-btn ts-btn--out ts-btn--sm" data-accion="anular" data-id="${row.Id}" title="Anular">
            <i class="fa fa-ban"></i>
        </button>`;
}

/* ════════════════════════ Grilla de transferencias ════════════════════════ */

function cjPintarGridTransferencias(lista) {
    const columnas = [
        columnaGridId(),
        { data: 'Fecha', title: 'Fecha', render: (d, t) => t === 'display' ? TS.date(d) : d },
        { data: 'CuentaOrigen', title: 'Origen', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        { data: 'CuentaDestino', title: 'Destino', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        { data: 'Concepto', title: 'Concepto', render: (d, t) => t === 'display' ? TS.html(d || '') : d },
        {
            data: 'ImporteOrigen', title: 'Importe', className: 'text-end',
            render: (d, t) => t === 'display' ? TS.saldo(d) : d
        },
        {
            data: 'Comision', title: 'Comisión', className: 'text-end',
            render: (d, t) => t === 'display' ? TS.importe(d, 'out') : d
        },
        { data: 'UsuarioRegistra', title: 'Usuario', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        {
            data: null, title: 'Acciones', orderable: false, searchable: false, className: 'text-center',
            render: (d, t, row) => t === 'display'
                ? `<button type="button" class="ts-btn ts-btn--out ts-btn--sm" data-accion="anular-trf" data-id="${row.Id}" title="Anular transferencia">
                       <i class="fa fa-ban"></i>
                   </button>`
                : ''
        }
    ];

    TS.grilla(cjEstado.gridTrf, '#grd_CajaTransferencias', columnas, lista, {
        order: [[1, 'desc'], [0, 'desc']],
        pageLength: 10,
        skipFiltros: [8]
    });

    $('#grd_CajaTransferencias tbody')
        .off('click', '[data-accion="anular-trf"]')
        .on('click', '[data-accion="anular-trf"]', function () {
            const row = lista.find(r => r.Id === Number(this.dataset.id));
            if (row) cjAbrirAnular('transferencia', row);
        });
}

/* ══════════════════════ Modal: movimiento manual ══════════════════════ */

function cjBindModales() {
    document.getElementById('cjBtnIngreso').addEventListener('click', () => cjAbrirMovimiento(null, 'INGRESO'));
    document.getElementById('cjBtnEgreso').addEventListener('click', () => cjAbrirMovimiento(null, 'EGRESO'));
    document.getElementById('cjBtnTransferir').addEventListener('click', cjAbrirTransferencia);

    document.querySelectorAll('#movSwitchTipo button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#movSwitchTipo button').forEach(b => b.classList.toggle('active', b === btn));
            cjActualizarHintSaldo();
        });
    });

    document.getElementById('movCuenta').addEventListener('change', cjActualizarHintSaldo);
    document.getElementById('movImporte').addEventListener('input', cjActualizarHintSaldo);
    document.getElementById('movBtnGuardar').addEventListener('click', busyHandler(cjGuardarMovimiento));

    ['trfOrigen', 'trfDestino', 'trfImporte'].forEach(id => {
        document.getElementById(id).addEventListener('input', cjActualizarResumenTransferencia);
        document.getElementById(id).addEventListener('change', cjActualizarResumenTransferencia);
    });
    document.getElementById('trfImporte').addEventListener('input', function () {
        // El importe acreditado sigue al enviado salvo que el usuario lo toque a mano.
        const destino = document.getElementById('trfImporteDestino');
        if (!destino.dataset.editado) destino.value = this.value;
    });
    document.getElementById('trfImporteDestino').addEventListener('input', function () {
        this.dataset.editado = '1';
        cjActualizarResumenTransferencia();
    });
    document.getElementById('trfBtnGuardar').addEventListener('click', busyHandler(cjGuardarTransferencia));

    document.getElementById('anlBtnConfirmar').addEventListener('click', busyHandler(cjConfirmarAnulacion));
}

function cjTipoMovimientoElegido() {
    return document.querySelector('#movSwitchTipo button.active')?.dataset.tipo || 'INGRESO';
}

function cjAbrirMovimiento(row, tipoForzado) {
    const esEdicion = !!row;

    document.getElementById('mdlMovimientoTitulo').textContent = esEdicion
        ? `Editar movimiento #${row.Id}`
        : (tipoForzado === 'EGRESO' ? 'Nuevo egreso' : 'Nuevo ingreso');

    const tipo = esEdicion ? (Number(row.Ingreso) > 0 ? 'INGRESO' : 'EGRESO') : (tipoForzado || 'INGRESO');
    document.querySelectorAll('#movSwitchTipo button').forEach(b => b.classList.toggle('active', b.dataset.tipo === tipo));

    // En edición no se cambia la cuenta: el asiento queda atado a la cuenta original.
    const selCuenta = document.getElementById('movCuenta');
    selCuenta.disabled = esEdicion;

    document.getElementById('movId').value = esEdicion ? row.Id : 0;
    selCuenta.value = esEdicion ? row.IdCuenta : (cjEstado.idCuenta || selCuenta.options[0]?.value || '');
    document.getElementById('movFecha').value = esEdicion ? TS.isoDate(row.Fecha) : TS.hoy();
    document.getElementById('movImporte').value = esEdicion ? (Number(row.Ingreso) > 0 ? row.Ingreso : row.Egreso) : '';
    document.getElementById('movConcepto').value = esEdicion ? (row.Concepto || '') : '';
    document.getElementById('movMedioPago').value = esEdicion ? (row.IdMedioPago || '') : '';
    document.getElementById('movLocal').value = esEdicion ? (row.IdLocal || '') : '';
    document.getElementById('movUnidad').value = '';
    document.getElementById('movNota').value = esEdicion ? (row.NotaInterna || '') : '';

    document.getElementById('movSwitchTipo').style.display = esEdicion ? 'none' : 'flex';
    document.getElementById('movLocal').disabled = esEdicion;
    document.getElementById('movUnidad').disabled = esEdicion;

    cjActualizarHintSaldo();
    TS.modal('#mdlMovimiento').show();
}

function cjActualizarHintSaldo() {
    const idCuenta = Number(document.getElementById('movCuenta').value || 0);
    const cuenta = cjEstado.cuentas.find(c => c.Id === idCuenta);
    const hint = document.getElementById('movSaldoHint');

    if (!cuenta) { hint.textContent = ''; return; }

    const importe = TS.leerDecimal(document.getElementById('movImporte'));
    const esEgreso = cjTipoMovimientoElegido() === 'EGRESO';
    const resultante = Number(cuenta.Saldo ?? 0) + (esEgreso ? -importe : importe);

    hint.innerHTML = `Disponible <strong>${TS.money(cuenta.Saldo)}</strong>` +
        (importe > 0 ? ` → queda <strong>${TS.money(resultante)}</strong>` : '');

    const insuficiente = esEgreso && importe > 0 && resultante < 0 && !cuenta.PermiteNegativo;
    hint.style.color = insuficiente ? 'var(--ts-out)' : '';
    if (insuficiente) hint.innerHTML += ' — la cuenta no admite saldo negativo';
}

async function cjGuardarMovimiento() {
    const id = Number(document.getElementById('movId').value || 0);
    const idCuenta = Number(document.getElementById('movCuenta').value || 0);
    const importe = TS.leerDecimal(document.getElementById('movImporte'));
    const concepto = document.getElementById('movConcepto').value.trim();
    const esEgreso = cjTipoMovimientoElegido() === 'EGRESO';

    if (!idCuenta) return advertenciaModal('Seleccioná una cuenta.');
    if (importe <= 0) return advertenciaModal('El importe debe ser mayor a cero.');
    if (!concepto) return advertenciaModal('Indicá un concepto.');

    const model = {
        Id: id,
        IdCuenta: idCuenta,
        Fecha: document.getElementById('movFecha').value || TS.hoy(),
        Concepto: concepto,
        Ingreso: esEgreso ? 0 : importe,
        Egreso: esEgreso ? importe : 0,
        IdMedioPago: Number(document.getElementById('movMedioPago').value || 0) || null,
        IdLocal: Number(document.getElementById('movLocal').value || 0) || null,
        IdUnidadNegocio: Number(document.getElementById('movUnidad').value || 0) || null,
        NotaInterna: document.getElementById('movNota').value.trim() || null
    };

    const r = await TS.ejecutar(
        id > 0 ? TS.put('/Cajas/ActualizarMovimiento', model) : TS.post('/Cajas/RegistrarMovimiento', model));

    if (!r) return;
    TS.modal('#mdlMovimiento').hide();
    await cjCargar();
}

/* ══════════════════════ Modal: transferencia ══════════════════════ */

function cjAbrirTransferencia() {
    const cuentas = cjEstado.catalogos?.Cuentas || [];
    if (cuentas.length < 2) return advertenciaModal('Necesitás al menos dos cuentas activas para transferir.');

    const origen = document.getElementById('trfOrigen');
    const destino = document.getElementById('trfDestino');

    origen.value = cjEstado.idCuenta || cuentas[0].Id;
    destino.value = cuentas.find(c => String(c.Id) !== String(origen.value))?.Id ?? '';

    document.getElementById('trfFecha').value = TS.hoy();
    document.getElementById('trfImporte').value = '';
    const impDestino = document.getElementById('trfImporteDestino');
    impDestino.value = '';
    delete impDestino.dataset.editado;
    document.getElementById('trfConcepto').value = '';
    document.getElementById('trfNota').value = '';

    cjActualizarResumenTransferencia();
    TS.modal('#mdlTransferencia').show();
}

function cjActualizarResumenTransferencia() {
    const idOrigen = Number(document.getElementById('trfOrigen').value || 0);
    const idDestino = Number(document.getElementById('trfDestino').value || 0);
    const origen = cjEstado.cuentas.find(c => c.Id === idOrigen);
    const destino = cjEstado.cuentas.find(c => c.Id === idDestino);
    const enviado = TS.leerDecimal(document.getElementById('trfImporte'));
    const acreditado = TS.leerDecimal(document.getElementById('trfImporteDestino')) || enviado;

    document.getElementById('trfSaldoOrigen').innerHTML = origen
        ? `Disponible <strong>${TS.money(origen.Saldo)}</strong>` : '';
    document.getElementById('trfSaldoDestino').innerHTML = destino
        ? `Saldo actual <strong>${TS.money(destino.Saldo)}</strong>` : '';

    const box = document.getElementById('trfResumen');
    const texto = box.querySelector('span');

    if (!origen || !destino || enviado <= 0) {
        box.className = 'ts-note ts-note--sky';
        texto.textContent = 'Elegí las cuentas y el importe para ver el impacto.';
        return;
    }

    if (idOrigen === idDestino) {
        box.className = 'ts-note ts-note--rose';
        texto.textContent = 'La cuenta de origen y la de destino tienen que ser distintas.';
        return;
    }

    const comision = enviado - acreditado;
    const restaOrigen = Number(origen.Saldo ?? 0) - enviado;
    const insuficiente = restaOrigen < 0 && !origen.PermiteNegativo;

    box.className = `ts-note ${insuficiente ? 'ts-note--rose' : 'ts-note--sage'}`;
    texto.innerHTML =
        `<strong>${TS.html(origen.Nombre)}</strong> queda en ${TS.money(restaOrigen)} · ` +
        `<strong>${TS.html(destino.Nombre)}</strong> pasa a ${TS.money(Number(destino.Saldo ?? 0) + acreditado)}` +
        (comision > 0 ? ` · comisión ${TS.money(comision)}` : '') +
        (insuficiente ? ' — la cuenta de origen no admite saldo negativo' : '');
}

async function cjGuardarTransferencia() {
    const idOrigen = Number(document.getElementById('trfOrigen').value || 0);
    const idDestino = Number(document.getElementById('trfDestino').value || 0);
    const enviado = TS.leerDecimal(document.getElementById('trfImporte'));
    const acreditado = TS.leerDecimal(document.getElementById('trfImporteDestino')) || enviado;
    const concepto = document.getElementById('trfConcepto').value.trim();

    if (!idOrigen || !idDestino) return advertenciaModal('Seleccioná la cuenta de origen y la de destino.');
    if (idOrigen === idDestino) return advertenciaModal('Las cuentas deben ser distintas.');
    if (enviado <= 0) return advertenciaModal('El importe debe ser mayor a cero.');
    if (acreditado > enviado) return advertenciaModal('El importe acreditado no puede superar el enviado.');
    if (!concepto) return advertenciaModal('Indicá un concepto.');

    const r = await TS.ejecutar(TS.post('/Cajas/Transferir', {
        IdCuentaOrigen: idOrigen,
        IdCuentaDestino: idDestino,
        Fecha: document.getElementById('trfFecha').value || TS.hoy(),
        Concepto: concepto,
        ImporteOrigen: enviado,
        ImporteDestino: acreditado,
        NotaInterna: document.getElementById('trfNota').value.trim() || null
    }));

    if (!r) return;
    TS.modal('#mdlTransferencia').hide();
    await cjCargar();
}

/* ══════════════════════════ Modal: anulación ══════════════════════════ */

function cjAbrirAnular(tipo, row) {
    cjEstado.anular = { tipo, id: row.Id };

    const esTrf = tipo === 'transferencia';
    document.getElementById('anlTitulo').textContent = esTrf ? 'Anular transferencia' : 'Anular movimiento';

    const detalle = document.querySelector('#anlDetalle span');
    detalle.innerHTML = esTrf
        ? `Transferencia #${row.Id} · ${TS.html(row.CuentaOrigen)} → ${TS.html(row.CuentaDestino)} por <strong>${TS.money(row.ImporteOrigen)}</strong>. Se revierten los dos asientos.`
        : `Movimiento #${row.Id} · ${TS.html(row.Concepto || '')} por <strong>${TS.money(Number(row.Ingreso) > 0 ? row.Ingreso : row.Egreso)}</strong> en ${TS.html(row.Cuenta || '')}.`;

    document.getElementById('anlMotivo').value = '';
    TS.modal('#mdlAnular').show();
}

async function cjConfirmarAnulacion() {
    const ctx = cjEstado.anular;
    if (!ctx) return;

    const motivo = document.getElementById('anlMotivo').value.trim();
    if (!motivo) return advertenciaModal('Contá el motivo de la anulación: queda en la auditoría.');

    const url = ctx.tipo === 'transferencia'
        ? `/Cajas/AnularTransferencia?${TS.qs({ id: ctx.id, motivo })}`
        : `/Cajas/AnularMovimiento?${TS.qs({ id: ctx.id, motivo })}`;

    const r = await TS.ejecutar(TS.del(url));
    if (!r) return;

    TS.modal('#mdlAnular').hide();
    cjEstado.anular = null;
    await cjCargar();
}
