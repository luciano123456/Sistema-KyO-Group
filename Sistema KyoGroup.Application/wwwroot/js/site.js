const token = localStorage.getItem('JwtToken');

async function MakeAjax(options) {
    return $.ajax({
        type: options.type,
        url: options.url,
        async: options.async,
        data: options.data,
        dataType: options.dataType,
        contentType: options.contentType
    });
}


async function MakeAjaxFormData(options) {
    return $.ajax({
        type: options.type,
        url: options.url,
        async: options.async,
        data: options.data,
        dataType: false,
        contentType: false,
        isFormData: true,
        processData: false
    });
}


// Formatear el número de manera correcta
function formatNumber(number) {
    if (typeof number !== 'number' || isNaN(number)) {
        return "$ 0,00"; // Si el número no es válido, retornar un valor por defecto
    }

    // Asegurarse de que el número tenga dos decimales
    const parts = number.toFixed(2).split("."); // Dividir en parte entera y decimal

    // Formatear la parte entera con puntos como separadores de miles
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "."); // Usar punto para miles

    // Devolver el número con la coma como separador decimal
    return "$ " + parts.join(",");
}



function mostrarModalConContador(modal, texto, tiempo) {
    $(`#${modal}Text`).text(texto);
    $(`#${modal}`).modal('show');

    setTimeout(function () {
        $(`#${modal}`).modal('hide');
    }, tiempo);
}

function exitoModal(texto) {
    mostrarModalConContador('exitoModal', texto, 1000);
}

function errorModal(texto) {
    mostrarModalConContador('ErrorModal', texto, 3000000);
}

function advertenciaModal(texto) {
    mostrarModalConContador('AdvertenciaModal', texto, 3000);
}

function confirmarModal(mensaje) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('modalConfirmar');
        const mensajeEl = document.getElementById('modalConfirmarMensaje');
        const btnAceptar = document.getElementById('btnModalConfirmarAceptar');

        mensajeEl.innerText = mensaje;

        const modal = new bootstrap.Modal(modalEl, {
            backdrop: 'static',
            keyboard: false
        });

        // Flag para que no resuelva dos veces
        let resuelto = false;

        // Limpia todos los listeners anteriores
        modalEl.replaceWith(modalEl.cloneNode(true));
        // Re-obtener referencias luego de clonar
        const nuevoModalEl = document.getElementById('modalConfirmar');
        const nuevoBtnAceptar = document.getElementById('btnModalConfirmarAceptar');

        const nuevoModal = new bootstrap.Modal(nuevoModalEl, {
            backdrop: 'static',
            keyboard: false
        });

        nuevoBtnAceptar.onclick = function () {
            if (resuelto) return;
            resuelto = true;
            resolve(true);
            nuevoModal.hide();
        };

        nuevoModalEl.addEventListener('hidden.bs.modal', () => {
            if (resuelto) return;
            resuelto = true;
            resolve(false);
        }, { once: true });

        nuevoModal.show();
    });
}


const formatoMoneda = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS', // Cambia "ARS" por el código de moneda que necesites
    minimumFractionDigits: 2
});

function convertirMonedaAFloat(moneda) {
    // Eliminar el símbolo de la moneda y otros caracteres no numéricos
    const soloNumeros = moneda.replace(/[^0-9,.-]/g, '');

    // Eliminar separadores de miles y convertir la coma en punto
    const numeroFormateado = soloNumeros.replace(/\./g, '').replace(',', '.');

    // Convertir a flotante
    const numero = parseFloat(numeroFormateado);

    // Devolver el número formateado como cadena, asegurando los decimales
    return numero.toFixed(2); // Asegura siempre dos decimales en la salida
}
function convertirAMonedaDecimal(valor) {
    // Reemplazar coma por punto
    if (typeof valor === 'string') {
        valor = valor.replace(',', '.'); // Cambiar la coma por el punto
    }
    // Convertir a número flotante
    return parseFloat(valor);
}

function formatoNumero(valor) {
    // Reemplaza la coma por punto y elimina otros caracteres no numéricos (como $)
    return parseFloat(valor.replace(/[^0-9,]+/g, '').replace(',', '.')) || 0;
}

function parseDecimal(value) {
    return parseFloat(value.replace(',', '.'));
}


function formatMoneda(valor) {
    // Convertir a string, cambiar el punto decimal a coma y agregar separadores de miles
    let formateado = valor
        .toString()
        .replace('.', ',') // Cambiar punto decimal a coma
        .replace(/\B(?=(\d{3})+(?!\d))/g, "."); // Agregar separadores de miles

    // Agregar el símbolo $ al inicio
    return `$ ${formateado}`;
}


