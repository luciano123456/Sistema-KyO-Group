/* ============================================================================
 * Tesoreria.js — Tablero financiero consolidado
 * ========================================================================== */

$(document).ready(async function () {
    if (document.getElementById('fgHub')) return;
    if (!document.getElementById('tsDesde')) return;
    await initFinanzasResumen();
});

window.initFinanzasResumen = initFinanzasResumen;

async function initFinanzasResumen() {
    if (window.__tsResumenListo) {
        tsCargar();
        return;
    }
    window.__tsResumenListo = true;

    const r = TS.rango('mes');
    document.getElementById('tsDesde').value = r.desde;
    document.getElementById('tsHasta').value = r.hasta;

    document.querySelectorAll('#tsChipsRango .ts-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const clave = TS.chipActivo('#tsChipsRango', chip);
            const rg = TS.rango(clave);
            document.getElementById('tsDesde').value = rg.desde;
            document.getElementById('tsHasta').value = rg.hasta;
            tsCargar();
        });
    });

    ['tsDesde', 'tsHasta'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            document.querySelectorAll('#tsChipsRango .ts-chip').forEach(c => c.classList.remove('active'));
            tsCargar();
        });
    });

    document.getElementById('tsCuenta').addEventListener('change', tsCargar);
    document.getElementById('tsLocal').addEventListener('change', tsCargar);
    document.getElementById('tsBtnBuscar').addEventListener('click', tsCargar);

    await tsCargarCatalogos();
    tsCargar();
}

async function tsCargarCatalogos() {
    try {
        const cat = await TS.catalogos();
        TS.llenar('#tsCuenta', cat.Cuentas, { vacio: 'Todas las cuentas' });
        TS.llenar('#tsLocal', cat.Locales, { vacio: 'Todos los locales' });
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los catálogos de tesorería.');
    }
}

function tsFiltro() {
    return {
        fechaDesde: document.getElementById('tsDesde').value,
        fechaHasta: document.getElementById('tsHasta').value,
        idCuenta: document.getElementById('tsCuenta').value,
        idLocal: document.getElementById('tsLocal').value
    };
}

async function tsCargar() {
    TS.loading('tsLoading', true);
    const f = tsFiltro();

    try {
        const [resumen, vencimientos] = await Promise.all([
            TS.get('/Tesoreria/Resumen', f),
            TS.get('/Tesoreria/Vencimientos', { dias: 30, top: 12 })
        ]);

        tsPintarPeriodo(f);
        tsPintarKpis(resumen);
        tsPintarCuentas(resumen.Cuentas || []);
        tsPintarFlujo(resumen.Flujo || []);
        tsPintarRanking('tsPorCategoria', resumen.GastosPorCategoria || [], 'Sin gastos en el período');
        tsPintarRanking('tsPorTipo', resumen.EgresosPorTipo || [], 'Sin egresos en el período');
        tsPintarVencimientos(vencimientos || []);
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar el tablero: ' + err.message);
    } finally {
        TS.loading('tsLoading', false);
    }
}

function tsPintarPeriodo(f) {
    const desde = f.fechaDesde ? TS.date(f.fechaDesde) : '—';
    const hasta = f.fechaHasta ? TS.date(f.fechaHasta) : '—';
    const el = document.getElementById('tsPillPeriodo');
    el.innerHTML = `<i class="fa fa-calendar"></i><strong>${desde}</strong> al <strong>${hasta}</strong>`;
}

function tsPintarKpis(r) {
    TS.setMoney('tsKpiSaldoTotal', r.SaldoTotal);
    TS.setMoney('tsKpiEfectivo', r.SaldoEfectivo);
    TS.setMoney('tsKpiBancario', r.SaldoBancario);
    TS.setMoney('tsKpiIngresos', r.IngresosPeriodo);
    TS.setMoney('tsKpiEgresos', r.EgresosPeriodo);
    TS.setMoney('tsKpiGastos', r.GastosPeriodo);
    TS.setMoney('tsKpiVencidos', r.GastosVencidos);
    TS.setMoney('tsKpiDeuda', r.DeudaProveedores);

    const cuentas = (r.Cuentas || []).length;
    TS.setTexto('tsKpiSaldoHint', `${cuentas} ${cuentas === 1 ? 'cuenta activa' : 'cuentas activas'}`);
    TS.setTexto('tsKpiSesiones', 'saldo en efectivo');

    const neto = Number(r.NetoPeriodo ?? 0);
    const hintNeto = document.getElementById('tsKpiNeto');
    hintNeto.textContent = `${neto >= 0 ? 'Neto +' : 'Neto '}${TS.money(neto)}`;
    hintNeto.style.color = neto >= 0 ? 'var(--ts-in)' : 'var(--ts-out)';

    TS.setTexto('tsKpiPagos', `${TS.money(r.PagosPeriodo)} a proveedores`);
    TS.setTexto('tsKpiGastosPendientes', `${TS.money(r.GastosPendientes)} pendientes de pago`);

    const cant = r.CantidadGastosVencidos || 0;
    TS.setTexto('tsKpiVencidosCant', cant
        ? `${cant} ${cant === 1 ? 'comprobante' : 'comprobantes'} a regularizar`
        : 'todo al día');
}

