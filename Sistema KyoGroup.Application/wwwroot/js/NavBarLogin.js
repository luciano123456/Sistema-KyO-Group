let listaVacia = false;
let nombreConfiguracion;
let controllerConfiguracion;
let comboNombre;
let comboController;
let lblComboNombre;
let configQuickAddMode = false;

function getCtl() {
    return String(controllerConfiguracion || window.controllerConfiguracion || '').replace(/^\/+|\/+$/g, '');
}

function setConfigModalQuickAddMode(isQuickAdd) {
    const modal = document.getElementById('modalConfiguracion');
    if (modal) modal.classList.toggle('rp-quick-add', !!isQuickAdd);
}

function applyConfigQuickAddUi() {
    setConfigModalQuickAddMode(true);
    agregarConfiguracion();
    const lbl = document.getElementById('modalConfiguracionLabel');
    if (lbl) lbl.innerText = 'Agregar ' + (nombreConfiguracion || 'registro');
    const sub = document.querySelector('#modalConfiguracion .rp-modal-subtitle');
    if (sub) sub.textContent = 'Completa los datos y guarda para usar el nuevo valor en el formulario';
}

function obtenerPrefVistaListados() {
    if (window.RpGridView) return RpGridView.getPref();
    const pref = localStorage.getItem('rpGridViewPref') || localStorage.getItem('cgViewPref') || 'auto';
    return ['auto', 'table', 'cards'].includes(pref) ? pref : 'auto';
}

function syncPreferenciasVisualizacionUi(pref) {
    const val = ['auto', 'table', 'cards'].includes(pref) ? pref : 'auto';
    $('#rpConfigViewOptions .rp-config-view-card').removeClass('is-active');
    $(`#rpConfigViewOptions .rp-config-view-card[data-rp-view="${val}"]`).addClass('is-active');
    const sel = document.getElementById('rpConfigViewMode');
    if (sel) sel.value = val;
}

function guardarPrefVistaListados(pref) {
    const val = ['auto', 'table', 'cards'].includes(pref) ? pref : 'auto';
    localStorage.setItem('rpGridViewPref', val);
    localStorage.setItem('cgViewPref', val);
    syncPreferenciasVisualizacionUi(val);

    if (window.RpGridView) {
        RpGridView.setPref(val);
    } else {
        $('.cg-page, .cl-page, .page-99, .ld-index')
            .removeClass('rp-view-mode-auto rp-view-mode-table rp-view-mode-cards cg-mode-auto cg-mode-table cg-mode-cards')
            .addClass(`rp-view-mode-${val} cg-mode-${val}`);
        $(document).trigger('rpGridViewChanged', [val]);
    }
}

function initPreferenciasVisualizacion() {
    syncPreferenciasVisualizacionUi(obtenerPrefVistaListados());

    $('#rpConfigViewOptions')
        .off('click.rpViewPref')
        .on('click.rpViewPref', '.rp-config-view-card', function (e) {
            e.preventDefault();
            e.stopPropagation();
            guardarPrefVistaListados($(this).data('rpView') || 'auto');
        });
}

function filtrarSeccionesConfiguraciones() {
    const input = document.getElementById('txtBuscarSeccionesConfiguracion');
    const grid = document.getElementById('rpConfigSeccionesGrid');
    const lblVacio = document.getElementById('lblSeccionesConfiguracionVacio');
    if (!input || !grid) return;

    const q = (input.value || '').trim().toLowerCase();
    let visibles = 0;

    grid.querySelectorAll('.rp-config-card').forEach(card => {
        const buscar = (card.getAttribute('data-buscar') || '').toLowerCase();
        const texto = (card.textContent || '').toLowerCase();
        const match = !q || buscar.includes(q) || texto.includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visibles++;
    });

    if (lblVacio) {
        lblVacio.hidden = visibles !== 0;
        if (!visibles) lblVacio.textContent = 'No hay secciones que coincidan con la búsqueda.';
    }
}

/* ---- Resaltar módulo activo en el navbar ---- */
function normalizarNavPath(path) {
    if (!path) return '/';
    let p = String(path).split('?')[0].split('#')[0];
    if (!p.startsWith('/')) p = '/' + p;
    p = p.replace(/\/+$/, '') || '/';
    return p.toLowerCase();
}

function navPathFromHref(href) {
    if (!href || href === '#') return null;
    try {
        return normalizarNavPath(new URL(href, window.location.origin).pathname);
    } catch {
        return null;
    }
}

function navCoincideRuta(href, current) {
    const link = navPathFromHref(href);
    if (!link) return false;
    if (link === current) return true;

    const linkParts = link.split('/').filter(Boolean);
    const curParts = current.split('/').filter(Boolean);
    if (linkParts.length >= 2 && curParts.length >= 2) {
        return linkParts[0] === curParts[0] && linkParts[1] === curParts[1];
    }
    return false;
}

function activarNavModulo(sectionSelector) {
    const section = document.querySelector(sectionSelector);
    if (!section) return;
    section.classList.add('is-module-active');
    const toggle = section.querySelector(':scope > .nav-link');
    if (toggle) toggle.classList.add('active');
}

