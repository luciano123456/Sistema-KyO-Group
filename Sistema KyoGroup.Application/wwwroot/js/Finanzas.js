/* ============================================================================
 * Finanzas.js — Hub único: Resumen / Cajas / Gastos / Control mensual
 * ========================================================================== */

const FG = {
    tab: 'resumen',
    titulos: {
        resumen: { t: 'Resumen', s: 'Saldos, flujo y vencimientos de todo el negocio.' },
        cajas: { t: 'Cajas', s: 'Movimientos, transferencias e ingresos y egresos.' },
        gastos: { t: 'Gastos', s: 'Servicios, alquileres e impuestos. Pagos y vencimientos.' },
        control: { t: 'Control mensual', s: 'El año entero de un vistazo: meses más caros, más livianos y el neto.' }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('fgHub')) return;
    wireFgTabs();
    const inicial = fgTabDesdeUbicacion() || 'resumen';
    activarTabFg(inicial, { silencioso: true });
});

function wireFgTabs() {
    document.querySelectorAll('[data-fg-tab]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            activarTabFg(btn.getAttribute('data-fg-tab'));
        });
    });
}

function fgTabDesdeUbicacion() {
    const q = new URLSearchParams(window.location.search).get('tab');
    return normalizarTabFg(q);
}

function normalizarTabFg(valor) {
    if (!valor) return null;
    const v = String(valor).trim().toLowerCase();
    if (v === 'tesoreria' || v === 'tablero') return 'resumen';
    if (v === 'caja' || v === 'efectivo' || v === 'bancos') return 'cajas';
    if (v === 'controlmensual' || v === 'mensual') return 'control';
    if (['resumen', 'cajas', 'gastos', 'control'].includes(v)) return v;
    return null;
}

async function activarTabFg(tab, opciones = {}) {
    const normalizado = normalizarTabFg(tab) || 'resumen';
    FG.tab = normalizado;

    document.querySelectorAll('[data-fg-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-fg-tab') === normalizado);
    });

    const secciones = {
        resumen: 'fgSectionResumen',
        cajas: 'fgSectionCajas',
        gastos: 'fgSectionGastos',
        control: 'fgSectionControl'
    };

    document.querySelectorAll('.fg-section').forEach(sec => {
        const mostrar = sec.id === secciones[normalizado];
        sec.hidden = !mostrar;
        sec.classList.toggle('active', mostrar);
    });

    const meta = FG.titulos[normalizado];
    const tit = document.getElementById('fgTitulo');
    const sub = document.getElementById('fgSub');
    if (tit) tit.textContent = meta.t;
    if (sub) sub.textContent = meta.s;

    const pillTs = document.getElementById('tsPillPeriodo');
    const pillCj = document.getElementById('cjPillSaldo');
    const pillGs = document.getElementById('gsPillPendiente');
    if (pillTs) pillTs.hidden = normalizado !== 'resumen';
    if (pillCj) pillCj.hidden = normalizado !== 'cajas';
    if (pillGs) pillGs.hidden = normalizado !== 'gastos';

    document.getElementById('fgAccionesResumen').hidden = normalizado !== 'resumen';
    document.getElementById('fgAccionesCajas').hidden = normalizado !== 'cajas';
    document.getElementById('fgAccionesGastos').hidden = normalizado !== 'gastos';

    if (!opciones.silencioso) actualizarUrlFg(normalizado, opciones);

    if (normalizado === 'resumen' && typeof window.initFinanzasResumen === 'function') {
        await window.initFinanzasResumen();
        return;
    }

    if (normalizado === 'cajas' && typeof window.initFinanzasCajas === 'function') {
        const idCuenta = Number(opciones.idCuenta || new URLSearchParams(location.search).get('idCuenta') || 0);
        await window.initFinanzasCajas({
            idCuenta: idCuenta || undefined,
            desde: opciones.desde,
            hasta: opciones.hasta
        });
        return;
    }

    if (normalizado === 'gastos' && typeof window.initFinanzasGastos === 'function') {
        await window.initFinanzasGastos({ desde: opciones.desde, hasta: opciones.hasta });
        return;
    }

    if (normalizado === 'control' && typeof window.initFinanzasControlMensual === 'function') {
        await window.initFinanzasControlMensual();
    }
}

function actualizarUrlFg(tab, extra = {}) {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        if (extra.idCuenta) url.searchParams.set('idCuenta', extra.idCuenta);
        else if (tab !== 'cajas') url.searchParams.delete('idCuenta');
        window.history.replaceState(null, '', url.toString());
    } catch { /* noop */ }
}

window.activarTabFg = activarTabFg;
window.fgIrAMes = function (anio, mes, destino) {
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const ultimo = new Date(anio, mes, 0).getDate();
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
    activarTabFg(destino === 'cajas' ? 'cajas' : 'gastos', { desde, hasta });
};
