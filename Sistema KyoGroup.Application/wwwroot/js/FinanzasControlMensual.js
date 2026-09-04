/* ============================================================================
 * FinanzasControlMensual.js — Mapa y tabla año × mes
 * ========================================================================== */

const FG_CM_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const FG_CM = {
    listo: false,
    anios: [],
    meses: [],
    fuentes: { efectivo: true, bancos: true, gastos: true },
    data: null,
    sel: null
};

window.initFinanzasControlMensual = async function () {
    if (!FG_CM.listo) {
        initFiltrosFgCm();
        wireFgCm();
        FG_CM.listo = true;
    }
    await cargarControlMensualFg();
};

function wireFgCm() {
    document.getElementById('fgCmBtnRefresh')?.addEventListener('click', () => cargarControlMensualFg());

    document.getElementById('fgCmAniosChips')?.addEventListener('click', e => {
        const btn = e.target.closest('.fg-cm-chip');
        if (!btn) return;
        toggleFiltroFgCm('anio', parseInt(btn.dataset.val, 10));
    });
    document.getElementById('fgCmMesesChips')?.addEventListener('click', e => {
        const btn = e.target.closest('.fg-cm-chip');
        if (!btn) return;
        toggleFiltroFgCm('mes', parseInt(btn.dataset.val, 10));
    });

    document.querySelectorAll('.fg-cm-preset[data-meses]').forEach(btn => {
        btn.addEventListener('click', () => aplicarPresetMesesFgCm(btn.dataset.meses));
    });
    document.getElementById('fgCmAniosRecientes')?.addEventListener('click', aplicarAniosRecientesFgCm);

    document.querySelectorAll('.fg-cm-fuente').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = btn.dataset.fuente;
            FG_CM.fuentes[f] = !FG_CM.fuentes[f];
            if (!FG_CM.fuentes.efectivo && !FG_CM.fuentes.bancos && !FG_CM.fuentes.gastos) {
                FG_CM.fuentes[f] = true;
            }
            btn.classList.toggle('is-active', !!FG_CM.fuentes[f]);
            cargarControlMensualFg();
        });
    });
}

function initFiltrosFgCm() {
    const actual = new Date().getFullYear();
    FG_CM.anios = [actual];
    FG_CM.meses = [];

    const $anios = document.getElementById('fgCmAniosChips');
    $anios.innerHTML = '';
    for (let y = actual; y >= actual - 8; y--) {
        $anios.insertAdjacentHTML('beforeend', `<button type="button" class="fg-cm-chip" data-val="${y}">${y}</button>`);
    }

    const $meses = document.getElementById('fgCmMesesChips');
    $meses.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
        $meses.insertAdjacentHTML('beforeend', `<button type="button" class="fg-cm-chip" data-val="${m}">${FG_CM_MESES[m - 1]}</button>`);
    }

    renderEstadoFiltrosFgCm(false);
}

function toggleFiltroFgCm(tipo, val) {
    if (!val || Number.isNaN(val)) return;
    const arr = tipo === 'anio' ? FG_CM.anios : FG_CM.meses;
    const idx = arr.indexOf(val);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(val);
    if (tipo === 'anio') FG_CM.anios.sort((a, b) => b - a);
    else FG_CM.meses.sort((a, b) => a - b);
    if (FG_CM.anios.length === 0) FG_CM.anios = [new Date().getFullYear()];
    renderEstadoFiltrosFgCm(true);
}

function aplicarPresetMesesFgCm(valor) {
    if (valor === 'all') FG_CM.meses = [];
    else {
        FG_CM.meses = String(valor || '')
            .split(',')
            .map(x => parseInt(x, 10))
            .filter(x => x >= 1 && x <= 12);
    }
    renderEstadoFiltrosFgCm(true);
}

function aplicarAniosRecientesFgCm() {
    const actual = new Date().getFullYear();
    FG_CM.anios = [actual, actual - 1, actual - 2];
    renderEstadoFiltrosFgCm(true);
}