function initNavbarActiveState() {
    const current = normalizarNavPath(window.location.pathname);
    const parts = current.split('/').filter(Boolean);
    const controller = (parts[0] || '').toLowerCase();
    const action = (parts[1] || 'index').toLowerCase();

    document.querySelectorAll('.rp-navbar .rp-nav-link.active, .rp-navbar .dropdown-item.active, .rp-navbar .nav-item.is-module-active')
        .forEach(el => el.classList.remove('active', 'is-module-active'));

    if (controller === 'usuarios' && action === 'configuracion') return;

    let matched = false;

    document.querySelectorAll('.rp-nav-main .dropdown-item[href]').forEach(item => {
        if (!navCoincideRuta(item.getAttribute('href'), current)) return;
        item.classList.add('active');
        matched = true;
        const dropdown = item.closest('.nav-item.dropdown');
        if (dropdown) {
            dropdown.classList.add('is-module-active');
            dropdown.querySelector('.nav-link.dropdown-toggle')?.classList.add('active');
        }
    });

    document.querySelectorAll('.rp-nav-main > .nav-item:not(.dropdown) .nav-link[href]').forEach(link => {
        if (!navCoincideRuta(link.getAttribute('href'), current)) return;
        link.classList.add('active');
        link.closest('.nav-item')?.classList.add('is-module-active');
        matched = true;
    });

    if (matched) return;

    const moduleByController = {
        dashboard: null,
        proveedores: '#seccionProveedores',
        proveedorescuentacorriente: '#seccionProveedores',
        proveedoresinsumos: '#seccionProveedores',
        compras: '#seccionProveedores',
        ordenescompras: '#seccionProveedores',
        recetas: '#seccionRecetas',
        subrecetas: '#seccionRecetas',
        insumos: '#seccionInsumos',
        ventas: '#seccionVentas',
        tesoreria: '#seccionFinanzas',
        finanzas: '#seccionFinanzas',
        cajas: '#seccionFinanzas',
        gastos: '#seccionFinanzas',
        gastoscategorias: '#seccionFinanzas',
        cuentas: '#seccionFinanzas',
        mediospago: '#seccionFinanzas',
        cuentastipos: '#seccionFinanzas',
        analisisdatos: '#seccionAnalisisDatos',
        usuarios: '#seccionConfiguraciones'
    };

    if (current === '/') {
        activarNavModulo('#seccionProveedores');
        return;
    }

    const sectionSel = moduleByController[controller];
    if (sectionSel) activarNavModulo(sectionSel);
}

document.addEventListener("DOMContentLoaded", function () {

    var userSession = JSON.parse(localStorage.getItem('userSession'));

    if (userSession) {

        document.getElementById("seccionConfiguraciones").removeAttribute("hidden");

        //if (userSession.IdRol == 1 || userSession.IdRol == 3) {
        //    document.getElementById("seccionPuntosDeVenta").removeAttribute("hidden");
        //    document.getElementById("seccionCuentas").removeAttribute("hidden");
        //    document.getElementById("seccionConfiguraciones").removeAttribute("hidden");
        //    document.getElementById("seccionCajas").removeAttribute("hidden");
        //    document.getElementById("seccionOperaciones").removeAttribute("hidden");
        //    document.getElementById("seccionGastos").removeAttribute("hidden");
        //}

        //if (userSession.IdPuntoVenta != null && userSession.IdRol != 1 && userSession.IdRol != 3) {
        //    document.getElementById("seccionCajas").removeAttribute("hidden");
        //    document.getElementById("seccionOperaciones").removeAttribute("hidden");
        //    document.getElementById("seccionGastos").removeAttribute("hidden");
        //}
        // Si el usuario está en el localStorage, actualizar el texto del enlace
        var userFullName = (userSession.Nombre + ' ' + userSession.Apellido).trim();
        var userEl = document.getElementById("userName");
        if (userEl) userEl.textContent = userFullName || "Usuario";

        if (window.RpAvatar) {
            RpAvatar.applyToNavbar({
                color: userSession.AvatarColor,
                icono: userSession.AvatarIcono,
                foto: userSession.AvatarFoto
            });
        }

    }

    initNavbarDropdowns();
    initNavbarHoverDropdowns();
    initNavbarCollapseAutoClose();
    initPreferenciasVisualizacion();
    initNavbarActiveState();
});

const RP_NAV_EXPAND_MQ = "(min-width: 992px)";

function isNavbarExpanded() {
    return window.matchMedia(RP_NAV_EXPAND_MQ).matches;
}

/** Dropdowns del navbar: Popper fixed en desktop, static en menú colapsado. */
function initNavbarDropdowns() {
    if (!window.bootstrap?.Dropdown) return;

    const expanded = isNavbarExpanded();

    document.querySelectorAll(".rp-navbar [data-bs-toggle='dropdown']").forEach(toggle => {
        const existing = bootstrap.Dropdown.getInstance(toggle);
        if (existing) existing.dispose();

        // dispose() no cierra el menú: sin esto el .show queda pegado en el toggle
        // (y el ítem sigue resaltado) si se reinicializa con un dropdown abierto.
        limpiarDropdownNavbar(toggle);

        const options = {
            offset: [0, 4],
            autoClose: "outside",
            display: expanded ? "dynamic" : "static"
        };

        if (expanded) {
            options.popperConfig = function (defaultBootstrapConfig) {
                return Object.assign({}, defaultBootstrapConfig, { strategy: "fixed" });
            };
        }

        bootstrap.Dropdown.getOrCreateInstance(toggle, options);
    });
}

