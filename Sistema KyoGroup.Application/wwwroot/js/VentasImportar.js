(function () {
    'use strict';

    let previews = [];
    let locales = [];

    function authHeaders(json) {
        const h = { Authorization: 'Bearer ' + (window.token || localStorage.getItem('JwtToken') || '') };
        if (json) h['Content-Type'] = 'application/json';
        return h;
    }

    function resumenCuerpoError(status, text, fallback) {
        const snippet = String(text || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 240);
        const prefix = status ? `HTTP ${status}. ` : '';
        if (!snippet) return prefix + fallback;
        return prefix + snippet;
    }

    async function parseResponseJson(r) {
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        const text = await r.text();
        const looksJson = /^\s*[\[{]/.test(text || '');
        if (ct.includes('json') || looksJson) {
            try {
                return JSON.parse(text);
            } catch {
                throw new Error(resumenCuerpoError(r.status, text, 'El servidor devolvió un JSON inválido.'));
            }
        }
        throw new Error(resumenCuerpoError(r.status, text, 'El servidor no devolvió JSON (posible error interno de ASP.NET).'));
    }

    function money(n) {
        return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
    }

    function toInputDate(v) {
        if (!v) return '';
        const d = new Date(v);
        if (isNaN(d)) return '';
        return d.toISOString().slice(0, 10);
    }

    function getSessionUserName() {
        try {
            const raw = localStorage.getItem('userSession');
            if (!raw) return '—';
            const u = JSON.parse(raw);
            if (!u) return '—';
            const full = `${u.Nombre || ''} ${u.Apellido || ''}`.trim().replace(/\s+/g, ' ');
            if (full) return full;
            if (u.Usuario) return String(u.Usuario);
            return '—';
        } catch {
            return '—';
        }
    }

    function lineaSeleccionada(l) {
        return !!(l && l.Incluir === true);
    }

    function tieneVinculo(l) {
        if (!l) return false;
        const tipo = (l.TipoVinculo || '').toString();
        return tipo === 'Receta' || tipo === 'Insumo' || !!l.IdReceta || !!l.IdInsumo || !!l.Matched;
    }

    function ordenarLineasPreview(p) {
        const list = p.Lineas;
        if (!list || list.length < 2) return;
        list.forEach((l, i) => { if (l._ord == null) l._ord = i; });
        list.sort((a, b) => {
            const va = tieneVinculo(a) ? 0 : 1;
            const vb = tieneVinculo(b) ? 0 : 1;
            if (va !== vb) return va - vb;
            const ta = Number(a.Subtotal || 0);
            const tb = Number(b.Subtotal || 0);
            if (tb !== ta) return tb - ta;
            return (a._ord || 0) - (b._ord || 0);
        });
    }

    function vinculoBadge(l) {
        const title = 'Producto del Excel = SKU de una receta o insumo del sistema';
        const tipo = (l.TipoVinculo || '').toString();
        if (tipo === 'Receta' || l.IdReceta) {
            return `<span class="vt-badge-ok" title="${title}">Receta</span>`;
        }
        if (tipo === 'Insumo' || l.IdInsumo) {
            return `<span class="vt-badge-insumo" title="${title}">Insumo</span>`;
        }
        if (l.Matched) {
            return `<span class="vt-badge-ok" title="${title}">Vinculado</span>`;
        }
        return `<span class="vt-badge-miss" title="${title}">Sin vínculo</span>`;
    }

    function setSteps(active) {
        document.querySelectorAll('#vtSteps .vt-step').forEach(el => {
            el.classList.toggle('is-active', Number(el.dataset.step) <= active);
        });
    }

    function updateConfirmBar() {
        const bar = document.getElementById('vtConfirmBar');
        const replacePanel = document.getElementById('vtReplacePanel');
        if (!previews.length) {
            bar.classList.add('d-none');
            setSteps(1);
            return;
        }
        bar.classList.remove('d-none');
        setSteps(3);

        const validos = previews.filter(p => !p.Error);
        let lineas = 0, vinculadas = 0, venta = 0;
        validos.forEach(p => {
            recalcularArchivo(p);
            lineas += p.CantidadLineas || 0;
            vinculadas += p.LineasMatched || 0;
            venta += Number(p.TotalVenta || 0);
        });

        document.getElementById('sumArchivos').textContent = String(validos.length);
        document.getElementById('sumLineas').textContent = String(lineas);
        document.getElementById('sumVinculadas').textContent = String(vinculadas);
        document.getElementById('sumVenta').textContent = money(venta);
        if (replacePanel) replacePanel.classList.add('d-none');
    }

    async function loadLocales() {
        const r = await fetch('/Locales/Lista', { headers: authHeaders() });
        if (!r.ok) return [];
        const data = await r.json();
        return (data || []).map(l => ({
            Id: l.Id,
            Nombre: l.Nombre,
            IdUnidadNegocio: l.IdCombo || l.IdUnidadNegocio || 0
        }));
    }

    function recalcularArchivo(p) {
        const incluidas = (p.Lineas || []).filter(lineaSeleccionada);
        p.CantidadLineas = incluidas.length;
        p.LineasMatched = incluidas.filter(tieneVinculo).length;
        p.TotalVenta = incluidas.reduce((a, l) => a + Number(l.Subtotal || 0), 0);
        p.TotalCosto = incluidas.reduce((a, l) => a + Number(l.SubtotalCosto || 0), 0);
    }

    function render() {
        const host = document.getElementById('vtPreviewHost');
        if (!previews.length) {
            host.classList.add('d-none');
            host.innerHTML = '';
            updateConfirmBar();
            return;
        }
        host.classList.remove('d-none');
        setSteps(2);

        const sessionUser = getSessionUserName();

        host.innerHTML = previews.map((p, fi) => {
            recalcularArchivo(p);
            const cls = p.Error ? 'is-error' : (p.YaExiste ? 'is-dup' : '');
            const opts = locales.map(l =>
                `<option value="${l.Id}" data-un="${l.IdUnidadNegocio || 0}" ${p.IdLocalSugerido == l.Id ? 'selected' : ''}>${escapeHtml(l.Nombre)}</option>`
            ).join('');

            const rows = (p.Lineas || []).map((l, li) => {
                const sel = lineaSeleccionada(l);
                const excl = sel ? '' : 'excluir';
                return `<tr class="${excl}" data-fi="${fi}" data-li="${li}">
                    <td><input type="checkbox" class="form-check-input vt-chk" title="Incluir línea" ${sel ? 'checked' : ''} /></td>
                    <td>${escapeHtml(l.Codigo)}</td>
                    <td><input class="form-control form-control-sm vt-desc" value="${escapeAttr(l.Descripcion)}" /></td>
                    <td>${escapeHtml(l.Rubro || '')}</td>
                    <td><input type="number" step="0.01" class="form-control form-control-sm vt-cant" value="${l.Cantidad}" /></td>
                    <td><input type="number" step="0.01" class="form-control form-control-sm vt-precio" value="${l.PrecioUnitario}" /></td>
                    <td><input type="number" step="0.01" class="form-control form-control-sm vt-sub" value="${l.Subtotal}" /></td>
                    <td>${money(l.SubtotalCosto)}</td>
                    <td>${vinculoBadge(l)}</td>
                    <td><button type="button" class="btn btn-sm btn-outline-danger vt-del" title="Excluir línea"><i class="fa fa-trash-o"></i></button></td>
                </tr>`;
            }).join('');

            return `<div class="vt-file-card ${cls}" data-fi="${fi}">
                <div class="vt-file-head">
                    <div>
                        <div class="vt-file-name">${escapeHtml(p.NombreArchivo)}</div>
                        ${p.Error ? `<div class="vt-file-error">${escapeHtml(p.Error)}</div>` : ''}
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-secondary ms-auto vt-remove-file"><i class="fa fa-times"></i> Quitar archivo</button>
                </div>
                ${p.YaExiste ? `<div class="vt-dup-banner vt-dup-banner--info">
                    <i class="fa fa-info-circle"></i>
                    <div>
                        <strong>Ya hay ventas para este local y fecha</strong>
                        <p>Al confirmar se actualiza la importación existente (#${p.IdImportacionExistente || '—'}) con estos datos.</p>
                    </div>
                </div>` : ''}
                <div class="vt-meta-grid">
                    <div class="vt-meta-item"><label>Empresa</label><div class="val">${escapeHtml(p.Empresa || '—')}</div></div>
                    <div class="vt-meta-item vt-meta-item--accent">
                        <label>Usuario</label>
                        <div class="val">${escapeHtml(sessionUser)}</div>
                    </div>
                    <div class="vt-meta-item"><label>Fecha archivo</label><div class="val">${p.FechaExportacion ? new Date(p.FechaExportacion).toLocaleString('es-AR') : '—'}</div></div>
                    <div class="vt-meta-item" title="Producto del Excel = SKU de una receta o insumo del sistema">
                        <label>Ítems / vinculados</label>
                        <div class="val vt-meta-lineas">${p.CantidadLineas} · ${p.LineasMatched} vinculados</div>
                    </div>
                    <div class="vt-meta-item vt-meta-item--money"><label>Total venta</label><div class="val vt-meta-venta">${money(p.TotalVenta)}</div></div>
                </div>
                <div class="vt-form-row">
                    <div>
                        <label>Local <span class="vt-req">*</span></label>
                        <select class="form-select form-select-sm vt-local"><option value="0">Seleccionar...</option>${opts}</select>
                    </div>
                    <div>
                        <label>Fecha de venta <span class="vt-req">*</span></label>
                        <input type="date" class="form-control form-control-sm vt-fecha" value="${toInputDate(p.FechaSugerida)}" />
                    </div>
                </div>
                ${p.Error ? '' : `<p class="vt-lines-hint"><i class="fa fa-info-circle"></i> Solo las líneas con receta o insumo vienen marcadas. Marcá manualmente las que estén sin vínculo si querés importarlas. <span class="vt-badge-ok">Receta</span> · <span class="vt-badge-insumo">Insumo</span> · <span class="vt-badge-miss">Sin vínculo</span></p>
                <div class="vt-lines-wrap">
                    <table class="table table-sm table-hover">
                        <thead><tr>
                            <th title="Incluir"></th><th>SKU</th><th>Descripción</th><th>Rubro</th><th>Cant.</th><th>Precio</th><th>Total</th><th>Costo sist.</th><th title="Producto del Excel = SKU de una receta o insumo del sistema">Vínculo</th><th></th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`}
            </div>`;
        }).join('');

        updateConfirmBar();
    }

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/\n/g, ' ');
    }

    function syncFromDom() {
        document.querySelectorAll('.vt-file-card').forEach(card => {
            const fi = Number(card.dataset.fi);
            const p = previews[fi];
            if (!p) return;
            const localSel = card.querySelector('.vt-local');
            const fechaInp = card.querySelector('.vt-fecha');
            p.IdLocalSugerido = Number(localSel?.value || 0) || null;
            p.IdUnidadNegocioSugerido = Number(localSel?.selectedOptions?.[0]?.dataset?.un || 0) || p.IdUnidadNegocioSugerido;
            p.FechaSugerida = fechaInp?.value || null;

            card.querySelectorAll('tbody tr').forEach(tr => {
                const li = Number(tr.dataset.li);
                const l = p.Lineas[li];
                if (!l) return;
                l.Incluir = !!tr.querySelector('.vt-chk')?.checked;
                l.Descripcion = tr.querySelector('.vt-desc')?.value ?? l.Descripcion;
                l.Cantidad = Number(tr.querySelector('.vt-cant')?.value || 0);
                l.PrecioUnitario = Number(tr.querySelector('.vt-precio')?.value || 0);
                l.Subtotal = Number(tr.querySelector('.vt-sub')?.value || 0);
            });
            recalcularArchivo(p);
        });
    }

    function refreshMetaTotals() {
        document.querySelectorAll('.vt-file-card').forEach(card => {
            const fi = Number(card.dataset.fi);
            const p = previews[fi];
            if (!p) return;
            recalcularArchivo(p);
            const lineasEl = card.querySelector('.vt-meta-lineas');
            const ventaEl = card.querySelector('.vt-meta-venta');
            if (lineasEl) lineasEl.textContent = `${p.CantidadLineas} · ${p.LineasMatched} vinculados`;
            if (ventaEl) ventaEl.textContent = money(p.TotalVenta);
        });
        updateConfirmBar();
    }

    async function uploadFiles(fileList) {
        if (!fileList || !fileList.length) return;
        const fd = new FormData();
        Array.from(fileList).forEach(f => fd.append('files', f));
        const btn = document.getElementById('btnElegirArchivos');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Leyendo...';
        try {
            const r = await fetch('/Ventas/Previsualizar', { method: 'POST', headers: authHeaders(), body: fd });
            const data = await parseResponseJson(r);
            if (!r.ok) throw new Error((data && (data.mensaje || data.Mensaje)) || ('Error ' + r.status));
            const incoming = Array.isArray(data) ? data : [];
            incoming.forEach(p => {
                (p.Lineas || []).forEach(l => { l.Incluir = tieneVinculo(l); });
                ordenarLineasPreview(p);
            });
            previews = previews.concat(incoming);
            render();
        } catch (e) {
            if (typeof errorModal === 'function') errorModal('Error al previsualizar: ' + (e.message || e));
            else await vtAviso('Error al previsualizar: ' + (e.message || e), { soloOk: true, title: 'Error' });
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa fa-folder-open me-1"></i> Elegir archivos';
            document.getElementById('vtFiles').value = '';
        }
    }

    async function confirmar() {
        syncFromDom();
        const archivos = [];
        for (const p of previews) {
            if (p.Error) continue;
            const idLocal = Number(p.IdLocalSugerido || 0);
            if (!idLocal) {
                await vtAviso('Seleccioná el local para: ' + p.NombreArchivo, { soloOk: true, title: 'Local requerido' });
                return;
            }
            if (!p.FechaSugerida) {
                await vtAviso('Indicá la fecha de venta para: ' + p.NombreArchivo, { soloOk: true, title: 'Fecha requerida' });
                return;
            }
            const lineas = (p.Lineas || []).filter(lineaSeleccionada).map(l => ({
                Codigo: l.Codigo,
                Descripcion: l.Descripcion,
                Rubro: l.Rubro,
                RubroCodigo: l.RubroCodigo,
                Cantidad: Number(l.Cantidad || 0),
                PrecioUnitario: Number(l.PrecioUnitario || 0),
                Subtotal: Number(l.Subtotal || 0),
                CostoUnitarioExcel: Number(l.CostoUnitarioExcel || 0)
            }));
            if (!lineas.length) {
                await vtAviso('No quedan líneas para importar en: ' + p.NombreArchivo, { soloOk: true, title: 'Sin líneas' });
                return;
            }
            archivos.push({
                NombreArchivo: p.NombreArchivo,
                Fecha: p.FechaSugerida,
                IdLocal: idLocal,
                IdUnidadNegocio: Number(p.IdUnidadNegocioSugerido || 0),
                Empresa: p.Empresa,
                Informe: p.Informe,
                Lineas: lineas
            });
        }
        if (!archivos.length) {
            await vtAviso('Nada para importar.', { soloOk: true, title: 'Importar' });
            return;
        }

        const btn = document.getElementById('btnConfirmarImport');
        const host = document.getElementById('vtConfirmResult');
        const run = async () => {
            if (host) {
                host.innerHTML = '<div class="vt-result-ok vt-result-summary vt-result-loading">'
                    + '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>'
                    + 'Importando ventas…</div>';
            }
            // Siempre reemplaza si ya existe local+fecha; el resumen lo explica
            await confirmarConOpcion(archivos, true, false);
        };

        try {
            if (typeof withBusy === 'function') {
                await withBusy(btn, run, { label: 'Importando...' });
            } else {
                btn.disabled = true;
                const prev = btn.innerHTML;
                btn.innerHTML = '<i class="fa fa-spinner fa-spin me-1"></i> Importando...';
                try { await run(); }
                finally {
                    btn.disabled = false;
                    btn.innerHTML = prev;
                }
            }
        } catch (e) {
            if (host) host.innerHTML = '';
            if (typeof errorModal === 'function') errorModal(e.message || String(e));
            else await vtAviso('Error al confirmar: ' + (e.message || e), { soloOk: true, title: 'Error' });
        }
    }

    function vtAviso(mensaje, opts = {}) {
        return new Promise((resolve) => {
            const el = document.getElementById('modalVtAviso');
            if (!el || typeof bootstrap === 'undefined') {
                if (opts.soloOk) {
                    if (typeof advertenciaModal === 'function') advertenciaModal(mensaje);
                    else if (typeof errorModal === 'function') errorModal(mensaje);
                    resolve(true);
                    return;
                }
                if (typeof confirmarModal === 'function') {
                    confirmarModal(mensaje).then(resolve);
                    return;
                }
                resolve(false);
                return;
            }
            document.getElementById('modalVtAvisoTitle').textContent = opts.title || 'Atención';
            document.getElementById('modalVtAvisoMsg').textContent = mensaje;
            const btnSi = document.getElementById('btnVtAvisoSi');
            const btnNo = document.getElementById('btnVtAvisoNo');
            btnSi.textContent = opts.okText || 'Continuar';
            btnNo.textContent = opts.cancelText || 'Cancelar';
            btnNo.classList.toggle('d-none', !!opts.soloOk);
            if (opts.soloOk) btnSi.textContent = opts.okText || 'Entendido';

            const modal = bootstrap.Modal.getOrCreateInstance(el);
            let done = false;
            const finish = (val) => {
                if (done) return;
                done = true;
                modal.hide();
                resolve(val);
            };
            const onSi = () => finish(true);
            const onNo = () => finish(false);
            const onHidden = () => finish(false);
            btnSi.addEventListener('click', onSi, { once: true });
            btnNo.addEventListener('click', onNo, { once: true });
            el.addEventListener('hidden.bs.modal', onHidden, { once: true });
            modal.show();
        });
    }

    function vtModalRubrosFaltantes(faltantes) {
        return new Promise((resolve) => {
            const el = document.getElementById('modalRubrosFaltantes');
            if (!el || typeof bootstrap === 'undefined') {
                if (typeof confirmarModal === 'function') {
                    confirmarModal('Hay rubros faltantes. ¿Crearlos e importar?').then(resolve);
                    return;
                }
                resolve(false);
                return;
            }
            const list = document.getElementById('modalRubrosFaltantesList');
            const sub = document.getElementById('modalRubrosFaltantesSub');
            sub.textContent = faltantes.length === 1
                ? '1 rubro del Excel no existe en el sistema'
                : `${faltantes.length} rubros del Excel no existen en el sistema`;
            list.innerHTML = faltantes.map(n =>
                `<span class="vt-rubro-chip"><i class="fa fa-tag"></i>${escapeHtml(n)}</span>`
            ).join('');

            const modal = bootstrap.Modal.getOrCreateInstance(el);
            let done = false;
            const finish = (val) => {
                if (done) return;
                done = true;
                modal.hide();
                resolve(val);
            };
            const btnOk = document.getElementById('btnRubrosCrearImportar');
            const btnCancel = document.getElementById('btnRubrosCancelar');
            const onOk = () => finish(true);
            const onCancel = () => finish(false);
            const onHidden = () => finish(false);
            btnOk.addEventListener('click', onOk, { once: true });
            btnCancel.addEventListener('click', onCancel, { once: true });
            el.addEventListener('hidden.bs.modal', onHidden, { once: true });
            modal.show();
        });
    }

    async function confirmarConOpcion(archivos, reemplazar, crearRubros) {
        const r = await fetch('/Ventas/ConfirmarImportacion', {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify({
                ReemplazarSiExiste: reemplazar,
                CrearRubrosFaltantes: !!crearRubros,
                Archivos: archivos
            })
        });
        const data = await parseResponseJson(r);
        const tipo = (data.tipo || data.Tipo || '').toString();
        const faltantes = data.rubrosFaltantes || data.RubrosFaltantes || [];

        if (tipo === 'rubrosFaltantes' && faltantes.length) {
            const btn = document.getElementById('btnConfirmarImport');
            if (typeof setBusyButton === 'function') setBusyButton(btn, false);
            const ok = await vtModalRubrosFaltantes(faltantes);
            if (!ok) {
                const host = document.getElementById('vtConfirmResult');
                if (host) host.innerHTML = '';
                return;
            }
            if (typeof setBusyButton === 'function') setBusyButton(btn, true, { label: 'Importando...' });
            const host = document.getElementById('vtConfirmResult');
            if (host) {
                host.innerHTML = '<div class="vt-result-ok vt-result-summary vt-result-loading">'
                    + '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>'
                    + 'Importando ventas…</div>';
            }
            return confirmarConOpcion(archivos, reemplazar, true);
        }

        const wrapped = Array.isArray(data)
            ? { ok: data.length > 0 && data.every(x => x.Ok), mensaje: '', resultados: data }
            : {
                ok: data.ok === true || data.Ok === true,
                mensaje: data.mensaje || data.Mensaje || '',
                resultados: data.resultados || data.Resultados || [],
                lineas: data.lineasImportadas ?? data.LineasImportadas ?? 0,
                nuevos: data.archivosNuevos ?? data.ArchivosNuevos ?? 0,
                actualizados: data.archivosActualizados ?? data.ArchivosActualizados ?? 0
            };
        const results = wrapped.resultados || [];
        if (!results.length && !wrapped.mensaje) {
            throw new Error(r.ok ? 'Sin resultado' : 'No se pudo confirmar la importación.');
        }
        const host = document.getElementById('vtConfirmResult');
        const detalle = results.map(x => {
            if (!x.Ok) return `<div class="vt-result-err">${escapeHtml(x.NombreArchivo)}: ${escapeHtml(x.Error || 'Error')}</div>`;
            const tag = x.Reemplazo ? 'Actualizada (ya existía)' : 'Importada';
            return `<div class="vt-result-ok">${escapeHtml(x.NombreArchivo)}: ${tag} — ${x.Lineas || 0} líneas (#${x.Id})</div>`;
        }).join('');

        const resumen = wrapped.mensaje
            || (wrapped.ok
                ? `Se importaron ${wrapped.lineas || 0} líneas de ventas.`
                : 'No se pudo importar.');

        host.innerHTML = `<div class="${wrapped.ok ? 'vt-result-ok' : 'vt-result-err'} vt-result-summary">${escapeHtml(resumen)}</div>${detalle}`;

        if (wrapped.ok) {
            if (typeof exitoModal === 'function') exitoModal(resumen);
            else await vtAviso(resumen, { soloOk: true, title: 'Importación' });
            setTimeout(() => window.location.href = '/Ventas', 1100);
        } else {
            if (typeof errorModal === 'function') errorModal(resumen);
            throw new Error(resumen);
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        locales = await loadLocales();
        const input = document.getElementById('vtFiles');
        const zone = document.getElementById('vtDropZone');
        document.getElementById('btnElegirArchivos').addEventListener('click', () => input.click());
        input.addEventListener('change', () => uploadFiles(input.files));
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('is-dragover');
            uploadFiles(e.dataTransfer.files);
        });
        document.getElementById('btnConfirmarImport').addEventListener('click', confirmar);

        document.getElementById('vtPreviewHost').addEventListener('click', e => {
            const card = e.target.closest('.vt-file-card');
            if (!card) return;
            const fi = Number(card.dataset.fi);
            if (e.target.closest('.vt-remove-file')) {
                previews.splice(fi, 1);
                render();
                return;
            }
            const tr = e.target.closest('tr');
            if (tr && e.target.closest('.vt-del')) {
                const li = Number(tr.dataset.li);
                if (previews[fi]?.Lineas[li]) {
                    previews[fi].Lineas[li].Incluir = false;
                    render();
                }
            }
        });

        document.getElementById('vtPreviewHost').addEventListener('change', e => {
            if (e.target.classList.contains('vt-chk')) {
                const tr = e.target.closest('tr');
                if (tr) {
                    // Checked = incluir → sin tachado; unchecked = excluir → tachado
                    tr.classList.toggle('excluir', !e.target.checked);
                }
            }
            if (e.target.classList.contains('vt-chk') || e.target.classList.contains('vt-cant') ||
                e.target.classList.contains('vt-precio') || e.target.classList.contains('vt-sub') ||
                e.target.classList.contains('vt-desc') || e.target.classList.contains('vt-local') ||
                e.target.classList.contains('vt-fecha')) {
                syncFromDom();
                refreshMetaTotals();
            }
        });
    });
})();
