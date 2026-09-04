/* ============================================================================
 * Cuentas.js — Administración de cuentas de fondos y catálogos de tesorería
 * ========================================================================== */

/**
 * Definición de los tres catálogos simples que se administran en esta pantalla.
 * Cada uno declara su endpoint, sus campos y cómo se resume cada fila; el resto
 * del ABM es genérico.
 */
const CU_CATALOGOS = {
    categorias: {
        titulo: 'Categoría de gasto',
        icono: 'tags',
        contenedor: 'cuCatCategorias',
        base: '/GastosCategorias',
        campos: [
            { id: 'Nombre', label: 'Nombre', tipo: 'text', requerido: true, full: true, maxlength: 100 },
            { id: 'IdPadre', label: 'Categoría padre', tipo: 'select', origen: 'self', vacio: 'Sin padre' },
            { id: 'Icono', label: 'Icono', tipo: 'icono' },
            { id: 'Color', label: 'Color', tipo: 'color', valor: '#c9a24a' },
            { id: 'Orden', label: 'Orden', tipo: 'number', valor: 50 },
            { id: 'Activa', label: 'Activa', tipo: 'switch', valor: true, full: true }
        ],
        resumen: c => ({
            titulo: (c.Icono ? `<i class="fa fa-${TS.icono(c.Icono)}"></i> ` : '') + TS.html(c.Nombre),
            meta: c.Padre ? `Dentro de ${TS.html(c.Padre)}` : 'Categoría principal',
            inactivo: c.Activa === false
        })
    },

    mediosPago: {
        titulo: 'Medio de pago',
        icono: 'credit-card',
        contenedor: 'cuCatMediosPago',
        base: '/MediosPago',
        campos: [
            { id: 'Nombre', label: 'Nombre', tipo: 'text', requerido: true, full: true, maxlength: 100 },
            { id: 'IdCuentaDefecto', label: 'Cuenta por defecto', tipo: 'select', origen: 'cuentas', vacio: 'Sin cuenta fija', full: true },
            { id: 'Orden', label: 'Orden', tipo: 'number', valor: 50 },
            { id: 'AfectaCaja', label: 'Mueve el libro de caja', tipo: 'switch', valor: true, full: true },
            { id: 'Activo', label: 'Activo', tipo: 'switch', valor: true, full: true }
        ],
        resumen: m => ({
            titulo: TS.html(m.Nombre),
            meta: [m.CuentaDefecto ? `Cuenta: ${TS.html(m.CuentaDefecto)}` : null,
                   m.AfectaCaja ? 'Impacta caja' : 'No impacta caja'].filter(Boolean).join(' · '),
            inactivo: m.Activo === false
        })
    },

    tiposCuenta: {
        titulo: 'Tipo de cuenta',
        icono: 'sitemap',
        contenedor: 'cuCatTiposCuenta',
        base: '/CuentasTipos',
        campos: [
            { id: 'Nombre', label: 'Nombre', tipo: 'text', requerido: true, full: true, maxlength: 100 },
            { id: 'EsEfectivo', label: 'Cuenta como efectivo', tipo: 'switch', full: true }
        ],
        resumen: t => ({
            titulo: TS.html(t.Nombre),
            meta: t.EsEfectivo ? 'Se suma al efectivo del tablero' : 'Cuenta bancaria o digital'
        })
    }
};

const cuEstado = {
    cuentas: [],
    catalogos: null,
    datos: { categorias: [], mediosPago: [], tiposCuenta: [] },
    catalogoActivo: null
};

$(document).ready(async function () {
    document.getElementById('cuBtnNueva').addEventListener('click', () => cuAbrirModal(null));
    document.getElementById('cuBtnGuardar').addEventListener('click', busyHandler(cuGuardar));
    document.getElementById('cuVerInactivas').addEventListener('change', cuCargarCuentas);
    document.getElementById('cuTipo').addEventListener('change', cuSincronizarTipo);
    document.getElementById('catBtnGuardar').addEventListener('click', busyHandler(cuGuardarCatalogo));

    document.querySelectorAll('[data-nuevo]').forEach(btn =>
        btn.addEventListener('click', () => cuAbrirModalCatalogo(btn.dataset.nuevo, null)));

    await cuCargarCatalogos();
    await Promise.all([cuCargarCuentas(), cuCargarTodosLosCatalogos()]);
});