/** Saca el estado "abierto" de un toggle del navbar y de su menú. */
function limpiarDropdownNavbar(toggle) {
    if (!toggle) return;
    toggle.classList.remove("show");
    toggle.setAttribute("aria-expanded", "false");
    toggle.closest(".nav-item")?.querySelector(".dropdown-menu")?.classList.remove("show");
}

/** Un solo menú abierto a la vez: cierra los demás dropdowns del navbar. */
function cerrarOtrosDropdownsNavbar(exceptoToggle) {
    document.querySelectorAll(".rp-navbar [data-bs-toggle='dropdown'].show").forEach(toggle => {
        if (toggle === exceptoToggle) return;
        bootstrap.Dropdown.getInstance(toggle)?.hide();
        limpiarDropdownNavbar(toggle);
    });
}

function initNavbarHoverDropdowns() {
    document.querySelectorAll(".rp-navbar .rp-nav-main > .nav-item").forEach(item => {
        item.addEventListener("mouseenter", function () {
            if (!isNavbarExpanded() || window.matchMedia("(hover: none)").matches) return;
            if (!window.bootstrap?.Dropdown) return;

            const toggle = this.querySelector("[data-bs-toggle='dropdown']");
            // Aunque el ítem no tenga menú, al pasar el mouse cerramos el que estuviera abierto.
            cerrarOtrosDropdownsNavbar(toggle);
            if (!toggle) return;

            const enfocadoAntes = document.activeElement;
            bootstrap.Dropdown.getOrCreateInstance(toggle).show();

            // Bootstrap hace toggle.focus() adentro de show(). Como acá abrimos por hover,
            // ese foco programático le dispara el :focus-visible a Chrome y te deja el
            // anillo del navegador pegado en el ítem. Si el foco no era de él, lo soltamos.
            if (enfocadoAntes !== toggle && document.activeElement === toggle) toggle.blur();
        });

        item.addEventListener("mouseleave", function () {
            if (!isNavbarExpanded()) return;
            const toggle = this.querySelector("[data-bs-toggle='dropdown']");
            if (!toggle || !window.bootstrap?.Dropdown) return;
            bootstrap.Dropdown.getInstance(toggle)?.hide();
        });
    });
}

function initNavbarCollapseAutoClose() {
    const collapseEl = document.getElementById("navbarSupportedContent");
    if (!collapseEl) return;

    collapseEl.addEventListener("click", function (e) {
        if (isNavbarExpanded()) return;

        const link = e.target.closest("a");
        if (!link) return;
        if (link.classList.contains("dropdown-toggle")) return;
        if (link.getAttribute("href") === "#" && !link.hasAttribute("onclick")) return;

        const inst = window.bootstrap?.Collapse?.getInstance(collapseEl);
        if (inst) inst.hide();
    });
}

let rpNavResizeTimer = 0;
window.addEventListener("resize", function () {
    clearTimeout(rpNavResizeTimer);
    rpNavResizeTimer = setTimeout(initNavbarDropdowns, 150);
});



function cerrarSesion() {
    const go = () => { window.location.href = '/Login/Logout'; };
    if (window.SessionManager?.beginVoluntaryLogout) {
        Promise.resolve(window.SessionManager.beginVoluntaryLogout())
            .catch(() => { })
            .finally(go);
        return;
    }
    sessionStorage.removeItem('sesionExpirada');
    sessionStorage.setItem('logoutVoluntario', '1');
    localStorage.removeItem('JwtToken');
    localStorage.removeItem('sessionExpiresAt');
    go();
}

async function abrirConfiguraciones() {
    await openFreshModal('#ModalEdicionConfiguraciones');
    try {
        document.getElementById('ModalEdicionConfiguracionesLabel').textContent = 'Configuraciones';
    } catch { }

    initPreferenciasVisualizacion();

    const buscadorSecciones = document.getElementById('txtBuscarSeccionesConfiguracion');
    if (buscadorSecciones) {
        buscadorSecciones.value = '';
        filtrarSeccionesConfiguraciones();
        $('#txtBuscarSeccionesConfiguracion').off('input').on('input', filtrarSeccionesConfiguraciones);
        setTimeout(() => buscadorSecciones.focus(), 150);
    }
}

async function listaConfiguracion() {
    const ctl = getCtl();
    const url = `/${ctl}/Lista`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        }
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Error al cargar configuraciones');

    return data.map(x => ({
        Id: x.Id,
        Nombre: x.Nombre,
        NombreCombo: x.NombreCombo,
        // NUEVO: intenta mapear el valor extra si viene
        Extra: (extraFieldMeta && extraFieldMeta.key) ? x[extraFieldMeta.key] : undefined
    }));
}



