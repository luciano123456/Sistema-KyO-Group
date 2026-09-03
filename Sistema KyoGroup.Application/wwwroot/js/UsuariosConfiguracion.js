let timerError;
let avatarState = {
    color: "#e8879f",
    icono: "user",
    foto: null
};
let avatarSaveTimer = null;

function authHeadersPerfil(json = true) {
    const h = {};
    if (json) h["Content-Type"] = "application/json;charset=utf-8";
    const token = localStorage.getItem("JwtToken");
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
}

function mostrarMensajePerfil(html, tipo) {
    const el = document.getElementById("msjerror");
    if (!el) return;
    el.classList.remove("d-none", "is-ok", "is-error");
    el.classList.add(tipo === "ok" ? "is-ok" : "is-error");
    el.innerHTML = html;
    if (timerError) clearTimeout(timerError);
    if (tipo !== "ok") {
        timerError = setTimeout(() => el.classList.add("d-none"), 7000);
    }
}

function ocultarMensajePerfil() {
    document.getElementById("msjerror")?.classList.add("d-none");
}

function syncAvatarSession() {
    if (!window.RpAvatar) return;
    RpAvatar.writeSessionAvatar({
        AvatarColor: avatarState.color,
        AvatarIcono: avatarState.icono,
        AvatarFoto: avatarState.foto
    });
    RpAvatar.applyToNavbar({
        color: avatarState.color,
        icono: avatarState.icono,
        foto: avatarState.foto
    });
}

function pintarAvataresUI() {
    if (!window.RpAvatar) return;
    const opts = {
        color: avatarState.color,
        icono: avatarState.icono,
        foto: avatarState.foto
    };
    RpAvatar.render("#rpPerfilAvatar", { ...opts, size: "md" });
    RpAvatar.render("#rpAvatarPreview", { ...opts, size: "lg" });

    const editor = document.querySelector(".rp-avatar-editor");
    const removeBtn = document.getElementById("rpAvatarRemoveBtn");
    const note = document.getElementById("rpAvatarPhotoNote");
    const hasFoto = !!avatarState.foto;

    editor?.classList.toggle("is-photo", hasFoto);
    removeBtn?.classList.toggle("d-none", !hasFoto);
    note?.classList.toggle("d-none", !hasFoto);

    document.querySelectorAll(".rp-avatar-swatch").forEach(btn => {
        btn.classList.toggle("is-active", btn.dataset.color === avatarState.color);
    });
    document.querySelectorAll(".rp-avatar-icon-btn").forEach(btn => {
        const active = btn.dataset.icon === avatarState.icono;
        btn.classList.toggle("is-active", active);
        btn.style.background = active ? avatarState.color : "";
    });
}

async function guardarAvatarEstilo() {
    return withBusy("#rpAvatarIconControls", async () => {
        try {
            const response = await fetch("/Usuarios/ActualizarAvatar", {
                method: "PUT",
                headers: authHeadersPerfil(true),
                body: JSON.stringify({
                    AvatarColor: avatarState.color,
                    AvatarIcono: avatarState.icono
                })
            });

            if (response.status === 401) {
                window.location.href = "/Login/";
                return;
            }

            const result = await response.json();
            if (result.valor === "OK") {
                avatarState.color = result.AvatarColor || avatarState.color;
                avatarState.icono = result.AvatarIcono || avatarState.icono;
                if (result.AvatarFoto !== undefined) avatarState.foto = result.AvatarFoto;
                syncAvatarSession();
                pintarAvataresUI();
                mostrarMensajePerfil('<i class="fa fa-check-circle"></i> Avatar actualizado.', "ok");
            } else {
                mostrarMensajePerfil(`<i class="fa fa-exclamation-circle"></i> ${result.mensaje || "No se pudo guardar el avatar."}`, "error");
            }
        } catch (err) {
            console.error(err);
            mostrarMensajePerfil('<i class="fa fa-exclamation-circle"></i> Error al guardar el avatar.', "error");
        }
    }, { loadingHtml: false });
}

function programarGuardadoAvatar() {
    if (avatarSaveTimer) clearTimeout(avatarSaveTimer);
    avatarSaveTimer = setTimeout(guardarAvatarEstilo, 350);
}

