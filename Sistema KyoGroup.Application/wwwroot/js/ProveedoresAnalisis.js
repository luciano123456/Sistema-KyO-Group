(function () {
    'use strict';

    const charts = {};
    const PASTEL = ['#e8879f', '#b5d99c', '#ffd4b8', '#c5b3e8', '#a8d8ea', '#f4a4b8', '#bae1ff', '#e0a15a', '#9ad0c2', '#d4a5c9', '#f0c987', '#8eb8e5'];

    const fmtMoney = (v, dig = 0) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: dig }).format(Number(v || 0));
    const fmtNum = (v, dig = 0) =>
        new Intl.NumberFormat('es-AR', { maximumFractionDigits: dig }).format(Number(v || 0));
    const esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    function auth() {
        const t = localStorage.getItem('JwtToken') || (typeof token !== 'undefined' ? token : '');
        return t ? { Authorization: 'Bearer ' + t } : {};
    }

    async function fetchJson(url) {
        const r = await fetch(url, { headers: auth() });
        if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
        return r.json();
    }

    function destroy(id) {
        if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function isoDate(d) {
        const x = new Date(d);
        return x.toISOString().slice(0, 10);
    }

    function applyPeriodo(periodo) {
        const hoy = new Date();
        let desde;
        const hasta = hoy;
        if (periodo === '3m') desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
        else if (periodo === '6m') desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
        else if (periodo === 'ytd') desde = new Date(hoy.getFullYear(), 0, 1);
        else desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        document.getElementById('paDesde').value = isoDate(desde);
        document.getElementById('paHasta').value = isoDate(hasta);
    }

    async function cargarFiltros() {
        try {
            const [uns, provs] = await Promise.all([
                fetchJson('/UnidadesNegocio/ListaUsuario').catch(() => []),
                fetchJson('/Proveedores/Lista').catch(() => [])
            ]);
            const selUn = document.getElementById('paUnidad');
            const selProv = document.getElementById('paProveedor');
            (uns || []).forEach(u => {
                const o = document.createElement('option');
                o.value = u.Id; o.textContent = u.Nombre;
                selUn.appendChild(o);
            });
            (provs || []).forEach(p => {
                const o = document.createElement('option');
                o.value = p.Id; o.textContent = p.Nombre;
                selProv.appendChild(o);
            });
        } catch (e) {
            console.warn(e);
        }
    }

    async function cargarLocales() {
        const idUN = Number(document.getElementById('paUnidad')?.value || 0);
        const sel = document.getElementById('paLocal');
        sel.innerHTML = '<option value="0">Todos</option>';
        try {
            const url = idUN > 0
                ? `/Locales/ListaPorUnidad?IdUnidadNegocio=${idUN}`
                : '/Locales/Lista';
            const data = await fetchJson(url);
            (data || []).forEach(l => {
                const o = document.createElement('option');
                o.value = l.Id; o.textContent = l.Nombre;
                sel.appendChild(o);
            });
        } catch (e) {
            console.warn(e);
        }
    }

    const chartBase = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#7a7088', font: { weight: '600', size: 11 } } }
        }
    };

    function renderKpis(k) {
        setText('paKpiTotal', fmtMoney(k.TotalComprado));
        setText('paKpiCant', fmtNum(k.CantCompras));
        setText('paKpiTicket', fmtMoney(k.TicketPromedio));
        setText('paKpiProv', fmtNum(k.ProveedoresActivos));
        setText('paKpiTop', k.TopProveedor || '—');
        setText('paKpiDeuda', fmtMoney(k.DeudaTotal));
        setText('paKpiPagado', fmtMoney(k.HaberPeriodo));
        setText('paKpiOc', fmtNum(k.OcTotal));
        setText('paKpiOcDetalle', `${k.OcPendientes || 0} pend. · ${k.OcEntregadas || 0} ent.`);
        setText('paKpiInsumos', fmtNum(k.InsumosDistintos));
        setText('paKpiDebe', fmtMoney(k.DebePeriodo));
        setText('paKpiHaber', fmtMoney(k.HaberPeriodo));

        const varEl = document.getElementById('paKpiVar');
        if (varEl) {
            const v = Number(k.VariacionPct || 0);
            const sign = v > 0 ? '+' : '';
            varEl.textContent = `${sign}${fmtNum(v, 1)}% vs período anterior`;
            varEl.classList.remove('is-up', 'is-down');
            if (v > 0.05) varEl.classList.add('is-up');
            else if (v < -0.05) varEl.classList.add('is-down');
        }
    }

    function renderRank(list) {
        const host = document.getElementById('paRankList');
        if (!host) return;
        if (!list?.length) {
            host.innerHTML = '<div class="pa-alert-empty">Sin datos de ranking en el período.</div>';
            return;
        }
        host.innerHTML = list.map((x, i) => `
            <div class="pa-rank-item">
                <span class="pa-rank-pos">${i + 1}</span>
                <div>
                    <div class="pa-rank-name">${esc(x.Nombre)}</div>
                    <div class="pa-rank-bar"><span style="width:${Math.min(100, Number(x.Pct || 0))}%"></span></div>
                </div>
                <div class="pa-rank-meta">
                    <strong>${fmtMoney(x.Total)}</strong>
                    ${fmtNum(x.Pct, 1)}% · ${x.CantCompras} compra${x.CantCompras === 1 ? '' : 's'}
                </div>
            </div>
        `).join('');
    }

    function renderAlertas(list) {
        const host = document.getElementById('paAlertasPrecio');
        if (!host) return;
        if (!list?.length) {
            host.innerHTML = '<div class="pa-alert-empty">Sin desvíos de precio factura vs lista en el período.</div>';
            return;
        }
        host.innerHTML = list.map(a => {
            const up = Number(a.Diff) > 0;
            return `
            <div class="pa-alert-item ${up ? 'is-up' : 'is-down'}">
                <div class="pa-alert-name">${esc(a.Nombre)}</div>
                <div class="pa-alert-prov">${esc(a.Proveedor)} · ${a.Veces} vez${a.Veces === 1 ? '' : 'es'}</div>
                <div class="pa-alert-row">
                    <span>${fmtMoney(a.PrecioLista, 2)} → ${fmtMoney(a.PrecioFactura, 2)}</span>
                    <span class="pa-alert-diff ${up ? 'is-up' : 'is-down'}">${up ? '+' : ''}${fmtNum(a.DiffPct, 1)}%</span>
                </div>
            </div>`;
        }).join('');
    }

    function renderTabla(rows) {
        const body = document.getElementById('paTablaBody');
        const empty = document.getElementById('paTablaEmpty');
        if (!body) return;
        if (!rows?.length) {
            body.innerHTML = '';
            empty?.classList.remove('d-none');
            return;
        }
        empty?.classList.add('d-none');
        body.innerHTML = rows.map(r => {
            const deudaCls = Number(r.Deuda) > 0 ? 'pa-deuda-pos' : (Number(r.Deuda) < 0 ? 'pa-deuda-neg' : '');
            return `<tr>
                <td>${esc(r.Nombre)}</td>
                <td class="text-end">${fmtNum(r.CantCompras)}</td>
                <td class="text-end">${fmtMoney(r.Total)}</td>
                <td class="text-end">${fmtMoney(r.Ticket)}</td>
                <td class="text-end">${fmtNum(r.Pct, 1)}%</td>
                <td class="text-end">${fmtMoney(r.Pagado)}</td>
                <td class="text-end ${deudaCls}">${fmtMoney(r.Deuda)}</td>
                <td>${esc(r.UltimaCompra)}</td>
                <td><a class="pa-link-gestion" href="/Proveedores/Gestion/${r.Id}" title="Abrir gestión"><i class="fa fa-external-link"></i></a></td>
            </tr>`;
        }).join('');
    }

    function barChart(canvasId, key, labels, data, opts = {}) {
        destroy(key);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        charts[key] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: opts.label || 'Total',
                    data,
                    backgroundColor: opts.colors || PASTEL,
                    borderRadius: 8,
                    borderSkipped: false,
                    maxBarThickness: opts.maxBar || 42
                }]
            },
            options: {
                ...chartBase,
                indexAxis: opts.horizontal ? 'y' : 'x',
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#7a7088', maxRotation: 45 }, grid: { color: 'rgba(244,164,184,0.12)' } },
                    y: { ticks: { color: '#7a7088' }, grid: { color: 'rgba(244,164,184,0.12)' } }
                }
            }
        });
    }

    async function cargar() {
        const loading = document.getElementById('paLoading');
        loading?.classList.remove('d-none');
        try {
            const desde = document.getElementById('paDesde').value;
            const hasta = document.getElementById('paHasta').value;
            const idUN = document.getElementById('paUnidad').value || 0;
            const idLocal = document.getElementById('paLocal').value || 0;
            const idProv = document.getElementById('paProveedor').value || 0;
            const q = new URLSearchParams({
                fechaDesde: desde,
                fechaHasta: hasta,
                idUnidadNegocio: idUN,
                idLocal,
                idProveedor: idProv
            });
            const data = await fetchJson('/Proveedores/AnalisisDatos?' + q.toString());
            const k = data.Kpis || {};

            renderKpis(k);
            renderRank(data.TopProveedores || []);
            renderAlertas(data.AlertasPrecio || []);
            renderTabla(data.TablaProveedores || []);

            // Top proveedores
            barChart('chartTopProveedores', 'top',
                (data.TopProveedores || []).map(x => x.Nombre),
                (data.TopProveedores || []).map(x => x.Total));

            // Doughnut
            destroy('pie');
            charts.pie = new Chart(document.getElementById('chartDistribucion'), {
                type: 'doughnut',
                data: {
                    labels: (data.TopProveedores || []).map(x => x.Nombre),
                    datasets: [{
                        data: (data.TopProveedores || []).map(x => x.Total),
                        backgroundColor: PASTEL,
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    ...chartBase,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#7a7088', padding: 10, font: { size: 11, weight: '600' } } }
                    }
                }
            });

            // Serie
            destroy('serie');
            const serie = data.SerieCompras || [];
            charts.serie = new Chart(document.getElementById('chartSerie'), {
                type: 'line',
                data: {
                    labels: serie.map(x => x.Label),
                    datasets: [{
                        label: 'Compras',
                        data: serie.map(x => x.Total),
                        borderColor: '#e8879f',
                        backgroundColor: 'rgba(232, 135, 159, 0.18)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 3,
                        pointBackgroundColor: '#c45d78'
                    }]
                },
                options: {
                    ...chartBase,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#7a7088' }, grid: { display: false } },
                        y: { ticks: { color: '#7a7088' }, grid: { color: 'rgba(244,164,184,0.12)' } }
                    }
                }
            });

            barChart('chartUnidad', 'un',
                (data.PorUnidadNegocio || []).map(x => x.Nombre),
                (data.PorUnidadNegocio || []).map(x => x.Total),
                { colors: '#b5d99c' });

            barChart('chartLocal', 'loc',
                (data.PorLocal || []).map(x => x.Nombre),
                (data.PorLocal || []).map(x => x.Total),
                { colors: '#a8d8ea' });

            // OC estados
            destroy('oc');
            charts.oc = new Chart(document.getElementById('chartOcEstado'), {
                type: 'doughnut',
                data: {
                    labels: (data.OcPorEstado || []).map(x => x.Nombre),
                    datasets: [{
                        data: (data.OcPorEstado || []).map(x => x.Cantidad),
                        backgroundColor: PASTEL,
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    ...chartBase,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#7a7088', font: { size: 11, weight: '600' } } }
                    }
                }
            });

            // Flujo CC
            destroy('flujo');
            const flujo = data.FlujoCc || [];
            charts.flujo = new Chart(document.getElementById('chartFlujoCc'), {
                type: 'bar',
                data: {
                    labels: flujo.map(x => x.Label),
                    datasets: [
                        {
                            label: 'Debe',
                            data: flujo.map(x => x.Debe),
                            backgroundColor: 'rgba(198, 40, 40, 0.75)',
                            borderRadius: 4
                        },
                        {
                            label: 'Haber',
                            data: flujo.map(x => x.Haber),
                            backgroundColor: 'rgba(46, 125, 50, 0.75)',
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    ...chartBase,
                    scales: {
                        x: { stacked: false, ticks: { color: '#7a7088' }, grid: { display: false } },
                        y: { ticks: { color: '#7a7088' }, grid: { color: 'rgba(244,164,184,0.12)' } }
                    }
                }
            });

            barChart('chartDeuda', 'deuda',
                (data.DeudaProveedores || []).map(x => x.Nombre),
                (data.DeudaProveedores || []).map(x => x.Saldo),
                { horizontal: true, colors: '#f4a4b8', maxBar: 22 });

            barChart('chartInsumos', 'insumos',
                (data.TopInsumos || []).map(x => x.Nombre),
                (data.TopInsumos || []).map(x => x.Total),
                { horizontal: true, colors: PASTEL, maxBar: 20 });

        } catch (e) {
            console.error(e);
            if (typeof errorModal === 'function') errorModal(e.message || 'No se pudo cargar el análisis.');
        } finally {
            loading?.classList.add('d-none');
        }
    }

    function wireNav() {
        const links = document.querySelectorAll('#paNav .pa-nav-link');
        links.forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const id = a.getAttribute('href');
                document.querySelector(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                links.forEach(l => l.classList.remove('active'));
                a.classList.add('active');
            });
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        applyPeriodo('mes');
        await cargarFiltros();
        await cargarLocales();
        wireNav();

        document.getElementById('paPeriodos')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.pa-chip');
            if (!btn) return;
            document.querySelectorAll('#paPeriodos .pa-chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const p = btn.dataset.periodo;
            setText('paPeriodoLabel', btn.textContent.trim());
            if (p !== 'custom') {
                applyPeriodo(p);
                cargar();
            }
        });

        document.getElementById('paUnidad')?.addEventListener('change', async () => {
            await cargarLocales();
        });

        document.getElementById('btnPaActualizar')?.addEventListener('click', cargar);
        cargar().catch(e => console.error(e));
    });
})();