async function abrirConfiguracion(_nombreConfiguracion, _controllerConfiguracion, _comboNombre = null, _comboController = null, _lblComboNombre = null, _extraMeta = null) {
    try {
        nombreConfiguracion = _nombreConfiguracion;
        controllerConfiguracion = _controllerConfiguracion;
        window.controllerConfiguracion = _controllerConfiguracion;
        comboNombre = _comboNombre;
        comboController = _comboController;
        lblComboNombre = _lblComboNombre;

        // NUEVO: configurar campo extra (o esconderlo si no hay)
        setExtraField(_extraMeta);

        const result = await llenarConfiguraciones();
        if (!result) {
            await errorModal("Ha ocurrido un error al cargar la lista");
            return;
        }

        $('#ModalEdicionConfiguraciones').modal('hide');
        $('#modalConfiguracion').modal('show');

        resetConfigForm();

        if (configQuickAddMode) {
            applyConfigQuickAddUi();
        } else {
            setConfigModalQuickAddMode(false);
            document.getElementById("modalConfiguracionLabel").innerText = "Configuración de " + nombreConfiguracion;
        }

        $('#txtNombreConfiguracion').on('input', validarCamposConfiguracion);
        $('#cmbConfiguracion').on('change', validarCamposConfiguracion);
        $('#txtExtraField').on('input', validarCamposConfiguracion); // NUEVO
    } catch (ex) {
        errorModal("Ha ocurrido un error al cargar la lista");
    }
}

async function editarConfiguracion(id) {
    if (configQuickAddMode) return;
    const ctl = getCtl();
    const url = `/${ctl}/EditarInfo?id=${encodeURIComponent(id)}`;

    fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json", 'Authorization': 'Bearer ' + token, }
    })
        .then(response => {
            if (!response.ok) throw new Error("Ha ocurrido un error.");
            return response.json();
        })
        .then(dataJson => {
            if (dataJson) {
                document.getElementById("btnRegistrarModificarConfiguracion").textContent = "Modificar";
                document.getElementById("agregarConfiguracion").setAttribute("hidden", "hidden");
                document.getElementById("txtNombreConfiguracion").value = dataJson.Nombre;
                document.getElementById("txtIdConfiguracion").value = dataJson.Id;

                document.getElementById("contenedorNombreConfiguracion").removeAttribute("hidden");

                if (comboNombre != null) {
                    document.getElementById("lblConfiguracionCombo").innerText = lblComboNombre;
                    document.getElementById("cmbConfiguracion").value = dataJson.IdCombo ?? dataJson.IdUnidadNegocio ?? "";
                }

                // NUEVO: setear campo extra si corresponde
                if (extraFieldMeta?.key) {
                    const val = dataJson[extraFieldMeta.key];
                    const inp = document.getElementById('txtExtraField');
                    if (extraFieldMeta.type === 'number' && (val ?? '') !== '') {
                        inp.value = String(val).replace('.', ','); // opcional: mostrar coma
                    } else {
                        inp.value = val ?? '';
                    }
                }

                validarCamposConfiguracion();
            } else {
                throw new Error("Ha ocurrido un error.");
            }
        })
        .catch(() => errorModal("Ha ocurrido un error."));
}

async function llenarConfiguraciones() {
    try {
        // 1) Traer data
        const configuraciones = await listaConfiguracion();

        // 2) Mostrar/ocultar combo según corresponda
        if (comboNombre != null) {
            await llenarComboConfiguracion();
            document.getElementById("divConfiguracionCombo").removeAttribute("hidden");
        } else {
            document.getElementById("divConfiguracionCombo").setAttribute("hidden", "hidden");
        }

        // 3) Reset de lista y mensaje vacío
        const lblVacia = document.getElementById("lblListaVacia");
        $("#configuracion-list").empty();
        lblVacia.innerText = "";
        lblVacia.hidden = true;

        if (!configuraciones || configuraciones.length === 0) {
            lblVacia.innerText = `La lista de ${nombreConfiguracion} está vacía.`;
            lblVacia.style.color = "red";
            lblVacia.hidden = false;
            listaVacia = true;
            return true;
        }

        listaVacia = false;

        // 4) Render de items
        configuraciones.forEach(c => {
            let nombreConfig = c.Nombre || "";
            if (c.NombreCombo) nombreConfig += " - " + c.NombreCombo;

            // --- Extra opcional: mostrar SOLO si numérico y > 0 ---
            if (extraFieldMeta?.key) {
                const val = c.Extra;
                // Normalizo a número si viene algo
                const num = (val === null || val === undefined || val === '')
                    ? null
                    : Number(String(val).toString().replace(',', '.'));

                if (extraFieldMeta.type === 'number' && Number.isFinite(num) && num > 0) {
                    // Formato simple con coma (opcional)
                    const pretty = String(num).replace('.', ',');
                    nombreConfig += `  ·  ${extraFieldMeta.label || extraFieldMeta.key}: ${pretty}`;
                }
                // Si el extra no es numérico, podés decidir mostrarlo solo si no está vacío:
                // else if (extraFieldMeta.type !== 'number' && val) { nombreConfig += ` · ${...}: ${val}`; }
            }

            const id = c.Id;
            const actionsHtml = configQuickAddMode ? '' : `
                    <div class="rp-list-actions item-actions">
                        <button type="button" class="rp-icon-btn icon-btn edit" title="Editar" onclick="editarConfiguracion(${id})">
                            <i class="fa fa-pencil"></i>
                        </button>
                        <button type="button" class="rp-icon-btn icon-btn delete danger" title="Eliminar" onclick="eliminarConfiguracion(${id})">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>`;
            $("#configuracion-list").append(`
                <div class="rp-list-item list-item" data-id="${id}" data-busqueda="${(nombreConfig || '').toLowerCase()}" data-texto="${(nombreConfig || '').toLowerCase()}">
                    <div class="rp-item-left">
                        <div class="rp-item-icon"><i class="fa fa-tag"></i></div>
                        <div class="rp-item-text list-item__text">${nombreConfig}</div>
                    </div>
                    ${actionsHtml}
                </div>
            `);
        });

        return true;
    } catch (ex) {
        console.error("llenarConfiguraciones() error:", ex);
        return false;
    }
}