function toggleAcciones(id) {
    const dropdown = document.querySelector(`.acciones-menu[data-id='${id}'] .acciones-dropdown`);
    const isVisible = dropdown.style.display === 'block';

    // Oculta todos los demás menús desplegables
    document.querySelectorAll('.acciones-dropdown').forEach(el => el.style.display = 'none');

    if (!isVisible) {
        // Muestra el menú
        dropdown.style.display = 'block';

        // Obtén las coordenadas del botón
        const menuButton = document.querySelector(`.acciones-menu[data-id='${id}']`);
        const rect = menuButton.getBoundingClientRect();

        // Mueve el menú al body y ajusta su posición
        const dropdownClone = dropdown.cloneNode(true);
        dropdownClone.style.position = 'fixed';
        dropdownClone.style.left = `${rect.left}px`;
        dropdownClone.style.top = `${rect.bottom}px`;
        dropdownClone.style.zIndex = '10000';
        dropdownClone.style.display = 'block';

        // Limpia menús previos si es necesario
        document.querySelectorAll('.acciones-dropdown-clone').forEach(clone => clone.remove());

        dropdownClone.classList.add('acciones-dropdown-clone');
        document.body.appendChild(dropdownClone);
    }
}



function formatearFechaParaInput(fecha) {
    const m = moment(fecha, [moment.ISO_8601, 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD']);
    return m.isValid() ? m.format('YYYY-MM-DD') : '';
}

function formatearFechaParaVista(fecha) {
    const m = moment(fecha, [moment.ISO_8601, 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD']);
    return m.isValid() ? m.format('DD/MM/YYYY') : '';
}

function formatearMiles(valor) {
    let num = String(valor).replace(/\D/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatearSinMiles(valor) {
    if (!valor) return 0;

    // Si no tiene puntos, devolvés directamente el número original
    if (!valor.includes('.')) return parseFloat(valor) || 0;

    const limpio = valor.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(limpio);
    return isNaN(num) ? 0 : num;
}


let audioContext = null;
let audioBuffer = null;


function llenarSelect(selectId, data, valueField = 'Id', textField = 'Nombre', conOpcionVacia = true) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = conOpcionVacia ? '<option value="">Seleccione</option>' : '';
    (data || []).forEach(it => {
        const opt = document.createElement('option');
        opt.value = it[valueField];
        opt.textContent = it[textField];
        sel.appendChild(opt);
    });
}


/**
* Inicializa Select2 "como select normal" en un scope reutilizable.
* Evita dobles inits, asegura placeholder real y arregla el dropdown dentro de paneles colapsables.
*
* @param {string} selectSel   selector del <select> (ej: '#ClientesFiltro')
* @param {string} scopeSel    contenedor (por defecto '#formFiltros')
* @param {string} placeholder texto placeholder (por defecto 'Todos')
*/
// Reemplazar en Pedidos.js
function initSelect2Simple(selector, dropdownParentSelector, placeholderText, todosValue = -1) {
    const $el = $(selector);
    if (!$el.length) return;

    // Evita doble init
    if ($el.data('select2')) $el.select2('destroy');

    // Asegurá que exista la opción "Todos" (valor -1 por defecto)
    if (!$el.find(`option[value="${todosValue}"]`).length) {
        $el.prepend(new Option('Todos', todosValue));
    }

    // No agregamos opción vacía: queremos que "clear" vuelva a -1
    const $parent = $(dropdownParentSelector);
    $el.select2({
        placeholder: placeholderText || 'Todos',
        allowClear: true,              // deja la "x"
        width: '100%',
        dropdownParent: $parent.length ? $parent : $('body')
    });

    // Al hacer clear (click en la "x"), volver a -1 (Todos)
    $el.on('select2:clear', function () {
        // Pequeño defer para no pelear con el clear interno
        setTimeout(() => {
            $el.val(String(todosValue)).trigger('change.select2');
        }, 0);
    });

    // Si por cualquier motivo queda vacío, forzamos -1
    $el.on('change', function () {
        const v = $el.val();
        if (v === null || v === '') {
            $el.val(String(todosValue)).trigger('change.select2');
        }
    });

    // Limpia posibles nodos de texto sueltos (evita “Todos” duplicado)
    $el.parent().contents().filter(function () {
        return this.nodeType === 3 && this.nodeValue.trim() !== '';
    }).remove();
}



function fmtFechaAR(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function setInfoAuditoria(vm) {
    const el = document.getElementById('lblUltimaModif');
    if (!el) return;

    // Si tiene modificación, mostramos última modif; si no, mostramos creado por
    if (vm.FechaModifica && vm.UsuarioModifica) {
        el.textContent = `Última modificación: ${vm.UsuarioModifica} — ${fmtFechaAR(vm.FechaModifica)}`;
    } else if (vm.FechaRegistra && vm.UsuarioRegistra) {
        el.textContent = `Creado por: ${vm.UsuarioRegistra} — ${fmtFechaAR(vm.FechaRegistra)}`;
    } else if (vm.FechaRegistra) {
        el.textContent = `Creado el ${fmtFechaAR(vm.FechaRegistra)}`;
    } else {
        el.textContent = "";
    }
}


/* =========================================================================
 * cc.validators.js  — Validaciones genéricas para pantallas y modales
 * ========================================================================= */

(function (w) {
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    const hasFn = name => typeof w[name] === 'function';

    function moneyToNumber(v) {
        try {
            if (hasFn('convertirMonedaAFloat')) return parseFloat(convertirMonedaAFloat(v));
            // Fallback robusto
            if (typeof v === 'number') return v;
            const s = String(v ?? '').replace(/\s/g, '');
            // admite $ . , negativos
            const cleaned = s.replace(/[^0-9,\.\-]/g, '');
            // si tiene coma y punto, asumimos coma decimal
            if (cleaned.includes(',') && cleaned.includes('.')) {
                const lastComma = cleaned.lastIndexOf(',');
                const a = cleaned.slice(0, lastComma).replace(/[^\d\-]/g, '');
                const b = cleaned.slice(lastComma + 1).replace(/[^\d]/g, '');
                return parseFloat(`${a}.${b}`);
            }
            // si solo tiene coma, la usamos como decimal
            if (cleaned.includes(',') && !cleaned.includes('.')) {
                return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
            }
            return parseFloat(cleaned.replace(/,/g, ''));
        } catch { return 0; }
    }

    function isEmpty(v) {
        if (v === null || v === undefined) return true;
        if (typeof v === 'string') return v.trim() === '';
        return false;
    }

    function showError(input, message) {
        input.classList.add('is-invalid');
        const fb = input.parentElement?.querySelector('.invalid-feedback');
        if (fb) {
            fb.textContent = message || fb.getAttribute('data-msg-required') || 'Campo requerido';
            fb.classList.remove('d-none');
        }
    }
    function showMinError(input) {
        input.classList.add('is-invalid');
        const fb = input.parentElement?.querySelector('.invalid-feedback');
        if (fb) {
            fb.textContent = fb.getAttribute('data-msg-min') || 'Valor inválido';
            fb.classList.remove('d-none');
        }
    }
    function clearError(input) {
        input.classList.remove('is-invalid');
        const fb = input.parentElement?.querySelector('.invalid-feedback');
        if (fb) fb.classList.add('d-none');
    }

    function validateInput(input, opts = {}) {
        const required = input.dataset.required === 'true' || opts.required;

        // ✅ Aceptar data-min o data-gt
        const minAttr = (input.dataset.min ?? input.dataset.gt);
        const min = (minAttr !== undefined && minAttr !== null)
            ? parseFloat(minAttr)
            : (opts.min ?? null);

        if (required) {
            const val = input.value;
            if (isEmpty(val) || val === '-1') return { valid: false, why: 'required' };
        }

        if (min !== null && !isNaN(min)) {
            const num = (input.type === 'number') ? parseFloat(input.value) : moneyToNumber(input.value);
            if (!(isFinite(num) && num > min - 1e-15)) return { valid: false, why: 'min' };
        }
        return { valid: true };
    }

    function autoHideOnInput(scope, alertEl) {
        const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
        const fields = $$('[data-required], [data-min], [data-gt]', scope);

        fields.forEach(el => {
            ['input', 'change', 'blur'].forEach(evt => {
                el.addEventListener(evt, () => {
                    const res = validateInput(el);
                    if (!res.valid) {
                        if (res.why === 'required') showError(el);
                        else if (res.why === 'min') showMinError(el);
                        alertEl?.classList.remove('d-none');             // 🔔 mostrar banner
                    } else {
                        clearError(el);
                    }
                    const allOk = $$('[data-required], [data-min], [data-gt]', scope)
                        .every(x => validateInput(x).valid);
                    if (allOk) alertEl?.classList.add('d-none');       // ✅ ocultar cuando todo ok
                });
            });
        });
    }



    function bindBlurValidation(scope) {
        $$('[data-required], [data-min]', scope).forEach(el => {
            el.addEventListener('blur', () => {
                const res = validateInput(el);
                if (!res.valid) {
                    if (res.why === 'required') showError(el);
                    else if (res.why === 'min') showMinError(el);
                } else {
                    clearError(el);
                }
            });
            // también en change de selects/inputs para revalidar
            el.addEventListener('change', () => {
                const res = validateInput(el);
                if (!res.valid) {
                    if (res.why === 'required') showError(el);
                    else if (res.why === 'min') showMinError(el);
                } else {
                    clearError(el);
                }
            });
        });
    }

    function validateGroup(scope, alertEl) {
        const fields = $$('[data-required], [data-min]', scope);
        let ok = true;
        fields.forEach(el => {
            const res = validateInput(el);
            if (!res.valid) {
                ok = false;
                if (res.why === 'required') showError(el);
                else if (res.why === 'min') showMinError(el);
            } else {
                clearError(el);
            }
        });
        if (alertEl) {
            if (!ok) alertEl.classList.remove('d-none');
            else alertEl.classList.add('d-none');
        }
        return ok;
    }

    function clearGroup(scope, alertEl) {
        $$('[data-required], [data-min]', scope).forEach(clearError);
        if (alertEl) alertEl.classList.add('d-none');
    }

    // Expose
    w.ccValidators = {
        moneyToNumber,
        validateInput,
        bindBlurValidation,
        validateGroup,
        clearGroup,
        autoHideOnInput      // <— NUEVO
    };
})(window);