function tsPintarCuentas(cuentas) {
    const cont = document.getElementById('tsCuentas');

    if (!cuentas.length) {
        cont.innerHTML = TS.vacio('Todavía no hay cuentas', 'Creá una cuenta para empezar a registrar movimientos.', 'briefcase');
        return;
    }

    cont.innerHTML = cuentas.map(c => {
        const negativo = Number(c.Saldo ?? 0) < 0 ? ' is-negativo' : '';

        return `
            <a class="ts-cuenta" href="/Finanzas?tab=cajas&idCuenta=${c.Id}">
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
            </a>`;
    }).join('');
}

function tsPintarFlujo(flujo) {
    const cont = document.getElementById('tsFlujo');

    if (!flujo.length) {
        cont.innerHTML = TS.vacio('Sin movimientos', 'No hubo actividad en el período elegido.', 'area-chart');
        return;
    }

    // Escala común para ingresos y egresos: así las barras se comparan de verdad.
    const max = Math.max(1, ...flujo.map(d => Math.max(Number(d.Ingresos ?? 0), Number(d.Egresos ?? 0))));
    const alto = v => Math.max(2, Math.round((Number(v ?? 0) / max) * 100));
    const mostrarLabel = flujo.length <= 31;

    cont.innerHTML = flujo.map(d => {
        const fecha = TS.date(d.Fecha);
        const tip = `${fecha}\nIngresos: ${TS.money(d.Ingresos)}\nEgresos: ${TS.money(d.Egresos)}\nNeto: ${TS.money(d.Neto)}`;
        const dia = new Date(d.Fecha).getDate();

        return `
            <div class="ts-flow-day" title="${TS.html(tip)}">
                <div class="ts-flow-bars">
                    <span class="ts-flow-bar ts-flow-bar--in" style="height:${alto(d.Ingresos)}%"></span>
                    <span class="ts-flow-bar ts-flow-bar--out" style="height:${alto(d.Egresos)}%"></span>
                </div>
                ${mostrarLabel ? `<span class="ts-flow-label">${dia}</span>` : ''}
            </div>`;
    }).join('');
}

function tsPintarRanking(idContenedor, items, textoVacio) {
    const cont = document.getElementById(idContenedor);

    if (!items.length) {
        cont.innerHTML = TS.vacio(textoVacio, null, 'bar-chart');
        return;
    }

    const max = Math.max(1, ...items.map(i => Math.abs(Number(i.Monto ?? 0))));

    cont.innerHTML = items.map(i => {
        const pct = Math.round((Math.abs(Number(i.Monto ?? 0)) / max) * 100);
        const icono = i.Icono ? `<i class="fa fa-${TS.icono(i.Icono)}"></i> ` : '';
        const cant = i.Cantidad ? ` <small>· ${i.Cantidad}</small>` : '';

        return `
            <div class="ts-rank-item">
                <div class="ts-rank-head">
                    <span class="ts-rank-name">${icono}${TS.html(i.Nombre)}${cant}</span>
                    <span class="ts-rank-value">${TS.money(i.Monto)}</span>
                </div>
                <div class="ts-rank-bar"><span style="width:${pct}%${i.Color ? `;background:${TS.html(i.Color)}` : ''}"></span></div>
            </div>`;
    }).join('');
}

function tsPintarVencimientos(gastos) {
    const cont = document.getElementById('tsVencimientos');

    if (!gastos.length) {
        cont.innerHTML = TS.vacio('Nada por vencer', 'No hay gastos con vencimiento en los próximos 30 días.', 'check-circle-o');
        return;
    }

    cont.innerHTML = gastos.map(g => {
        const f = new Date(g.FechaVencimiento);
        const mes = f.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
        const cuando = g.Vencido
            ? `vencido hace ${Math.abs(g.DiasParaVencer)} d`
            : g.DiasParaVencer === 0 ? 'vence hoy' : `en ${g.DiasParaVencer} d`;

        return `
            <a class="ts-venc${g.Vencido ? ' is-vencido' : ''}" href="/Gastos/NuevoModif/${g.Id}">
                <div class="ts-venc-when">
                    <strong>${f.getDate()}</strong>
                    <small>${TS.html(mes)}</small>
                </div>
                <div class="ts-venc-body">
                    <div class="ts-venc-title">${TS.html(g.Concepto)}</div>
                    <div class="ts-venc-meta">
                        ${TS.html(g.Proveedor || g.Categoria || 'Sin proveedor')} · ${TS.html(cuando)}
                    </div>
                </div>
                <div class="ts-venc-amount">${TS.money(g.Pendiente)}</div>
            </a>`;
    }).join('');
}