async function eliminarConfiguracion(id) {
    if (configQuickAddMode) return;

    const ctl = getCtl();
    return eliminarConCascada({
        url: `/${ctl}/Eliminar`,
        id,
        confirmMsg: '¿Desea eliminar el/la' + nombreConfiguracion + '?',
        headers: () => ({
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
        }),
        onSuccess: async (j) => {
            llenarConfiguraciones();
            exitoModal((j.mensaje) || (nombreConfiguracion + ' eliminada correctamente'));
        }
    });
}

async function llenarComboConfiguracion() {
    const res = await fetch(`/${comboController}/Lista`, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
        }
    });
    if (!res.ok) throw new Error('Error al cargar combo');

    const data = await res.json();
    llenarSelect("cmbConfiguracion", data);
}

function validarCamposConfiguracion() {
    const nombre = $("#txtNombreConfiguracion").val();
    const combo = $("#cmbConfiguracion").val();

    const camposValidos = nombre.trim() !== "";
    const selectValido = combo !== "";

    let extraValido = true;

    if (extraFieldMeta) {
        const rawVal = document.getElementById("txtExtraField").value?.trim() || "";

        if (extraFieldMeta.type === "number") {
            // Si no es requerido y está vacío, se acepta
            if (!extraFieldMeta.required && rawVal === "") {
                extraValido = true;
            } else {
                const normalized = rawVal.replace(",", ".");
                const num = Number(normalized);
                extraValido = !isNaN(num);
            }
        } else {
            // Texto libre: si es requerido, debe tener valor
            extraValido = !extraFieldMeta.required || rawVal !== "";
        }

        // Estilos del label/input del campo extra
        $("#lblExtraField").css("color", extraValido ? "" : "red");
        $("#txtExtraField").css("border-color", extraValido ? "" : "red");
    }

    // Estilos del nombre y combo
    $("#lblNombre, #lblNombreConfiguracion").css("color", camposValidos ? "" : "red");
    $("#txtNombreConfiguracion").css("border-color", camposValidos ? "" : "red");
    $("#cmbConfiguracion").css("border-color", (comboNombre != null) ? (selectValido ? "" : "red") : "");

    // Lógica final de validación
    if (comboNombre != null) {
        return camposValidos && selectValido && extraValido;
    } else {
        return camposValidos && extraValido;
    }
}

function guardarCambiosConfiguracion() {
    if (!validarCamposConfiguracion()) {
        errorModal('Debes completar los campos requeridos');
        return;
    }

    const idConfiguracion = $("#txtIdConfiguracion").val();
    if (configQuickAddMode && idConfiguracion !== "") {
        errorModal('Desde aquí solo podés agregar un registro nuevo.');
        return;
    }
    const idCombo = $("#cmbConfiguracion").val();

    return withBusy("#btnRegistrarModificarConfiguracion", () => {
        const nuevoModelo = {
            "Id": idConfiguracion !== "" ? Number(idConfiguracion) : 0,
            "IdCombo": comboNombre ? Number(idCombo || 0) : 0,
            "Nombre": $("#txtNombreConfiguracion").val()
        };

        // --- Campo extra (si aplica) ---
        if (extraFieldMeta?.key) {
            nuevoModelo[extraFieldMeta.key] = getExtraFieldValue();
        }

        const ctl = getCtl();                 // ← usa el controller configuracion actual
        const isInsert = idConfiguracion === "";
        const accion = isInsert ? "Insertar" : "Actualizar";
        const url = `/${ctl}/${accion}`;
        const method = isInsert ? "POST" : "PUT";

        return fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + token,
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json(); // Esperamos {valor:bool, id?:number}
            })
            .then(async (resp) => {
                if (resp?.tipo === 'duplicado' || resp?.valor === false) {
                    errorModal(resp?.mensaje || 'Ya existe un registro con ese nombre.');
                    return;
                }

                const fueAlta = (idConfiguracion === "");
                const mensaje = fueAlta
                    ? `${nombreConfiguracion} registrado/a correctamente`
                    : `${nombreConfiguracion} modificado/a correctamente`;

                // Refrescar grilla
                await llenarConfiguraciones();

                // === EMITIR EVENTO "config:saved" antes de cerrar (modo +) ===
                let savedId = resp?.id;

                if (!savedId && fueAlta) {
                    try {
                        const todos = await listaConfiguracion();
                        const nombre = (nuevoModelo.Nombre || '').trim().toLowerCase();
                        const match = (todos || []).find(x => String(x.Nombre || '').trim().toLowerCase() === nombre);
                        if (match) savedId = match.Id;
                    } catch { /* ignore */ }
                }

                window.dispatchEvent(new CustomEvent('config:saved', {
                    detail: {
                        controller: getCtl(),
                        id: savedId || null,
                        nombre: nuevoModelo.Nombre || ''
                    }
                }));

                if (configQuickAddMode) {
                    $('#modalConfiguracion').modal('hide');
                } else {
                    resetConfigForm();
                }
                exitoModal(mensaje);
            })
            .catch(() => console.error('Error al guardar'));
    });
}