function initAvatarEditor() {
    if (!window.RpAvatar) return;

    const swatches = document.getElementById("rpAvatarSwatches");
    const icons = document.getElementById("rpAvatarIcons");
    if (!swatches || !icons) return;

    swatches.innerHTML = "";
    RpAvatar.COLORES.forEach(color => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rp-avatar-swatch";
        btn.dataset.color = color;
        btn.style.background = color;
        btn.title = color;
        btn.setAttribute("role", "option");
        btn.addEventListener("click", () => {
            if (avatarState.foto) return;
            avatarState.color = color;
            pintarAvataresUI();
            programarGuardadoAvatar();
        });
        swatches.appendChild(btn);
    });

    icons.innerHTML = "";
    RpAvatar.ICONOS.forEach(icon => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rp-avatar-icon-btn";
        btn.dataset.icon = icon;
        btn.title = icon;
        btn.setAttribute("role", "option");
        btn.innerHTML = `<i class="fa fa-${icon}"></i>`;
        btn.addEventListener("click", () => {
            if (avatarState.foto) return;
            avatarState.icono = icon;
            pintarAvataresUI();
            programarGuardadoAvatar();
        });
        icons.appendChild(btn);
    });

    document.getElementById("rpAvatarFileInput")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        if (file.size > 2_500_000) {
            mostrarMensajePerfil('<i class="fa fa-exclamation-circle"></i> La imagen no puede superar 2.5 MB.', "error");
            return;
        }

        const form = new FormData();
        form.append("file", file);

        try {
            const response = await fetch("/Usuarios/SubirAvatarFoto", {
                method: "POST",
                headers: authHeadersPerfil(false),
                body: form
            });

            if (response.status === 401) {
                window.location.href = "/Login/";
                return;
            }

            const result = await response.json();
            if (result.valor === "OK") {
                avatarState.foto = result.AvatarFoto || null;
                if (result.AvatarColor) avatarState.color = result.AvatarColor;
                if (result.AvatarIcono) avatarState.icono = result.AvatarIcono;
                syncAvatarSession();
                pintarAvataresUI();
                mostrarMensajePerfil('<i class="fa fa-check-circle"></i> Foto actualizada.', "ok");
            } else {
                mostrarMensajePerfil(`<i class="fa fa-exclamation-circle"></i> ${result.mensaje || "No se pudo subir la foto."}`, "error");
            }
        } catch (err) {
            console.error(err);
            mostrarMensajePerfil('<i class="fa fa-exclamation-circle"></i> Error al subir la foto.', "error");
        }
    });

    document.getElementById("rpAvatarRemoveBtn")?.addEventListener("click", async () => {
        try {
            const response = await fetch("/Usuarios/EliminarAvatarFoto", {
                method: "DELETE",
                headers: authHeadersPerfil(false)
            });

            if (response.status === 401) {
                window.location.href = "/Login/";
                return;
            }

            const result = await response.json();
            if (result.valor === "OK") {
                avatarState.foto = null;
                if (result.AvatarColor) avatarState.color = result.AvatarColor;
                if (result.AvatarIcono) avatarState.icono = result.AvatarIcono;
                if (!avatarState.icono) avatarState.icono = RpAvatar.DEFAULT_ICON;
                syncAvatarSession();
                pintarAvataresUI();
                mostrarMensajePerfil('<i class="fa fa-check-circle"></i> Foto eliminada. Se mostro el icono por defecto.', "ok");
            } else {
                mostrarMensajePerfil(`<i class="fa fa-exclamation-circle"></i> ${result.mensaje || "No se pudo quitar la foto."}`, "error");
            }
        } catch (err) {
            console.error(err);
            mostrarMensajePerfil('<i class="fa fa-exclamation-circle"></i> Error al quitar la foto.', "error");
        }
    });

    pintarAvataresUI();
}

function actualizarNombreNavbar(nombre, apellido) {
    const full = `${nombre || ""} ${apellido || ""}`.trim();
    if (full) {
        $("#userName").text(full);
        try {
            const raw = localStorage.getItem("userSession");
            if (raw) {
                const user = JSON.parse(raw);
                user.Nombre = nombre;
                user.Apellido = apellido;
                localStorage.setItem("userSession", JSON.stringify(user));
            }
        } catch { /* ignore */ }
    }
}