/* ═════════════════════════════ Catálogos base ═════════════════════════════ */

async function cuCargarCatalogos() {
    try {
        const cat = await TS.catalogos(true);
        cuEstado.catalogos = cat;
        TS.llenar('#cuTipo', cat.TiposCuenta, { vacio: false });
        TS.llenar('#cuLocal', cat.Locales, { vacio: 'Sin local' });
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar los catálogos: ' + err.message);
    }
}

/* ═════════════════════════════ Cuentas ═════════════════════════════ */

async function cuCargarCuentas() {
    TS.loading('cuLoading', true);

    try {
        const verInactivas = document.getElementById('cuVerInactivas').checked;
        const cuentas = await TS.get('/Cuentas/ListaConSaldos', { soloActivas: !verInactivas });
        cuEstado.cuentas = cuentas || [];
        cuPintarCuentas();
    } catch (err) {
        console.error(err);
        errorModal('No se pudieron cargar las cuentas: ' + err.message);
    } finally {
        TS.loading('cuLoading', false);
    }
}

function cuPintarCuentas() {
    const cont = document.getElementById('cuGrid');
    const total = cuEstado.cuentas.filter(c => c.Activa).reduce((a, c) => a + Number(c.Saldo ?? 0), 0);

    document.getElementById('cuPillTotal').innerHTML =
        `<i class="fa fa-balance-scale"></i>Total activo <strong>${TS.money(total)}</strong>`;

    if (!cuEstado.cuentas.length) {
        cont.innerHTML = TS.vacio('No hay cuentas', 'Creá la primera cuenta para empezar a operar.', 'briefcase');
        return;
    }

    cont.innerHTML = cuEstado.cuentas.map(c => {
        const negativo = Number(c.Saldo ?? 0) < 0 ? ' is-negativo' : '';
        const etiquetas = [
            c.Activa ? TS.badge('Activa', 'sage', 'check') : TS.badge('Inactiva', 'muted', 'pause'),
            c.PermiteNegativo ? TS.badge('Descubierto', 'violet', 'level-down') : '',
            c.Moneda && c.Moneda !== 'ARS' ? TS.badge(c.Moneda, 'sky') : ''
        ].filter(Boolean).join('');

        return `
            <div class="ts-cuenta${c.Activa ? '' : ' is-inactiva'}">
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
                <div class="ts-cuenta-meta"><span class="ts-chips">${etiquetas}</span></div>
                <div class="ts-cuenta-meta">
                    <span class="ts-cuenta-flow">
                        <span class="is-in"><i class="fa fa-arrow-down"></i>${TS.moneyCorto(c.Ingresos)}</span>
                        <span class="is-out"><i class="fa fa-arrow-up"></i>${TS.moneyCorto(c.Egresos)}</span>
                    </span>
                    <span>${c.Movimientos || 0} mov.</span>
                </div>
                <div class="ts-cuenta-acciones">
                    <a class="ts-btn ts-btn--ghost ts-btn--sm" href="/Cajas?idCuenta=${c.Id}" title="Ver movimientos">
                        <i class="fa fa-list"></i>
                    </a>
                    <button type="button" class="ts-btn ts-btn--ghost ts-btn--sm" data-editar="${c.Id}" title="Editar">
                        <i class="fa fa-pencil"></i>
                    </button>
                    <button type="button" class="ts-btn ts-btn--ghost ts-btn--sm" data-estado="${c.Id}"
                            title="${c.Activa ? 'Desactivar' : 'Reactivar'}">
                        <i class="fa fa-${c.Activa ? 'pause' : 'play'}"></i>
                    </button>
                    <button type="button" class="ts-btn ts-btn--out ts-btn--sm" data-eliminar="${c.Id}" title="Eliminar">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>`;
    }).join('');

    cont.querySelectorAll('[data-editar]').forEach(b =>
        b.addEventListener('click', () => cuAbrirModal(Number(b.dataset.editar))));
    cont.querySelectorAll('[data-estado]').forEach(b =>
        b.addEventListener('click', () => cuCambiarEstado(Number(b.dataset.estado))));
    cont.querySelectorAll('[data-eliminar]').forEach(b =>
        b.addEventListener('click', () => cuEliminar(Number(b.dataset.eliminar))));
}