function renderEstadoFiltrosFgCm(refresh) {
    document.querySelectorAll('#fgCmAniosChips .fg-cm-chip').forEach(el => {
        el.classList.toggle('is-active', FG_CM.anios.includes(parseInt(el.dataset.val, 10)));
    });
    document.querySelectorAll('#fgCmMesesChips .fg-cm-chip').forEach(el => {
        el.classList.toggle('is-active', FG_CM.meses.includes(parseInt(el.dataset.val, 10)));
    });

    document.querySelectorAll('.fg-cm-preset[data-meses]').forEach(el => el.classList.remove('is-active'));
    if (FG_CM.meses.length === 0) {
        document.querySelector('.fg-cm-preset[data-meses="all"]')?.classList.add('is-active');
    } else {
        ['1,2,3', '4,5,6', '7,8,9', '10,11,12'].forEach(key => {
            const vals = key.split(',').map(Number);
            const ok = vals.length === FG_CM.meses.length && vals.every(v => FG_CM.meses.includes(v));
            if (ok) document.querySelector(`.fg-cm-preset[data-meses="${key}"]`)?.classList.add('is-active');
        });
    }

    const actual = new Date().getFullYear();
    const recientes = [actual, actual - 1, actual - 2];
    document.getElementById('fgCmAniosRecientes')?.classList.toggle(
        'is-active',
        FG_CM.anios.length === 3 && recientes.every(y => FG_CM.anios.includes(y))
    );

    const nAnios = FG_CM.anios.length;
    const nMeses = FG_CM.meses.length || 12;
    document.getElementById('fgCmCount').textContent = String(nAnios * nMeses);
    document.getElementById('fgCmFiltroResumen').textContent =
        `${nAnios} año${nAnios === 1 ? '' : 's'} · ${FG_CM.meses.length ? nMeses + ' meses' : 'Todos los meses'}`;

    if (refresh) cargarControlMensualFg();
}

async function cargarControlMensualFg() {
    const body = document.getElementById('fgCmBody');
    body.innerHTML = `<tr><td colspan="7"><div class="ts-empty"><i class="fa fa-refresh fa-spin"></i><strong>Cargando…</strong></div></td></tr>`;

    try {
        const data = await TS.post('/Finanzas/ControlMensual', {
            Anios: FG_CM.anios,
            Meses: FG_CM.meses,
            IncluirEfectivo: !!FG_CM.fuentes.efectivo,
            IncluirBancos: !!FG_CM.fuentes.bancos,
            IncluirGastos: !!FG_CM.fuentes.gastos
        });
        FG_CM.data = data;
        renderControlMensualFg(data);
    } catch (e) {
        console.error(e);
        body.innerHTML = `<tr><td colspan="7"><div class="ts-empty"><i class="fa fa-warning"></i><strong>No se pudo cargar el control mensual</strong></div></td></tr>`;
    }
}

function renderControlMensualFg(data) {
    const payload = data || {};
    TS.setMoney('fgCmKpiIngresos', payload.TotalIngresos);
    TS.setMoney('fgCmKpiEgresos', payload.TotalEgresos);
    TS.setMoney('fgCmKpiGastos', payload.TotalGastos);
    const netoEl = document.getElementById('fgCmKpiNeto');
    if (netoEl) {
        netoEl.textContent = TS.money(payload.NetoPeriodo);
        netoEl.style.color = Number(payload.NetoPeriodo || 0) >= 0 ? 'var(--ts-in)' : 'var(--ts-out)';
    }

    renderCalloutsFgCm(payload);
    renderHeatFgCm(payload.Filas || [], payload.MaxGastos || 0);
    renderTablaFgCm(payload.Filas || [], payload.MaxGastos || 0);
}

function etiquetaFila(f) {
    if (!f) return '—';
    return `${f.MesNombre || FG_CM_MESES[(f.Mes || 1) - 1]} ${f.Anio}`;
}

function renderCalloutsFgCm(p) {
    const cont = document.getElementById('fgCmCallouts');
    const items = [
        { cls: 'max', lab: 'Mes que más se gastó', fila: p.MesMasGasto, campo: 'Gastos' },
        { cls: 'min', lab: 'Mes más liviano', fila: p.MesMenosGasto, campo: 'Gastos' },
        { cls: 'best', lab: 'Mejor neto', fila: p.MejorNeto, campo: 'Neto' },
        { cls: 'worst', lab: 'Peor neto', fila: p.PeorNeto, campo: 'Neto' }
    ];
    cont.innerHTML = items.map(it => `
        <button type="button" class="fg-cm-callout fg-cm-callout--${it.cls}" data-anio="${it.fila?.Anio || ''}" data-mes="${it.fila?.Mes || ''}">
            <small>${it.lab}</small>
            <strong>${etiquetaFila(it.fila)}</strong>
            <span>${it.fila ? TS.money(it.fila[it.campo]) : '—'}</span>
        </button>`).join('');

    cont.querySelectorAll('.fg-cm-callout').forEach(btn => {
        btn.addEventListener('click', () => {
            const anio = Number(btn.dataset.anio);
            const mes = Number(btn.dataset.mes);
            if (anio && mes) seleccionarMesFgCm(anio, mes);
        });
    });
}

