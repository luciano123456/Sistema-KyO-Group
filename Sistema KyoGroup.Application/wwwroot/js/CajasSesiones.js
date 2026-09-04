/* ============================================================================
 * CajasSesiones.js — Apertura, cierre y arqueo de turnos de caja
 * ========================================================================== */

const seEstado = {
    cuentas: [],
    estado: '',
    grid: { dt: null },
    cerrando: null       // detalle de la sesión que se está cerrando
};

$(document).ready(async function () {
    const rg = TS.rango('mes');
    document.getElementById('seDesde').value = rg.desde;
    document.getElementById('seHasta').value = rg.hasta;

    document.querySelectorAll('#seChipsEstado .ts-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            seEstado.estado = TS.chipActivo('#seChipsEstado', chip);
            seCargar();
        });
    });

    ['seCuenta', 'seDesde', 'seHasta'].forEach(id =>
        document.getElementById(id).addEventListener('change', seCargar));
    document.getElementById('seBtnBuscar').addEventListener('click', seCargar);

    document.getElementById('seBtnAbrir').addEventListener('click', () => seAbrirModalApertura(null));
    document.getElementById('abrCuenta').addEventListener('change', seActualizarHintApertura);
    document.getElementById('abrBtnConfirmar').addEventListener('click', busyHandler(seConfirmarApertura));

    document.getElementById('cerDeclarado').addEventListener('input', seActualizarDiferencia);
    document.getElementById('cerBtnConfirmar').addEventListener('click', busyHandler(seConfirmarCierre));

    await seCargarCatalogos();
    await seCargar();
});

async function seCargarCatalogos() {
    try {
        const cat = await TS.catalogos();
        TS.llenar('#seCuenta', cat.Cuentas, { vacio: 'Todas las cajas' });
        TS.llenar('#abrCuenta', cat.Cuentas.filter(c => c.RequiereArqueo || c.EsEfectivo), { vacio: false });
        TS.llenar('#abrLocal', cat.Locales, { vacio: 'Sin local' });
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los catálogos: ' + err.message);
    }
}

/* ═════════════════════════════ Carga ═════════════════════════════ */

async function seCargar() {
    TS.loading('seLoading', true);

    try {
        const [saldos, sesiones] = await Promise.all([
            TS.get('/Cajas/Saldos', { soloActivas: true }),
            TS.get('/Cajas/ListaSesiones', {
                idCuenta: document.getElementById('seCuenta').value,
                idEstado: seEstado.estado,
                fechaDesde: document.getElementById('seDesde').value,
                fechaHasta: document.getElementById('seHasta').value
            })
        ]);

        seEstado.cuentas = saldos || [];
        sePintarCuentas();
        sePintarGrid(sesiones || []);
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los turnos: ' + err.message);
    } finally {
        TS.loading('seLoading', false);
    }
}

function sePintarCuentas() {
    const cont = document.getElementById('seCuentas');
    const cajas = seEstado.cuentas.filter(c => c.RequiereArqueo || c.EsEfectivo);

    const abiertos = seEstado.cuentas.filter(c => c.IdSesionAbierta).length;
    document.getElementById('seKpiAbiertos').innerHTML =
        `<i class="fa fa-unlock"></i><strong>${abiertos}</strong> ${abiertos === 1 ? 'turno abierto' : 'turnos abiertos'}`;

    if (!cajas.length) {
        cont.innerHTML = TS.vacio('Ninguna cuenta requiere arqueo',
            'Marcá "Requiere arqueo" en las cuentas de efectivo para controlarlas por turno.', 'money');
        return;
    }

    cont.innerHTML = cajas.map(c => {
        const abierta = !!c.IdSesionAbierta;
        const negativo = Number(c.Saldo ?? 0) < 0 ? ' is-negativo' : '';

        return `
            <div class="ts-cuenta${abierta ? ' is-active' : ''}">
                <div class="ts-cuenta-top">
                    <span class="ts-cuenta-icon"${c.Color ? ` style="background:${TS.html(c.Color)}"` : ''}>
                        <i class="fa fa-${TS.icono(c.Icono, 'money')}"></i>
                    </span>
                    <div>
                        <div class="ts-cuenta-nombre">${TS.html(c.Nombre)}</div>
                        <div class="ts-cuenta-tipo">${TS.html(c.Tipo || '')}${c.Local ? ' · ' + TS.html(c.Local) : ''}</div>
                    </div>
                </div>
                <div class="ts-cuenta-saldo${negativo}">${TS.money(c.Saldo)}</div>
                <div class="ts-cuenta-meta">
                    ${abierta ? TS.badge('Turno abierto', 'sage', 'unlock') : TS.badge('Turno cerrado', 'muted', 'lock')}
                </div>
                <div class="ts-cuenta-acciones">
                    ${abierta
                        ? `<button type="button" class="ts-btn ts-btn--primary ts-btn--sm" data-accion="cerrar" data-sesion="${c.IdSesionAbierta}">
                               <i class="fa fa-lock"></i>Cerrar turno
                           </button>
                           <a class="ts-btn ts-btn--ghost ts-btn--sm" href="/Cajas?idCuenta=${c.Id}">
                               <i class="fa fa-list"></i>Movimientos
                           </a>`
                        : `<button type="button" class="ts-btn ts-btn--in ts-btn--sm" data-accion="abrir" data-cuenta="${c.Id}">
                               <i class="fa fa-play"></i>Abrir turno
                           </button>`}
                </div>
            </div>`;
    }).join('');

    cont.querySelectorAll('[data-accion="abrir"]').forEach(btn =>
        btn.addEventListener('click', () => seAbrirModalApertura(Number(btn.dataset.cuenta))));
    cont.querySelectorAll('[data-accion="cerrar"]').forEach(btn =>
        btn.addEventListener('click', () => seAbrirModalCierre(Number(btn.dataset.sesion))));
}