function resetConfigForm() {
    document.getElementById("txtNombreConfiguracion").value = "";
    document.getElementById("txtIdConfiguracion").value = "";
    document.getElementById("contenedorNombreConfiguracion").setAttribute("hidden", "hidden");
    document.getElementById("agregarConfiguracion").removeAttribute("hidden");

    if (extraFieldMeta) {
        document.getElementById('txtExtraField').value = "";
        $('#lblExtraField').css('color', '');
        $('#txtExtraField').css('border-color', '');
    }
    if (comboNombre != null) {
        document.getElementById("cmbConfiguracion").value = "";
        $('#cmbConfiguracion').css('border-color', '');
    }

    if (listaVacia == true) {
        document.getElementById("lblListaVacia").innerText = `La lista de ${nombreConfiguracion} esta vacia.`;
        document.getElementById("lblListaVacia").style.color = 'red';
        document.getElementById("lblListaVacia").removeAttribute("hidden");
    }
}

function cancelarModificarConfiguracion() {
    if (configQuickAddMode) {
        $('#modalConfiguracion').modal('hide');
        return;
    }
    resetConfigForm();
}

function volverConfiguraciones() {
    if (configQuickAddMode) {
        $('#modalConfiguracion').modal('hide');
        return;
    }
    resetConfigForm();
    const buscador = document.getElementById('txtBuscarConfiguracion');
    if (buscador) buscador.value = '';
    $('#modalConfiguracion').modal('hide');
    $('#ModalEdicionConfiguraciones').modal('show');
}


function agregarConfiguracion() {
    document.getElementById("txtNombreConfiguracion").value = "";
    document.getElementById("txtIdConfiguracion").value = "";
    document.getElementById("contenedorNombreConfiguracion").removeAttribute("hidden");
    document.getElementById("agregarConfiguracion").setAttribute("hidden", "hidden");
    document.getElementById("lblListaVacia").innerText = "";
    document.getElementById("lblListaVacia").setAttribute("hidden", "hidden");
    document.getElementById("btnRegistrarModificarConfiguracion").textContent = "Agregar";

    $('#lblNombre, #lblNombreConfiguracion').css('color', 'red');
    $('#txtNombreConfiguracion').css('border-color', 'red');

    if (comboNombre != null) {
        document.getElementById("lblConfiguracionCombo").innerText = lblComboNombre;
        document.getElementById("cmbConfiguracion").value = "";
        $('#cmbConfiguracion').css('border-color', 'red');
    }

}


// --- NUEVO: metadatos del campo extra libre ---
let extraFieldMeta = null; // { key, label, type, required, placeholder, step, min, max, parse? }
// ej: { key:'CostoFinanciero', label:'Costo Financiero (%)', type:'number', required:true, step:'0.01', min:'0' }

function setExtraField(meta) {
    extraFieldMeta = meta || null;

    const div = document.getElementById('divExtraField');
    const lbl = document.getElementById('lblExtraField');
    const inp = document.getElementById('txtExtraField');

    if (!extraFieldMeta) {
        div.setAttribute('hidden', 'hidden');
        lbl.textContent = '';
        inp.value = '';
        inp.removeAttribute('type'); // vuelve al default
        return;
    }

    // Mostrar y configurar
    div.removeAttribute('hidden');
    lbl.textContent = extraFieldMeta.label || 'Valor';
    inp.value = '';
    inp.type = (extraFieldMeta.type === 'number') ? 'number' : 'text';

    // Placeholders / constraints (opcionales)
    inp.placeholder = extraFieldMeta.placeholder || '';
    if (extraFieldMeta.type === 'number') {
        if (extraFieldMeta.step) inp.step = extraFieldMeta.step; else inp.removeAttribute('step');
        if (extraFieldMeta.min != null) inp.min = extraFieldMeta.min; else inp.removeAttribute('min');
        if (extraFieldMeta.max != null) inp.max = extraFieldMeta.max; else inp.removeAttribute('max');
    } else {
        inp.removeAttribute('step'); inp.removeAttribute('min'); inp.removeAttribute('max');
    }
}

// Obtiene el valor ya normalizado según el tipo del meta
function getExtraFieldValue() {
    if (!extraFieldMeta) return null;
    const raw = document.getElementById('txtExtraField').value?.trim();

    if (extraFieldMeta.type === 'number') {
        // Permite "12,5" o "12.5"
        const normalized = raw.replace(',', '.');
        const num = normalized === '' ? null : Number(normalized);
        return Number.isFinite(num) ? num : null;
    }
    return raw ?? '';
}


// ======= Tema =======
const CFG_THEME_KEY = 'cfg_theme_modal_config';
const CFG_COMPACT_KEY = 'cfg_compact_modal_config';