async function cuAbrirModal(id) {
    const esEdicion = !!id;
    document.getElementById('cuModalTitulo').textContent = esEdicion ? 'Editar cuenta' : 'Nueva cuenta';
    document.getElementById('cuId').value = id || 0;

    const saldoInicial = document.getElementById('cuSaldoInicial');
    document.getElementById('cuSaldoInicialHint').textContent = esEdicion
        ? 'Ojo: al cambiarlo se corre el saldo actual de la cuenta.'
        : 'Es el punto de partida del saldo, antes de cualquier movimiento.';

    if (!esEdicion) {
        document.getElementById('cuNombre').value = '';
        document.getElementById('cuTipo').selectedIndex = 0;
        document.getElementById('cuLocal').value = '';
        document.getElementById('cuMoneda').value = 'ARS';
        saldoInicial.value = '';
        ['cuBanco', 'cuTitular', 'cuCbu', 'cuAlias'].forEach(i => document.getElementById(i).value = '');
        document.getElementById('cuIcono').value = '';
        document.getElementById('cuColor').value = '#c9a24a';
        document.getElementById('cuOrden').value = 50;
        document.getElementById('cuPermiteNegativo').checked = false;
        document.getElementById('cuActiva').checked = true;
        cuSincronizarTipo();
        TS.modal('#mdlCuenta').show();
        return;
    }

    try {
        const c = await TS.get('/Cuentas/Obtener', { id });
        document.getElementById('cuNombre').value = c.Nombre || '';
        document.getElementById('cuTipo').value = c.IdTipo || '';
        document.getElementById('cuLocal').value = c.IdLocal || '';
        document.getElementById('cuMoneda').value = c.Moneda || 'ARS';
        saldoInicial.value = c.SaldoInicial ?? 0;
        document.getElementById('cuBanco').value = c.Banco || '';
        document.getElementById('cuTitular').value = c.Titular || '';
        document.getElementById('cuCbu').value = c.Cbu || '';
        document.getElementById('cuAlias').value = c.Alias || '';
        document.getElementById('cuIcono').value = c.Icono || '';
        document.getElementById('cuColor').value = c.Color || '#c9a24a';
        document.getElementById('cuOrden').value = c.Orden ?? 50;
        document.getElementById('cuPermiteNegativo').checked = !!c.PermiteNegativo;
        document.getElementById('cuActiva').checked = !!c.Activa;

        cuSincronizarTipo();
        TS.modal('#mdlCuenta').show();
    } catch (err) {
        console.error(err);
        errorModal('No se pudo cargar la cuenta: ' + err.message);
    }
}

/** Los datos bancarios sólo aplican a cuentas que no son de efectivo. */
function cuSincronizarTipo() {
    const idTipo = Number(document.getElementById('cuTipo').value || 0);
    const tipo = (cuEstado.catalogos?.TiposCuenta || []).find(t => t.Id === idTipo);
    const esEfectivo = !!tipo?.EsEfectivo;

    document.getElementById('cuBloqueBanco').style.display = esEfectivo ? 'none' : 'block';
}

async function cuGuardar() {
    const nombre = document.getElementById('cuNombre').value.trim();
    const idTipo = Number(document.getElementById('cuTipo').value || 0);

    if (!nombre) return advertenciaModal('Ponele un nombre a la cuenta.');
    if (!idTipo) return advertenciaModal('Elegí el tipo de cuenta.');

    const id = Number(document.getElementById('cuId').value || 0);

    const r = await TS.ejecutar(TS.post('/Cuentas/Guardar', {
        Id: id,
        Nombre: nombre,
        IdTipo: idTipo,
        IdLocal: Number(document.getElementById('cuLocal').value || 0) || null,
        Moneda: document.getElementById('cuMoneda').value || 'ARS',
        SaldoInicial: TS.leerDecimal(document.getElementById('cuSaldoInicial')),
        Banco: document.getElementById('cuBanco').value.trim() || null,
        Titular: document.getElementById('cuTitular').value.trim() || null,
        Cbu: document.getElementById('cuCbu').value.trim() || null,
        Alias: document.getElementById('cuAlias').value.trim() || null,
        Icono: document.getElementById('cuIcono').value || null,
        Color: document.getElementById('cuColor').value || null,
        Orden: Number(document.getElementById('cuOrden').value || 50),
        RequiereArqueo: false,
        PermiteNegativo: document.getElementById('cuPermiteNegativo').checked,
        Activa: document.getElementById('cuActiva').checked
    }));

    if (!r) return;
    TS.modal('#mdlCuenta').hide();
    await cuCargarCuentas();
    await cuCargarCatalogos();
}