function obtenerPrefVistaPerfil() {
    const active = document.querySelector(".rp-perfil-pill.is-active");
    if (active?.dataset.view) return active.dataset.view;
    if (window.RpGridView?.getPref) return RpGridView.getPref();
    return "auto";
}

function syncPillsVistaPerfil(valor) {
    const val = ["auto", "table", "cards"].includes(valor) ? valor : "auto";
    document.querySelectorAll(".rp-perfil-pill").forEach(btn => {
        btn.classList.toggle("is-active", btn.dataset.view === val);
    });
}

function initPillsVistaPerfil() {
    const pillsWrap = document.getElementById("rpPerfilViewPills");
    if (!pillsWrap) return;

    let pref = "auto";
    if (window.RpGridView?.getPref) {
        pref = RpGridView.getPref();
    }
    syncPillsVistaPerfil(pref);

    pillsWrap.querySelectorAll(".rp-perfil-pill").forEach(btn => {
        btn.addEventListener("click", () => {
            const val = btn.dataset.view || "auto";
            syncPillsVistaPerfil(val);
            if (window.RpGridView) {
                RpGridView.setPref(val, { skipAdjust: true });
            }
        });
    });
}

async function cargarPerfilUsuario() {
    const response = await fetch("/Usuarios/MiPerfil", {
        method: "GET",
        headers: authHeadersPerfil(false)
    });

    if (response.status === 401) {
        window.location.href = "/Login/";
        return;
    }

    if (!response.ok) {
        mostrarMensajePerfil("No se pudieron cargar tus datos.", "error");
        return;
    }

    const data = await response.json();
    document.getElementById("Id").value = data.Id || "";
    document.getElementById("Nombre").value = data.Nombre || "";
    document.getElementById("Apellido").value = data.Apellido || "";
    document.getElementById("DNI").value = data.Dni || "";
    document.getElementById("Telefono").value = data.Telefono || "";
    document.getElementById("Direccion").value = data.Direccion || "";
    document.getElementById("Correo").value = data.Correo || "";

    const badge = document.getElementById("rpPerfilUsuario");
    if (badge) badge.textContent = data.Usuario || "Usuario";

    if (window.RpAvatar) {
        avatarState.color = RpAvatar.normalizeColor(data.AvatarColor);
        avatarState.icono = RpAvatar.normalizeIcon(data.AvatarIcono);
        avatarState.foto = data.AvatarFoto || null;
        syncAvatarSession();
        pintarAvataresUI();
    }
}

document.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("rp-perfil-body");
    if (window.RpGridView) {
        RpGridView.initConfigPanel();
    }
    initPillsVistaPerfil();
    initAvatarEditor();
    cargarPerfilUsuario();
});

document.querySelector("#formularioActualizar")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    ocultarMensajePerfil();

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    const pref = obtenerPrefVistaPerfil();
    if (pref && window.RpGridView) {
        RpGridView.setPref(pref, { skipAdjust: true });
    }

    return withBusy("#btnGuardar", async () => {
        try {
            const response = await fetch("/Usuarios/ActualizarPerfil", {
                method: "PUT",
                headers: authHeadersPerfil(true),
                body: JSON.stringify(data)
            });

            if (response.status === 401) {
                window.location.href = "/Login/";
                return;
            }

            const result = await response.json();

            if (result.valor === "Contrasena") {
                mostrarMensajePerfil('<i class="fa fa-exclamation-circle"></i> Contrasena actual incorrecta.', "error");
            } else if (result.valor === "Validacion") {
                mostrarMensajePerfil(`<i class="fa fa-exclamation-circle"></i> ${result.mensaje || "Complete los campos obligatorios."}`, "error");
            } else if (result.valor === "OK") {
                actualizarNombreNavbar(result.Nombre || data.Nombre, result.Apellido || data.Apellido);
                document.getElementById("Contrasena").value = "";
                document.getElementById("ContrasenaNueva").value = "";
                mostrarMensajePerfil('<i class="fa fa-check-circle"></i> Datos guardados correctamente.', "ok");
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                mostrarMensajePerfil('<i class="fa fa-exclamation-circle"></i> No se pudieron guardar los cambios.', "error");
            }
        } catch (err) {
            console.error(err);
            mostrarMensajePerfil('<i class="fa fa-exclamation-circle"></i> Ha ocurrido un error.', "error");
        }
    });
});