function applyConfigTheme(themeClass) {
    const modal = document.getElementById('modalConfiguracion');
    if (!modal) return;
    ['theme-indigo', 'theme-cyan', 'theme-emerald'].forEach(t => modal.classList.remove(t));
    modal.classList.add(themeClass);
    try { localStorage.setItem(CFG_THEME_KEY, themeClass); } catch { }
}

function setConfigCompact(isOn) {
    const cont = document.querySelector('#modalConfiguracion .list-container');
    if (cont) cont.classList.toggle('compact', !!isOn);
    document.querySelectorAll('#configuracion-list .config-item, #configuracion-list .list-item')
        .forEach(el => el.classList.toggle('compact', !!isOn));
    try { localStorage.setItem(CFG_COMPACT_KEY, isOn ? '1' : '0'); } catch { }
}

// Restaura preferencias cuando se abre el modal
document.getElementById('modalConfiguracion')?.addEventListener('hidden.bs.modal', () => {
    configQuickAddMode = false;
    setConfigModalQuickAddMode(false);
});

document.getElementById('modalConfiguracion')?.addEventListener('show.bs.modal', () => {
    const savedTheme = localStorage.getItem(CFG_THEME_KEY) || 'theme-indigo';
    applyConfigTheme(savedTheme);

    const savedCompact = localStorage.getItem(CFG_COMPACT_KEY) === '1';
    const sw = document.getElementById('switchCompacto');
    if (sw) { sw.checked = savedCompact; }
    setConfigCompact(savedCompact);
});

// ======= Filtro local =======
function filtrarConfiguracionesLocal(texto) {
    const q = (texto || '').toString().trim().toLowerCase();
    const list = document.getElementById('configuracion-list');
    const vacio = document.getElementById('lblListaVacia');
    if (!list) return;

    let visibles = 0;
    const items = list.querySelectorAll('.rp-list-item, .list-item, .config-item');
    items.forEach(it => {
        const txt = (it.getAttribute('data-texto') || it.getAttribute('data-busqueda') || it.textContent || '').toLowerCase();
        const match = !q || txt.includes(q);
        it.style.display = match ? '' : 'none';
        if (match) visibles++;
    });

    if (vacio) vacio.hidden = visibles !== 0;
}

/* =========================================================
0) Anti beforeunload (mata el popup nativo en todo el sitio)
========================================================= */
(function killBeforeUnload() {
    // 1) Capturamos el evento y cortamos propagación
    window.addEventListener('beforeunload', function (e) {
        // NO seteamos returnValue → NO hay diálogo
        e.stopImmediatePropagation();
    }, { capture: true });

    // 2) Ignoramos registros futuros a beforeunload
    const _add = window.addEventListener;
    window.addEventListener = function (type, listener, opts) {
        if (type === 'beforeunload') return; // ignorar
        return _add.call(this, type, listener, opts);
    };

    // 3) Neutralizamos la propiedad onbeforeunload
    try { window.onbeforeunload = null; } catch (e) { }
    try {
        Object.defineProperty(window, 'onbeforeunload', {
            configurable: true,
            get() { return null; },
            set(_) { /* noop */ }
        });
    } catch (_) { }
})();


/* =========================================================
 * Modal Manager v2 – Bootstrap 5
 * - Todos los .modal se mueven al <body> (evita anidamientos)
 * - Stacking: z-index para modal y backdrop por orden de apertura
 * - Limpieza de backdrops huérfanos
 * - Mantiene body .modal-open si quedan modales visibles
 * - Ajusta padding-right del body por scrollbar (no “salta” la UI)
 * ========================================================= */
/* =========================================================
 * Modal Manager — Bootstrap 5 (robusto y corto)
 * ========================================================= */