async function cuCambiarEstado(id) {
    const cuenta = cuEstado.cuentas.find(c => c.Id === id);
    if (!cuenta) return;

    const activa = !cuenta.Activa;
    const ok = await confirmarModal(activa
        ? `¿Reactivar la cuenta "${cuenta.Nombre}"?`
        : `¿Desactivar la cuenta "${cuenta.Nombre}"? Deja de aparecer en los combos, pero sus movimientos se conservan.`);
    if (!ok) return;

    const r = await TS.ejecutar(TS.post(`/Cuentas/CambiarEstado?${TS.qs({ id, activa })}`));
    if (!r) return;

    await cuCargarCuentas();
    await cuCargarCatalogos();
}

async function cuEliminar(id) {
    const cuenta = cuEstado.cuentas.find(c => c.Id === id);
    if (!cuenta) return;

    await eliminarConCascada({
        url: `/Cuentas/Eliminar?id=${id}`,
        headers: () => TS.headers(),
        confirmMsg: `¿Eliminar la cuenta "${cuenta.Nombre}"? Si tiene movimientos conviene desactivarla en lugar de borrarla.`,
        onSuccess: async j => {
            exitoModal(j.mensaje || 'Cuenta eliminada.');
            await cuCargarCuentas();
            await cuCargarCatalogos();
        }
    });
}

/* ═════════════════════════ Catálogos simples ═════════════════════════ */

async function cuCargarTodosLosCatalogos() {
    await Promise.all(Object.keys(CU_CATALOGOS).map(cuCargarCatalogo));
}

async function cuCargarCatalogo(clave) {
    const def = CU_CATALOGOS[clave];
    const cont = document.getElementById(def.contenedor);

    try {
        const items = await TS.get(`${def.base}/Lista`);
        cuEstado.datos[clave] = items || [];

        if (!items?.length) {
            cont.innerHTML = TS.vacio('Sin registros', `Agregá el primer ${def.titulo.toLowerCase()}.`, def.icono);
            return;
        }

        cont.innerHTML = items.map(item => {
            const r = def.resumen(item);
            return `
                <div class="ts-pago${r.inactivo ? ' is-anulado' : ''}">
                    <div class="ts-pago-body">
                        <div class="ts-pago-title">${r.titulo}</div>
                        <div class="ts-pago-meta">${r.meta || ''}</div>
                    </div>
                    <button type="button" class="ts-btn ts-btn--ghost ts-btn--sm" data-editar="${item.Id}" title="Editar">
                        <i class="fa fa-pencil"></i>
                    </button>
                    <button type="button" class="ts-btn ts-btn--out ts-btn--sm" data-eliminar="${item.Id}" title="Eliminar">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>`;
        }).join('');

        cont.querySelectorAll('[data-editar]').forEach(b =>
            b.addEventListener('click', () => cuAbrirModalCatalogo(clave, Number(b.dataset.editar))));
        cont.querySelectorAll('[data-eliminar]').forEach(b =>
            b.addEventListener('click', () => cuEliminarCatalogo(clave, Number(b.dataset.eliminar))));
    } catch (err) {
        console.error(err);
        cont.innerHTML = TS.vacio('Error', err.message, 'exclamation-triangle');
    }
}

const CU_ICONOS = ['tags', 'bolt', 'tint', 'fire', 'wifi', 'home', 'car', 'wrench', 'users',
    'shopping-cart', 'gavel', 'shield', 'phone', 'truck', 'leaf', 'credit-card', 'money', 'bank'];

