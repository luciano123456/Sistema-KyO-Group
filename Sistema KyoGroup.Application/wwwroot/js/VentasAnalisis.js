(function () {
    'use strict';

    const charts = {};
    let periodoActivo = 'mes';
    let matrizCache = {};
    let matrizMesActivo = null;

    const MESES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

    const GOLD = ['#c9a24a', '#b5d99c', '#e0c36a', '#8bc34a', '#d4b56a', '#9aaf5a', '#f0d9a0', '#6f9e4e'];
    const CHART_FONT = { family: 'system-ui, -apple-system, "Segoe UI", sans-serif' };

    function qs(id) { return document.getElementById(id); }
    function authHeaders() {
        return { Authorization: 'Bearer ' + (window.token || localStorage.getItem('JwtToken') || '') };
    }
    function money(n) {
        return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
    }
    function num(n) { return Number(n || 0).toLocaleString('es-AR'); }
    function fmtDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function setText(id, val) { const el = qs(id); if (el) el.textContent = val ?? '—'; }
    function showLoading(on) { qs('axLoading')?.classList.toggle('d-none', !on); }
    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function aplicarPeriodo(key) {
        periodoActivo = key;
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        let desde = new Date(hoy);
        let label = 'Personalizado';
        switch (key) {
            case 'mes': desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1); label = 'Este mes'; break;
            case '3m': desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1); label = 'Últimos 3 meses'; break;
            case '6m': desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1); label = 'Últimos 6 meses'; break;
            case 'ytd': desde = new Date(hoy.getFullYear(), 0, 1); label = 'Este año'; break;
            case 'custom': return;
        }
        qs('fltDesde').value = fmtDate(desde);
        qs('fltHasta').value = fmtDate(hoy);
        setText('axPeriodoLabel', label);
        if (window.kyoVentasFiltros) window.kyoVentasFiltros.persistFromDom();
    }

    function filtrosQuery() {
        const p = new URLSearchParams();
        if (qs('fltDesde').value) p.set('fechaDesde', qs('fltDesde').value);
        if (qs('fltHasta').value) p.set('fechaHasta', qs('fltHasta').value);
        if (qs('fltLocal').value) p.set('idLocal', qs('fltLocal').value);
        return p.toString();
    }

    function destroyChart(id) {
        if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    }

    const defaultScales = {
        y: {
            beginAtZero: true,
            ticks: { color: '#7a7088', font: CHART_FONT },
            grid: { color: 'rgba(201,162,74,0.12)' },
            border: { display: false }
        },
        x: {
            ticks: { color: '#7a7088', font: CHART_FONT, maxRotation: 45 },
            grid: { display: false },
            border: { display: false }
        }
    };

    function makeBar(canvasId, labels, values) {
        destroyChart(canvasId);
        const ctx = qs(canvasId);
        if (!ctx) return;
        charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: GOLD,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: defaultScales
            }
        });
    }

    function makeLine(canvasId, labels, values) {
        destroyChart(canvasId);
        const ctx = qs(canvasId);
        if (!ctx) return;
        charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: values,
                    borderColor: '#c9a24a',
                    backgroundColor: 'rgba(201,162,74,0.18)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#8bc34a',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: defaultScales
            }
        });
    }

    async function loadLocales() {
        const sel = qs('fltLocal');
        if (!sel) return;
        try {
            const r = await fetch('/Locales/Lista', { headers: authHeaders() });
            if (!r.ok) return;
            const data = await r.json();
            (data || []).forEach(l => {
                const o = document.createElement('option');
                o.value = l.Id; o.textContent = l.Nombre;
                sel.appendChild(o);
            });
        } catch { /* ignore */ }
    }

    let matrizTimer = null;
    let matrizSeq = 0;
    let matrizAnioActivo = null;

    function anioMatriz() {
        const n = Number(qs('fltAnio')?.value);
        return Number.isFinite(n) && n > 1900 ? n : new Date().getFullYear();
    }

    function programarMatriz(delayMs) {
        clearTimeout(matrizTimer);
        matrizTimer = setTimeout(() => { cargarMatriz(); }, delayMs ?? 280);
    }

    function cambiarAnio(delta) {
        const actual = anioMatriz();
        qs('fltAnio').value = String(actual + delta);
        clearTimeout(matrizTimer);
        cargarMatriz();
    }

    function setupMesChips() {
        const wrap = qs('fltMeses');
        if (!wrap) return;
        wrap.innerHTML = '';
        const hoy = new Date();
        MESES.forEach((nombre, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'vt-ax-mes-chip';
            btn.dataset.mes = String(i + 1);
            btn.textContent = nombre.slice(0, 3);
            btn.title = nombre;
            if (i === hoy.getMonth()) btn.classList.add('active');
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                programarMatriz();
            });
            wrap.appendChild(btn);
        });
    }

    function mesesSeleccionados() {
        return Array.from(document.querySelectorAll('#fltMeses .vt-ax-mes-chip.active'))
            .map(b => Number(b.dataset.mes))
            .filter(n => n >= 1 && n <= 12)
            .sort((a, b) => a - b);
    }

    function setMeses(list, autoLoad) {
        const set = new Set(list);
        document.querySelectorAll('#fltMeses .vt-ax-mes-chip').forEach(b => {
            b.classList.toggle('active', set.has(Number(b.dataset.mes)));
        });
        if (autoLoad !== false) programarMatriz(120);
    }

    function heatClass(val, max) {
        const v = Number(val || 0);
        if (!v || !max) return '';
        const r = v / max;
        if (r >= 0.75) return 'vt-ax-cell vt-ax-cell--heat-4';
        if (r >= 0.5) return 'vt-ax-cell vt-ax-cell--heat-3';
        if (r >= 0.25) return 'vt-ax-cell vt-ax-cell--heat-2';
        return 'vt-ax-cell vt-ax-cell--heat-1';
    }

    function renderMatrizTable(d) {
        const dias = d.Dias || [];
        const filas = d.Filas || [];
        let max = 0;
        filas.forEach(f => (f.CantidadesPorDia || []).forEach(c => { if (c > max) max = c; }));

        const head = `<thead><tr>
            <th>SKU</th><th>Producto</th>
            ${dias.map(x => {
                const dt = new Date(x);
                return `<th>${String(dt.getDate()).padStart(2, '0')}</th>`;
            }).join('')}
            <th>Prom</th>
            ${DOW.map(x => `<th>${x}</th>`).join('')}
        </tr></thead>`;

        const body = filas.length
            ? `<tbody>${filas.map(f => `<tr>
                <td>${esc(f.Codigo)}</td>
                <td title="${esc(f.Rubro || '')}">${esc(f.Descripcion)}</td>
                ${(f.CantidadesPorDia || []).map(c =>
                    `<td class="${heatClass(c, max)}">${c ? num(c) : ''}</td>`
                ).join('')}
                <td class="vt-ax-prom">${num(f.Promedio)}</td>
                ${(f.PromedioPorDiaSemana || []).map(c =>
                    `<td class="vt-ax-dow">${c ? num(c) : ''}</td>`
                ).join('')}
            </tr>`).join('')}</tbody>`
            : `<tbody><tr><td colspan="40"><div class="vt-ax-empty"><i class="fa fa-inbox"></i><p>Sin datos del mes</p></div></td></tr></tbody>`;

        return `<div class="vt-ax-matriz-wrap"><table class="table table-sm vt-ax-matriz">${head}${body}</table></div>`;
    }

    function showMatrizMes(mes) {
        matrizMesActivo = mes;
        document.querySelectorAll('#matrizTabs .vt-ax-matriz-tab').forEach(t => {
            t.classList.toggle('active', Number(t.dataset.mes) === mes);
        });
        document.querySelectorAll('#matrizPanels .vt-ax-matriz-panel').forEach(p => {
            p.classList.toggle('active', Number(p.dataset.mes) === mes);
        });
        const d = matrizCache[`${matrizAnioActivo}-${mes}`] || matrizCache[mes];
        const meta = qs('matrizMeta');
        if (meta && d) {
            const n = (d.Filas || []).length;
            const anio = d.Anio || matrizAnioActivo || anioMatriz();
            meta.textContent = `${MESES[mes - 1]} ${anio} · ${n} producto${n === 1 ? '' : 's'}`;
        }
    }

    async function cargarMatriz() {
        const anio = anioMatriz();
        qs('fltAnio').value = String(anio);
        const meses = mesesSeleccionados();
        const tabs = qs('matrizTabs');
        const panels = qs('matrizPanels');
        const meta = qs('matrizMeta');
        const seq = ++matrizSeq;

        if (!meses.length) {
            matrizCache = {};
            matrizAnioActivo = anio;
            tabs.classList.add('d-none');
            tabs.innerHTML = '';
            panels.innerHTML = `<div class="vt-ax-empty" id="matrizEmpty">
                <i class="fa fa-calendar-o"></i>
                <p>Seleccioná uno o más meses para ver la matriz</p>
            </div>`;
            if (meta) meta.textContent = '';
            return;
        }

        // Limpiar datos del año anterior para no mezclar 2025 con 2026
        matrizCache = {};
        matrizAnioActivo = anio;
        tabs.innerHTML = '';
        tabs.classList.add('d-none');
        panels.innerHTML = `<div class="vt-ax-empty" id="matrizEmpty">
            <div class="vt-ax-loading-spinner" style="margin:0 auto 0.75rem"></div>
            <p>Cargando matriz ${anio}…</p>
        </div>`;
        if (meta) meta.textContent = `Año ${anio} · cargando…`;

        try {
            const idLocal = qs('fltLocal').value || 0;
            const results = await Promise.all(meses.map(async mes => {
                const p = new URLSearchParams({
                    anio: String(anio),
                    mes: String(mes),
                    idLocal: String(idLocal),
                    _: String(Date.now())
                });
                const r = await fetch('/Ventas/MatrizMensual?' + p.toString(), {
                    headers: authHeaders(),
                    cache: 'no-store'
                });
                if (!r.ok) throw new Error('matriz ' + mes);
                const d = await r.json();
                return { mes, data: d };
            }));

            if (seq !== matrizSeq) return;

            matrizCache = {};
            tabs.innerHTML = '';
            panels.innerHTML = '';
            tabs.classList.toggle('d-none', results.length <= 1);

            results.forEach(({ mes, data }) => {
                const dataAnio = Number(data.Anio || anio);
                matrizCache[`${dataAnio}-${mes}`] = data;
                matrizCache[mes] = data;
                const count = (data.Filas || []).length;

                if (results.length > 1) {
                    const tab = document.createElement('button');
                    tab.type = 'button';
                    tab.className = 'vt-ax-matriz-tab';
                    tab.dataset.mes = String(mes);
                    tab.innerHTML = `${MESES[mes - 1]} ${dataAnio} <span class="vt-ax-tab-count">${count}</span>`;
                    tab.addEventListener('click', () => showMatrizMes(mes));
                    tabs.appendChild(tab);
                }

                const panel = document.createElement('div');
                panel.className = 'vt-ax-matriz-panel';
                panel.dataset.mes = String(mes);
                panel.innerHTML = renderMatrizTable(data);
                panels.appendChild(panel);
            });

            const prefer = matrizMesActivo && (matrizCache[`${anio}-${matrizMesActivo}`] || matrizCache[matrizMesActivo])
                ? matrizMesActivo
                : results[0].mes;
            showMatrizMes(prefer);
        } catch {
            if (seq !== matrizSeq) return;
            panels.innerHTML = `<div class="vt-ax-empty" id="matrizEmpty">
                <i class="fa fa-exclamation-triangle"></i>
                <p>No se pudo cargar la matriz de ${anio}. Probá de nuevo.</p>
            </div>`;
            if (meta) meta.textContent = '';
        }
    }

    async function cargar() {
        showLoading(true);
        try {
            const q = filtrosQuery();
            const [resumen, serie, locales, rubros, top] = await Promise.all([
                fetch('/Ventas/Resumen?' + q, { headers: authHeaders() }).then(r => r.json()),
                fetch('/Ventas/SerieDiaria?' + q, { headers: authHeaders() }).then(r => r.json()),
                fetch('/Ventas/ComparativaLocales?' + q, { headers: authHeaders() }).then(r => r.json()),
                fetch('/Ventas/PorRubro?' + q, { headers: authHeaders() }).then(r => r.json()),
                fetch('/Ventas/TopProductos?' + q, { headers: authHeaders() }).then(r => r.json())
            ]);

            setText('kpiVenta', money(resumen.TotalVenta));
            setText('kpiCosto', money(resumen.TotalCosto));
            setText('kpiMargen', (resumen.MargenPct ?? 0) + '%');
            setText('kpiDias', num(resumen.DiasCargados));
            setText('kpiTicket', money(resumen.TicketPromedio));
            setText('kpiCubiertos', num(resumen.Cubiertos));
            setText('kpiMatch', (resumen.PorcentajeMatch ?? 0) + '%');
            setText('kpiLocales', num(resumen.LocalesConDatos));

            makeBar('chartLocales', (locales || []).map(x => x.LocalNombre || x.Label), (locales || []).map(x => x.TotalVenta));
            makeBar('chartRubrosMini', (rubros || []).slice(0, 8).map(x => x.Rubro), (rubros || []).slice(0, 8).map(x => x.TotalVenta));
            makeBar('chartRubros', (rubros || []).map(x => x.Rubro), (rubros || []).map(x => x.TotalVenta));

            const byDate = {};
            (serie || []).forEach(p => {
                const k = p.Label || (p.Fecha ? new Date(p.Fecha).toLocaleDateString('es-AR') : '');
                byDate[k] = (byDate[k] || 0) + Number(p.TotalVenta || 0);
            });
            makeLine('chartSerie', Object.keys(byDate), Object.values(byDate));

            const emptyTop = '<tr><td colspan="6" class="text-muted text-center py-4">Sin datos para mostrar</td></tr>';
            const tb = qs('tblTop').querySelector('tbody');
            tb.innerHTML = (top || []).map((t, i) => {
                const rankClass = i === 0 ? 'vt-ax-rank--1' : i === 1 ? 'vt-ax-rank--2' : i === 2 ? 'vt-ax-rank--3' : '';
                return `<tr>
                    <td><span class="vt-ax-rank ${rankClass}">${i + 1}</span></td>
                    <td>${esc(t.Codigo)}</td>
                    <td>${esc(t.Descripcion)}</td>
                    <td>${esc(t.Rubro)}</td>
                    <td>${num(t.Cantidad)}</td>
                    <td>${money(t.TotalVenta)}</td>
                </tr>`;
            }).join('') || emptyTop;
        } finally {
            showLoading(false);
        }
    }

    function setupStickyNav() {
        const links = Array.from(document.querySelectorAll('#axNav .vt-ax-nav-link'));
        if (!links.length) return;

        const sections = links
            .map(a => document.querySelector(a.getAttribute('href')))
            .filter(Boolean);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const id = '#' + entry.target.id;
                links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === id));
            });
        }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });

        sections.forEach(s => observer.observe(s));

        links.forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(a.getAttribute('href'));
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                links.forEach(l => l.classList.remove('active'));
                a.classList.add('active');
            });
        });
    }

    function markCustom() {
        document.querySelectorAll('#axPeriodos .vt-ax-chip').forEach(b => b.classList.remove('active'));
        const custom = document.querySelector('#axPeriodos .vt-ax-chip[data-periodo="custom"]');
        if (custom) custom.classList.add('active');
        setText('axPeriodoLabel', 'Personalizado');
        periodoActivo = 'custom';
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const hoy = new Date();
        qs('fltAnio').value = hoy.getFullYear();
        setupMesChips();
        setupStickyNav();

        qs('btnAnioPrev')?.addEventListener('click', () => cambiarAnio(-1));
        qs('btnAnioNext')?.addEventListener('click', () => cambiarAnio(1));
        qs('fltAnio')?.addEventListener('change', () => {
            clearTimeout(matrizTimer);
            cargarMatriz();
        });
        qs('fltAnio')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(matrizTimer);
                cargarMatriz();
            }
        });
        qs('btnMesesTodos')?.addEventListener('click', () => setMeses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
        qs('btnMesesNinguno')?.addEventListener('click', () => setMeses([]));
        qs('btnMesesTrimestre')?.addEventListener('click', () => {
            const q = Math.floor(hoy.getMonth() / 3);
            setMeses([q * 3 + 1, q * 3 + 2, q * 3 + 3]);
        });

        await loadLocales();

        const vf = window.kyoVentasFiltros;
        const saved = vf ? vf.load() : null;
        if (saved && (saved.fechaDesde || saved.fechaHasta || saved.idLocal !== '0')) {
            vf.applyToDom(saved);
            markCustom();
        } else {
            aplicarPeriodo('mes');
        }

        if (vf) {
            [qs('fltDesde'), qs('fltHasta'), qs('fltLocal')].forEach(el => {
                if (!el) return;
                el.addEventListener('change', () => {
                    vf.persistFromDom();
                    markCustom();
                    if (el.id === 'fltLocal') programarMatriz(120);
                });
            });
        }

        document.querySelectorAll('#axPeriodos .vt-ax-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#axPeriodos .vt-ax-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                aplicarPeriodo(btn.dataset.periodo);
                if (btn.dataset.periodo !== 'custom') cargar();
            });
        });

        qs('btnAplicar').addEventListener('click', async () => {
            if (vf) vf.persistFromDom();
            await cargar();
            await cargarMatriz();
        });
        qs('btnMatriz').addEventListener('click', () => {
            if (vf) vf.persistFromDom();
            cargarMatriz();
        });

        await cargar();
        await cargarMatriz();
    });
})();