(function modalManager() {
    const Z_BASE = 5000, STEP = 20;

    // Asegurar que todos los modales cuelguen del <body>
    function moveAllModalsToBody() {
        document.querySelectorAll('.modal').forEach(m => {
            if (m.parentElement !== document.body) document.body.appendChild(m);
        });
    }
    document.addEventListener('DOMContentLoaded', moveAllModalsToBody);

    // Utilidad: desbloquear body y limpiar backdrops sobrantes
    function cleanState() {
        const open = document.querySelectorAll('.modal.show').length;
        const backs = document.querySelectorAll('.modal-backdrop');
        // si hay más backdrops que modales visibles, borro extras (los más antiguos)
        for (let i = 0; i < backs.length - open; i++) backs[i].remove();
        if (open === 0) {
            document.body.classList.remove('modal-open');
            document.body.style.paddingRight = '';
        } else {
            document.body.classList.add('modal-open');
            // Ajuste de padding por scrollbar (evita saltos)
            const sw = (() => {
                const d = document.createElement('div');
                d.style.cssText = 'position:fixed;top:-9999px;width:100px;height:100px;overflow:scroll;';
                document.body.appendChild(d);
                const w = d.offsetWidth - d.clientWidth;
                d.remove();
                return w;
            })();
            if (sw > 0) document.body.style.paddingRight = sw + 'px';
        }
    }

    // Al abrir: apilar modal y su backdrop
    document.addEventListener('show.bs.modal', e => {
        moveAllModalsToBody();
        const modal = e.target;
        const idSel = modal.id ? ('#' + modal.id) : null;

        // Nivel = cantidad de backdrops existentes + 1
        const level = document.querySelectorAll('.modal-backdrop').length + 1;
        const z = Z_BASE + level * STEP;
        modal.style.zIndex = z;

        // Cuando el modal ya insertó el backdrop, lo etiquetamos y ordenamos
        setTimeout(() => {
            const backs = Array.from(document.querySelectorAll('.modal-backdrop'));
            const last = backs[backs.length - 1];
            if (last) {
                last.style.zIndex = String(z - 1);
                if (idSel) last.setAttribute('data-for', idSel);
            }
        }, 0);
    });

    // Al quedar visible, asegurar bloqueo del body
    document.addEventListener('shown.bs.modal', cleanState);

    // Al cerrar: eliminar el backdrop asociado a ese modal y reequilibrar
    document.addEventListener('hidden.bs.modal', e => {
        const modal = e.target;
        const idSel = modal.id ? ('#' + modal.id) : null;
        if (idSel) {
            // borro el backdrop etiquetado para este modal (si existe)
            const tagged = document.querySelector(`.modal-backdrop[data-for="${idSel}"]`);
            if (tagged) tagged.remove();
        }
        cleanState();
    });

    // Failsafe al volver del historial o refrescar
    window.addEventListener('pageshow', () => {
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        document.body.classList.remove('modal-open');
        document.body.style.paddingRight = '';
    });

    // Expongo un limpiador manual por si querés usarlo antes de abrir “en limpio”
    window.forceCleanModals = function () {
        document.querySelectorAll('.modal.show').forEach(el => {
            const inst = bootstrap.Modal.getOrCreateInstance(el);
            inst.hide();
        });
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        document.body.classList.remove('modal-open');
        document.body.style.paddingRight = '';
    };
})();




// ============ site.js (GENÉRICOS) ============

// Fetch con JSON + token (GET/POST/PUT/DELETE)
async function fetchJson(url, options = {}) {
    const headers = Object.assign(
        {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        options.headers || {}
    );

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        // Intenta parsear JSON de error
        let msg = 'Error en la solicitud';
        try {
            const j = await res.json();
            msg = j?.mensaje || j?.error || res.statusText;
        } catch { }
        throw new Error(msg);
    }
    // Algunos endpoints DELETE devuelven vacío
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
}

// Llenar un <select> con datos [{id, nombre}] o mapeando claves personalizadas
function llenarSelect(selectId, data, opts = {}) {
    const {
        value = 'Id',
        text = 'Nombre',
        includeSeleccionar = false,
        seleccionarTexto = 'Seleccionar'
    } = opts;
    const sel = document.getElementById(selectId);
    if (!sel) return;

    sel.innerHTML = '';
    if (includeSeleccionar) {
        const op0 = document.createElement('option');
        op0.value = '-1';
        op0.textContent = seleccionarTexto;
        op0.disabled = true;
        op0.selected = true;
        sel.appendChild(op0);
    }

    (data || []).forEach(x => {
        const op = document.createElement('option');
        op.value = String(x[value]);
        op.textContent = String(x[text]);
        sel.appendChild(op);
    });
}

// ==== Bridge genérico para abrir Configuración y esperar "guardado" ====
//
// Requiere que NavBarLogin.js emita un CustomEvent('config:saved', {detail:{ controller, id, nombre }})
// cuando se inserta/modifica una fila en configuraciones.
//
function openConfigAndWait({ nombre, controller, comboNombre = null, comboController = null, lblComboNombre = null, extraMeta = null }) {
    return new Promise((resolve, reject) => {
        let timeoutId;
        let saved = false;
        const modalEl = document.getElementById('modalConfiguracion');

        const cleanup = () => {
            clearTimeout(timeoutId);
            window.removeEventListener('config:saved', onSaved);
            modalEl?.removeEventListener('hidden.bs.modal', onHidden);
        };

        const onSaved = (ev) => {
            const d = ev?.detail || {};
            if (d?.controller === controller && d?.id) {
                saved = true;
                cleanup();
                configQuickAddMode = false;
                setConfigModalQuickAddMode(false);
                resolve(d.id);
            }
        };

        const onHidden = () => {
            if (!saved) {
                cleanup();
                configQuickAddMode = false;
                setConfigModalQuickAddMode(false);
                reject(new Error('cancelled'));
            }
        };

        window.addEventListener('config:saved', onSaved);
        modalEl?.addEventListener('hidden.bs.modal', onHidden);

        timeoutId = setTimeout(() => {
            cleanup();
            configQuickAddMode = false;
            setConfigModalQuickAddMode(false);
            reject(new Error('config:saved timeout'));
        }, 5 * 60 * 1000);

        try {
            if (typeof abrirConfiguracion !== 'function') {
                cleanup();
                return reject(new Error('abrirConfiguracion no está definido'));
            }
            configQuickAddMode = true;
            abrirConfiguracion(nombre, controller, comboNombre, comboController, lblComboNombre, extraMeta);
        } catch (err) {
            cleanup();
            configQuickAddMode = false;
            setConfigModalQuickAddMode(false);
            reject(err);
        }
    });
}