function renderHeatFgCm(filas, maxGastos) {
    const mapa = {};
    filas.forEach(f => { mapa[`${f.Anio}-${f.Mes}`] = f; });
    const anios = [...new Set(filas.map(f => f.Anio))].sort((a, b) => b - a);
    const max = Math.max(1, Number(maxGastos || 0));

    const head = `<div class="fg-cm-heat-row"><div class="fg-cm-heat-lab"></div>${FG_CM_MESES.map(m => `<div class="fg-cm-heat-lab" style="justify-content:center">${m}</div>`).join('')}</div>`;
    const rows = anios.map(anio => {
        const cells = [];
        for (let m = 1; m <= 12; m++) {
            const f = mapa[`${anio}-${m}`];
            const g = Number(f?.Gastos || 0);
            const pct = Math.round((g / max) * 100);
            const sel = FG_CM.sel && FG_CM.sel.anio === anio && FG_CM.sel.mes === m ? ' is-sel' : '';
            const hot = pct >= 70 ? ' is-hot' : '';
            const bg = `rgba(201,162,74,${0.08 + (pct / 100) * 0.55})`;
            cells.push(`<button type="button" class="fg-cm-heat-cell${sel}${hot}" data-anio="${anio}" data-mes="${m}" style="background:${bg}">
                <strong>${f ? TS.moneyCorto(g) : '—'}</strong>
                <small>${f ? TS.moneyCorto(f.Neto) : ''}</small>
            </button>`);
        }
        return `<div class="fg-cm-heat-row"><div class="fg-cm-heat-lab">${anio}</div>${cells.join('')}</div>`;
    }).join('');

    const heat = document.getElementById('fgCmHeat');
    heat.innerHTML = head + (rows || '<div class="ts-empty"><strong>Sin períodos</strong></div>');
    heat.querySelectorAll('.fg-cm-heat-cell').forEach(btn => {
        btn.addEventListener('click', () => seleccionarMesFgCm(Number(btn.dataset.anio), Number(btn.dataset.mes)));
        btn.addEventListener('dblclick', () => window.fgIrAMes(Number(btn.dataset.anio), Number(btn.dataset.mes), 'gastos'));
    });
}

function renderTablaFgCm(filas, maxGastos) {
    const max = Math.max(1, Number(maxGastos || 0));
    const body = document.getElementById('fgCmBody');
    if (!filas.length) {
        body.innerHTML = `<tr><td colspan="7"><div class="ts-empty"><i class="fa fa-inbox"></i><strong>No hay movimientos en el recorte</strong></div></td></tr>`;
        return;
    }

    body.innerHTML = filas.map(f => {
        const pct = Math.round((Number(f.Gastos || 0) / max) * 100);
        const netoCls = Number(f.Neto || 0) >= 0 ? 'fg-cm-amt-pos' : 'fg-cm-amt-neg';
        return `<tr data-anio="${f.Anio}" data-mes="${f.Mes}">
            <td><strong>${TS.html(f.MesNombre)} ${f.Anio}</strong></td>
            <td>${TS.money(f.IngEfectivo)}</td>
            <td>${TS.money(f.EgrEfectivo)}</td>
            <td>${TS.money(f.IngBanco)}</td>
            <td>${TS.money(f.EgrBanco)}</td>
            <td>${TS.money(f.Gastos)}<span class="fg-cm-bar"><span style="width:${pct}%"></span></span></td>
            <td class="${netoCls}">${TS.money(f.Neto)}</td>
        </tr>`;
    }).join('');

    body.querySelectorAll('tr[data-anio]').forEach(tr => {
        tr.addEventListener('click', () => seleccionarMesFgCm(Number(tr.dataset.anio), Number(tr.dataset.mes)));
        tr.addEventListener('dblclick', () => window.fgIrAMes(Number(tr.dataset.anio), Number(tr.dataset.mes), 'gastos'));
    });
}

async function seleccionarMesFgCm(anio, mes) {
    FG_CM.sel = { anio, mes };
    document.getElementById('fgCmMesSelHint').textContent = `${FG_CM_MESES[mes - 1]} ${anio} · doble click para abrir Gastos`;
    renderHeatFgCm(FG_CM.data?.Filas || [], FG_CM.data?.MaxGastos || 0);

    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const ultimo = new Date(anio, mes, 0).getDate();
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;

    try {
        const r = await TS.get('/Gastos/Resumen', { fechaDesde: desde, fechaHasta: hasta });
        const items = r.PorCategoria || [];
        const cont = document.getElementById('fgCmCategorias');
        if (!items.length) {
            cont.innerHTML = TS.vacio('Sin gastos este mes', null, 'tags');
            return;
        }
        const max = Math.max(1, ...items.map(i => Math.abs(Number(i.Monto ?? 0))));
        cont.innerHTML = items.map(i => {
            const pct = Math.round((Math.abs(Number(i.Monto ?? 0)) / max) * 100);
            return `<div class="ts-rank-item">
                <div class="ts-rank-head">
                    <span class="ts-rank-name">${TS.html(i.Nombre)}</span>
                    <span class="ts-rank-value">${TS.money(i.Monto)}</span>
                </div>
                <div class="ts-rank-bar"><span style="width:${pct}%"></span></div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error(e);
    }
}