function sePintarGrid(sesiones) {
    const columnas = [
        columnaGridId(),
        { data: 'Cuenta', title: 'Caja', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        {
            data: 'Estado', title: 'Estado',
            render: (d, t, row) => t === 'display'
                ? TS.badge(d, row.IdEstado === 1 ? 'sage' : 'muted', row.IdEstado === 1 ? 'unlock' : 'lock')
                : d
        },
        { data: 'FechaApertura', title: 'Apertura', render: (d, t) => t === 'display' ? TS.dateTime(d) : d },
        { data: 'FechaCierre', title: 'Cierre', render: (d, t) => t === 'display' ? (d ? TS.dateTime(d) : '—') : d },
        { data: 'SaldoInicial', title: 'Inicial', className: 'text-end', render: (d, t) => t === 'display' ? TS.saldo(d) : d },
        {
            data: 'SaldoTeorico', title: 'Teórico', className: 'text-end',
            render: (d, t) => t !== 'display' ? (d ?? 0) : (d == null ? '<span class="ts-amt ts-amt--muted">—</span>' : TS.saldo(d))
        },
        {
            data: 'SaldoDeclarado', title: 'Contado', className: 'text-end',
            render: (d, t) => t !== 'display' ? (d ?? 0) : (d == null ? '<span class="ts-amt ts-amt--muted">—</span>' : TS.saldo(d))
        },
        {
            data: 'Diferencia', title: 'Diferencia', className: 'text-end',
            render: (d, t) => {
                if (t !== 'display') return d ?? 0;
                if (d == null) return '<span class="ts-amt ts-amt--muted">—</span>';
                const n = Number(d);
                if (n === 0) return TS.badge('Sin diferencia', 'sage', 'check');
                return `<span class="ts-amt ${n > 0 ? 'ts-amt--in' : 'ts-amt--out'}">${n > 0 ? 'Sobra ' : 'Falta '}${TS.money(Math.abs(n))}</span>`;
            }
        },
        { data: 'UsuarioAbre', title: 'Abrió', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        { data: 'UsuarioCierra', title: 'Cerró', render: (d, t) => t === 'display' ? TS.html(d || '—') : d },
        {
            data: null, title: 'Acciones', orderable: false, searchable: false, className: 'text-center',
            render: (d, t, row) => {
                if (t !== 'display') return '';
                const ver = `<button type="button" class="ts-btn ts-btn--ghost ts-btn--sm" data-ver="${row.Id}" title="Ver detalle">
                                 <i class="fa fa-eye"></i>
                             </button>`;
                const cerrar = row.IdEstado === 1
                    ? `<button type="button" class="ts-btn ts-btn--primary ts-btn--sm" data-cerrar="${row.Id}" title="Cerrar turno">
                           <i class="fa fa-lock"></i>
                       </button>`
                    : '';
                return ver + cerrar;
            }
        }
    ];

    TS.grilla(seEstado.grid, '#grd_CajaSesiones', columnas, sesiones, {
        order: [[3, 'desc']],
        skipFiltros: [11]
    });

    $('#grd_CajaSesiones tbody')
        .off('click', '[data-ver],[data-cerrar]')
        .on('click', '[data-ver]', function () { seVerDetalle(Number(this.dataset.ver)); })
        .on('click', '[data-cerrar]', function () { seAbrirModalCierre(Number(this.dataset.cerrar)); });
}

/* ═════════════════════════ Apertura ═════════════════════════ */

function seAbrirModalApertura(idCuenta) {
    const select = document.getElementById('abrCuenta');
    if (!select.options.length) {
        return advertenciaModal('No hay cajas configuradas con arqueo. Marcá "Requiere arqueo" en la cuenta.');
    }

    if (idCuenta) select.value = idCuenta;
    document.getElementById('abrSaldoInicial').value = '';
    document.getElementById('abrNota').value = '';
    seActualizarHintApertura();
    TS.modal('#mdlAbrirTurno').show();
}

function seActualizarHintApertura() {
    const id = Number(document.getElementById('abrCuenta').value || 0);
    const cuenta = seEstado.cuentas.find(c => c.Id === id);
    const hint = document.getElementById('abrSaldoHint');

    if (!cuenta) { hint.textContent = ''; return; }

    if (cuenta.IdSesionAbierta) {
        hint.innerHTML = `Esta caja ya tiene un turno abierto (#${cuenta.IdSesionAbierta}). Cerralo antes de abrir otro.`;
        hint.style.color = 'var(--ts-out)';
    } else {
        hint.innerHTML = `Saldo actual en el sistema: <strong>${TS.money(cuenta.Saldo)}</strong>`;
        hint.style.color = '';
    }

    if (cuenta.IdLocal) document.getElementById('abrLocal').value = cuenta.IdLocal;
}

async function seConfirmarApertura() {
    const idCuenta = Number(document.getElementById('abrCuenta').value || 0);
    if (!idCuenta) return advertenciaModal('Seleccioná una caja.');

    const saldoInicial = TS.leerDecimal(document.getElementById('abrSaldoInicial'));
    if (saldoInicial < 0) return advertenciaModal('El saldo inicial no puede ser negativo.');

    const r = await TS.ejecutar(TS.post('/Cajas/AbrirSesion', {
        IdCuenta: idCuenta,
        IdLocal: Number(document.getElementById('abrLocal').value || 0) || null,
        SaldoInicial: saldoInicial,
        NotaApertura: document.getElementById('abrNota').value.trim() || null
    }));

    if (!r) return;
    TS.modal('#mdlAbrirTurno').hide();
    await seCargar();
}

/* ═════════════════════════ Cierre ═════════════════════════ */

async function seAbrirModalCierre(idSesion) {
    try {
        const d = await TS.get('/Cajas/Sesion', { id: idSesion });
        seEstado.cerrando = d;

        document.getElementById('cerTitulo').textContent = `Cerrar turno #${d.Id} · ${d.Cuenta || ''}`;
        TS.setMoney('cerInicial', d.SaldoInicial);
        TS.setMoney('cerIngresos', d.Ingresos);
        TS.setMoney('cerEgresos', d.Egresos);
        TS.setMoney('cerTeorico', d.SaldoTeorico);
        TS.setTexto('cerMovimientos', `${d.Movimientos || 0} movimientos en el turno`);

        document.getElementById('cerDeclarado').value = '';
        document.getElementById('cerNota').value = '';
        document.getElementById('cerGenerarAjuste').checked = true;
        seActualizarDiferencia();

        TS.modal('#mdlCerrarTurno').show();
    } catch (err) {
        console.error(err);
        errorModal('No se pudo abrir el arqueo: ' + err.message);
    }
}

function seActualizarDiferencia() {
    const d = seEstado.cerrando;
    const box = document.getElementById('cerDiferencia');
    const texto = box.querySelector('span');
    const input = document.getElementById('cerDeclarado');

    if (!d || input.value === '') {
        box.className = 'ts-note';
        texto.textContent = 'Ingresá el saldo contado para ver la diferencia.';
        return;
    }

    const declarado = TS.leerDecimal(input);
    const diferencia = declarado - Number(d.SaldoTeorico ?? 0);

    if (diferencia === 0) {
        box.className = 'ts-note ts-note--sage';
        texto.innerHTML = '<strong>Arqueo exacto.</strong> Lo contado coincide con el sistema.';
    } else if (diferencia > 0) {
        box.className = 'ts-note';
        texto.innerHTML = `<strong>Sobrante de ${TS.money(diferencia)}.</strong> Se registrará un ingreso de ajuste si dejás la opción activada.`;
    } else {
        box.className = 'ts-note ts-note--rose';
        texto.innerHTML = `<strong>Faltante de ${TS.money(Math.abs(diferencia))}.</strong> Se registrará un egreso de ajuste si dejás la opción activada.`;
    }
}

async function seConfirmarCierre() {
    const d = seEstado.cerrando;
    if (!d) return;

    const input = document.getElementById('cerDeclarado');
    if (input.value === '') return advertenciaModal('Ingresá el saldo contado.');

    const declarado = TS.leerDecimal(input);
    if (declarado < 0) return advertenciaModal('El saldo contado no puede ser negativo.');

    const diferencia = declarado - Number(d.SaldoTeorico ?? 0);
    if (diferencia !== 0) {
        const ok = await confirmarModal(
            `El arqueo tiene una diferencia de ${TS.money(Math.abs(diferencia))} ` +
            `(${diferencia > 0 ? 'sobrante' : 'faltante'}). ¿Confirmás el cierre?`);
        if (!ok) return;
    }

    const r = await TS.ejecutar(TS.post('/Cajas/CerrarSesion', {
        IdSesion: d.Id,
        SaldoDeclarado: declarado,
        Nota: document.getElementById('cerNota').value.trim() || null,
        GenerarAjuste: document.getElementById('cerGenerarAjuste').checked
    }));

    if (!r) return;
    TS.modal('#mdlCerrarTurno').hide();
    seEstado.cerrando = null;
    await seCargar();
}

/* ═════════════════════════ Detalle ═════════════════════════ */

async function seVerDetalle(idSesion) {
    try {
        const d = await TS.get('/Cajas/Sesion', { id: idSesion });

        document.getElementById('detTitulo').textContent = `Turno #${d.Id} · ${d.Cuenta || ''}`;
        document.getElementById('detSub').textContent =
            `${d.Estado} · abierto el ${TS.dateTime(d.FechaApertura)}` +
            (d.FechaCierre ? ` · cerrado el ${TS.dateTime(d.FechaCierre)}` : '');
        document.getElementById('detLinkMovimientos').href = `/Cajas?idCuenta=${d.IdCuenta}`;

        const dif = d.Diferencia;
        const filas = [
            ['Saldo inicial', TS.money(d.SaldoInicial)],
            ['Ingresos del turno', TS.money(d.Ingresos)],
            ['Egresos del turno', TS.money(d.Egresos)],
            ['Movimientos', String(d.Movimientos || 0)],
            ['Saldo teórico', TS.money(d.SaldoTeorico)],
            ['Saldo contado', d.SaldoDeclarado == null ? '—' : TS.money(d.SaldoDeclarado)],
            ['Diferencia', dif == null ? '—' : (Number(dif) === 0 ? 'Sin diferencia' : `${Number(dif) > 0 ? 'Sobrante' : 'Faltante'} ${TS.money(Math.abs(Number(dif)))}`)],
            ['Abrió', d.UsuarioAbre || '—'],
            ['Cerró', d.UsuarioCierra || '—']
        ];

        document.getElementById('detCuerpo').innerHTML = `
            <div class="ts-pagos">
                ${filas.map(([k, v]) => `
                    <div class="ts-pago">
                        <div class="ts-pago-body"><div class="ts-pago-title">${TS.html(k)}</div></div>
                        <div class="ts-pago-amount" style="color:var(--oa-ink)">${TS.html(v)}</div>
                    </div>`).join('')}
            </div>
            ${d.NotaApertura ? `<div class="ts-note mt-3"><i class="fa fa-sign-in"></i><span><strong>Apertura:</strong> ${TS.html(d.NotaApertura)}</span></div>` : ''}
            ${d.NotaCierre ? `<div class="ts-note mt-2"><i class="fa fa-sign-out"></i><span><strong>Cierre:</strong> ${TS.html(d.NotaCierre)}</span></div>` : ''}`;

        TS.modal('#mdlDetalleTurno').show();
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar el detalle: ' + err.message);
    }
}