function cuAbrirModalCatalogo(clave, id) {
    const def = CU_CATALOGOS[clave];
    const item = id ? cuEstado.datos[clave].find(i => i.Id === id) : null;

    cuEstado.catalogoActivo = clave;
    document.getElementById('catId').value = id || 0;
    document.getElementById('catTitulo').textContent = item ? `Editar ${def.titulo.toLowerCase()}` : `Nuevo ${def.titulo.toLowerCase()}`;
    document.getElementById('catSub').textContent = def.titulo;
    document.getElementById('catMark').innerHTML = `<i class="fa fa-${def.icono}"></i>`;

    document.getElementById('catCampos').innerHTML = def.campos.map(campo => {
        const valor = item ? item[campo.id] : campo.valor;
        return `<div${campo.full ? ' class="ts-col-full"' : ''}>${cuCampoHtml(campo, valor, clave, id)}</div>`;
    }).join('');

    TS.modal('#mdlCatalogo').show();
}

function cuCampoHtml(campo, valor, clave, idActual) {
    const label = `<label class="ts-form-label" for="cat_${campo.id}">${TS.html(campo.label)}` +
        `${campo.requerido ? ' <span class="ts-req">*</span>' : ''}</label>`;

    switch (campo.tipo) {
        case 'switch':
            return `<div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="cat_${campo.id}" ${valor ? 'checked' : ''} />
                        <label class="form-check-label" for="cat_${campo.id}">${TS.html(campo.label)}</label>
                    </div>`;

        case 'color':
            return `${label}<input type="color" class="form-control form-control-color" id="cat_${campo.id}" value="${TS.html(valor || '#c9a24a')}" />`;

        case 'number':
            return `${label}<input type="number" class="form-control" id="cat_${campo.id}" value="${valor ?? 0}" step="1" min="0" />`;

        case 'icono': {
            const opciones = ['', ...CU_ICONOS].map(i =>
                `<option value="${i}"${i === (valor || '') ? ' selected' : ''}>${i || 'Sin icono'}</option>`).join('');
            return `${label}<select class="form-select" id="cat_${campo.id}">${opciones}</select>`;
        }

        case 'select': {
            // "self" arma la lista con el propio catálogo, excluyendo el registro editado
            // para que no pueda ser padre de sí mismo.
            const origen = campo.origen === 'self'
                ? cuEstado.datos[clave].filter(i => i.Id !== idActual)
                : (cuEstado.catalogos?.Cuentas || []);
            const opciones = [`<option value="">${TS.html(campo.vacio || 'Sin asignar')}</option>`]
                .concat(origen.map(o =>
                    `<option value="${o.Id}"${String(o.Id) === String(valor ?? '') ? ' selected' : ''}>${TS.html(o.Nombre)}</option>`))
                .join('');
            return `${label}<select class="form-select" id="cat_${campo.id}">${opciones}</select>`;
        }

        default:
            return `${label}<input type="text" class="form-control" id="cat_${campo.id}"
                        maxlength="${campo.maxlength || 100}" value="${TS.html(valor ?? '')}" />`;
    }
}

async function cuGuardarCatalogo() {
    const clave = cuEstado.catalogoActivo;
    const def = CU_CATALOGOS[clave];
    const id = Number(document.getElementById('catId').value || 0);

    const model = { Id: id };
    for (const campo of def.campos) {
        const el = document.getElementById(`cat_${campo.id}`);
        if (!el) continue;

        let valor;
        if (campo.tipo === 'switch') valor = el.checked;
        else if (campo.tipo === 'number') valor = Number(el.value || 0);
        else if (campo.tipo === 'select') valor = Number(el.value || 0) || null;
        else valor = el.value.trim() || null;

        if (campo.requerido && !valor) return advertenciaModal(`${campo.label} es obligatorio.`);
        model[campo.id] = valor;
    }

    const r = await TS.ejecutar(TS.post(`${def.base}/Guardar`, model));
    if (!r) return;

    TS.modal('#mdlCatalogo').hide();
    await cuCargarCatalogo(clave);
    await cuCargarCatalogos();
}

async function cuEliminarCatalogo(clave, id) {
    const def = CU_CATALOGOS[clave];
    const item = cuEstado.datos[clave].find(i => i.Id === id);

    await eliminarConCascada({
        url: `${def.base}/Eliminar?id=${id}`,
        headers: () => TS.headers(),
        confirmMsg: `¿Eliminar "${item?.Nombre || ''}"?`,
        onSuccess: async j => {
            exitoModal(j.mensaje || 'Registro eliminado.');
            await cuCargarCatalogo(clave);
            await cuCargarCatalogos();
        }
    });
}
