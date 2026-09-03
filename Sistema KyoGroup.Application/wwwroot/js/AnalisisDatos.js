(function () {
    'use strict';

    const charts = {};
    let periodoActivo = '3m';

    const PASTEL = ['#f4a4b8', '#b5d99c', '#ffd4b8', '#c5b3e8', '#a8d8ea', '#ffb3ba', '#bae1ff', '#e8dff5', '#80cbc4', '#ffcc80'];
    const PASTEL_ALPHA = PASTEL.map(c => c + '99');

    const CHART_FONT = { family: 'system-ui, -apple-system, sans-serif' };

    function qs(id) { return document.getElementById(id); }

    function authHeaders() {
        return { Authorization: 'Bearer ' + (window.token || localStorage.getItem('JwtToken') || ''), 'Content-Type': 'application/json' };
    }

    function fmtDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function money(n) {
        return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
    }

    function num(n) {
        return Number(n || 0).toLocaleString('es-AR');
    }

    function setText(id, val) {
        const el = qs(id);
        if (el) el.textContent = val ?? '—';
    }

    function showLoading(on) {
        const el = qs('axLoading');
        if (el) el.classList.toggle('d-none', !on);
    }

    function aplicarPeriodo(key) {
        periodoActivo = key;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        let desde = new Date(hoy);
        let label = 'Personalizado';

        switch (key) {
            case 'mes':
                desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                label = 'Este mes';
                break;
            case '3m':
                desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
                label = 'Últimos 3 meses';
                break;
            case '6m':
                desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
                label = 'Últimos 6 meses';
                break;
            case 'ytd':
                desde = new Date(hoy.getFullYear(), 0, 1);
                label = 'Este año';
                break;
            case 'custom':
                label = 'Personalizado';
                return;
        }

        qs('fltDesde').value = fmtDate(desde);
        qs('fltHasta').value = fmtDate(hoy);
        setText('axPeriodoLabel', label);
    }

    function filtrosQuery() {
        const p = new URLSearchParams();
        if (qs('fltDesde').value) p.set('fechaDesde', qs('fltDesde').value);
        if (qs('fltHasta').value) p.set('fechaHasta', qs('fltHasta').value);
        return p.toString();
    }

    function destroyChart(id) {
        if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    }

    const defaultScales = {
        y: {
            beginAtZero: true,
            ticks: { color: '#7a7088', font: CHART_FONT },
            grid: { color: 'rgba(244,164,184,0.12)' },
            border: { display: false }
        },
        x: {
            ticks: { color: '#7a7088', font: CHART_FONT, maxRotation: 45 },
            grid: { display: false },
            border: { display: false }
        }
    };

    function makeLineChart(canvasId, labels, values, color = '#f4a4b8') {
        const ctx = qs(canvasId);
        if (!ctx) return;
        destroyChart(canvasId);
        charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Valor',
                    data: values,
                    borderColor: color,
                    backgroundColor: color + '33',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: color,
                    pointBorderWidth: 2,
                    borderWidth: 2.5
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

    function makeBarChart(canvasId, labels, values, horizontal = false) {
        const ctx = qs(canvasId);
        if (!ctx) return;
        destroyChart(canvasId);
        const colors = labels.map((_, i) => PASTEL[i % PASTEL.length]);
        charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderRadius: horizontal ? 6 : 8,
                    borderSkipped: false,
                    maxBarThickness: horizontal ? 22 : 48
                }]
            },
            options: {
                indexAxis: horizontal ? 'y' : 'x',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: horizontal
                    ? {
                        x: { ...defaultScales.y, grid: { color: 'rgba(244,164,184,0.1)' } },
                        y: { ticks: { color: '#7a7088', font: { size: 11 } }, grid: { display: false }, border: { display: false } }
                    }
                    : defaultScales
            }
        });
    }

    function makeDoughnut(canvasId, labels, values) {
        const ctx = qs(canvasId);
        if (!ctx) return;
        destroyChart(canvasId);
        charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: PASTEL.slice(0, labels.length),
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#7a7088', padding: 10, font: { size: 11, weight: '600' }, boxWidth: 12 }
                    }
                }
            }
        });
    }

    function makeCcDoughnut(canvasId, labels, values) {
        const ctx = qs(canvasId);
        if (!ctx) return;
        destroyChart(canvasId);
        charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#f4a4b8', '#b5d99c'],
                    borderWidth: 3,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderRanking(containerId, items, valueFn, maxItems = 8) {
        const el = qs(containerId);
        if (!el) return;

        const list = (items || []).slice(0, maxItems);
        if (!list.length) {
            el.innerHTML = '<div class="ax-rank-empty"><i class="fa fa-inbox" aria-hidden="true"></i><span class="kyo-empty-text">Sin datos en este período</span></div>';
            return;
        }

        const maxVal = Math.max(...list.map(x => Number(valueFn(x) || 0)), 1);

        el.innerHTML = list.map((item, i) => {
            const label = item.Label || item.label || '—';
            const val = Number(valueFn(item) || 0);
            const pct = Math.round((val / maxVal) * 100);
            return `
                <div class="ax-rank-item">
                    <span class="ax-rank-pos">${i + 1}</span>
                    <span class="ax-rank-name" title="${label}">${label}</span>
                    <div class="ax-rank-bar-wrap"><div class="ax-rank-bar" style="width:${pct}%"></div></div>
                    <span class="ax-rank-val">${money(val)}</span>
                </div>`;
        }).join('');
    }

    function getSerie(data) {
        return (data.Serie || data.serie || []).map(x => ({
            label: x.Label || x.label || '',
            valor: Number(x.Valor ?? x.valor ?? 0),
            cantidad: Number(x.Cantidad ?? x.cantidad ?? 0)
        }));
    }

    function getRanking(data) {
        return (data.Ranking || data.ranking || []).map(x => ({
            label: x.Label || x.label || '',
            valor: Number(x.Valor ?? x.valor ?? 0),
            cantidad: Number(x.Cantidad ?? x.cantidad ?? 0)
        }));
    }

    async function fetchReporte(endpoint) {
        const q = filtrosQuery();
        const res = await fetch(`/AnalisisDatos/${endpoint}?${q}`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`Error al cargar ${endpoint}`);
        return res.json();
    }

    function renderCompras(data) {
        const serie = getSerie(data);
        const ranking = getRanking(data);
        const labels = serie.map(s => s.label);
        const values = serie.map(s => s.valor);
        const rLabels = ranking.map(r => r.label);
        const rValues = ranking.map(r => r.valor);

        setText('kpiComprasTotal', money(data.Total ?? data.total));
        setText('kpiComprasCant', num(data.Cantidad ?? data.cantidad));

        makeLineChart('chartComprasLine', labels, values, '#f4a4b8');
        makeLineChart('chartCompras', labels, values, '#e8879f');
        if (rLabels.length) {
            makeDoughnut('chartComprasPie', rLabels.slice(0, 6), rValues.slice(0, 6));
            makeBarChart('chartComprasRank', rLabels, rValues, true);
        }
        renderRanking('rankComprasQuick', ranking, x => x.valor, 5);
        renderRanking('rankCompras', ranking, x => x.valor);

        if (ranking.length) {
            setText('kpiTopProveedor', ranking[0].label);
            setText('kpiTopProveedorMonto', money(ranking[0].valor));
        }
    }

    function renderCostos(data) {
        const serie = getSerie(data);
        const ranking = getRanking(data);
        const labels = serie.map(s => s.label);
        const values = serie.map(s => s.valor);

        setText('kpiCostosTotal', money(data.Total ?? data.total));
        setText('kpiCostosCant', num(data.Cantidad ?? data.cantidad));

        makeLineChart('chartCostos', labels, values, '#8bc34a');
        if (ranking.length) {
            makeDoughnut('chartCostosPie', ranking.map(r => r.label), ranking.map(r => r.valor));
        }
        renderRanking('rankCostos', ranking, x => x.valor);
    }

    function renderInsumos(data) {
        const serie = getSerie(data);
        const ranking = getRanking(data);
        const labels = serie.map(s => s.label);
        const values = serie.map(s => s.valor);

        setText('kpiInsumosTotal', money(data.Total ?? data.total));
        setText('kpiInsumosCant', num(data.Cantidad ?? data.cantidad));

        makeLineChart('chartInsumos', labels, values, '#ff9a6c');
        if (ranking.length) {
            makeBarChart('chartInsumosRank', ranking.map(r => r.label), ranking.map(r => r.valor), true);
        }
        renderRanking('rankInsumos', ranking, x => x.valor);
    }

    function renderRecetas(data) {
        const serie = getSerie(data);
        const ranking = getRanking(data);
        const labels = serie.map(s => s.label);
        const values = serie.map(s => s.valor);

        setText('kpiRecetasTotal', money(data.Total ?? data.total));
        setText('kpiRecetasCant', num(data.Cantidad ?? data.cantidad));

        makeLineChart('chartRecetas', labels, values, '#9b7fd4');
        if (ranking.length) {
            makeBarChart('chartRecetasRank', ranking.map(r => r.label), ranking.map(r => r.valor), true);
        }
        renderRanking('rankRecetas', ranking, x => x.valor);
    }

    function renderCc(data) {
        const serie = getSerie(data);
        const ranking = getRanking(data);

        setText('kpiCcTotal', money(data.Total ?? data.total));
        setText('kpiCcMovs', num(data.Cantidad ?? data.cantidad));

        if (serie.length) {
            makeCcDoughnut('chartCc', serie.map(s => s.label), serie.map(s => s.valor));
        }
        if (ranking.length) {
            makeBarChart('chartCcRank', ranking.map(r => r.label), ranking.map(r => r.valor), true);
        }
        renderRanking('rankCc', ranking, x => x.valor);
    }

    async function cargarTodo() {
        showLoading(true);
        try {
            const [compras, costos, insumos, recetas, cc] = await Promise.all([
                fetchReporte('Compras'),
                fetchReporte('Costos'),
                fetchReporte('Insumos'),
                fetchReporte('Recetas'),
                fetchReporte('CuentaCorriente')
            ]);

            renderCompras(compras);
            renderCostos(costos);
            renderInsumos(insumos);
            renderRecetas(recetas);
            renderCc(cc);
        } catch (err) {
            console.error(err);
            if (typeof errorModal === 'function') errorModal('No se pudieron cargar los datos de análisis.');
        } finally {
            showLoading(false);
        }
    }

    function initNav() {
        const links = document.querySelectorAll('.ax-nav-link');
        const sections = document.querySelectorAll('.ax-section');

        links.forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
                }
            });
        }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });

        sections.forEach(s => observer.observe(s));
    }

    document.addEventListener('DOMContentLoaded', () => {
        aplicarPeriodo('3m');
        initNav();

        document.querySelectorAll('#axPeriodos .ax-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#axPeriodos .ax-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                aplicarPeriodo(btn.dataset.periodo);
                if (btn.dataset.label) setText('axPeriodoLabel', btn.dataset.label);
                if (btn.dataset.periodo !== 'custom') cargarTodo();
            });
        });

        ['fltDesde', 'fltHasta'].forEach(id => {
            qs(id)?.addEventListener('change', () => {
                document.querySelectorAll('#axPeriodos .ax-chip').forEach(b => b.classList.remove('active'));
                document.querySelector('#axPeriodos [data-periodo="custom"]')?.classList.add('active');
                setText('axPeriodoLabel', 'Personalizado');
            });
        });

        qs('btnAplicar').addEventListener('click', cargarTodo);
        cargarTodo();
    });
})();
