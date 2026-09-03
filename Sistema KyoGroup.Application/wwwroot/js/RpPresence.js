/**
 * Widget bottom-right: avatares de quienes están en el mismo módulo.
 */
(function (global) {
    const POLL_MS = 15 * 1000;
    const MAX_VISIBLE = 5;
    let timer = null;
    let dock = null;

    function authHeaders() {
        const h = {};
        const token = localStorage.getItem("JwtToken");
        if (token) h["Authorization"] = "Bearer " + token;
        return h;
    }

    function currentUserId() {
        try {
            const u = JSON.parse(localStorage.getItem("userSession") || "null");
            return u && u.Id != null ? Number(u.Id) : null;
        } catch {
            return null;
        }
    }

    function ensureDock() {
        if (dock && document.body.contains(dock)) return dock;
        dock = document.getElementById("rpPresenceDock");
        if (dock) return dock;

        dock = document.createElement("div");
        dock.id = "rpPresenceDock";
        dock.className = "rp-presence-dock";
        dock.setAttribute("aria-live", "polite");
        dock.innerHTML = `
            <div class="rp-presence-avatars" id="rpPresenceAvatars"></div>
            <div class="rp-presence-meta">
                <strong id="rpPresenceCount">0 aquí</strong>
                <span id="rpPresenceNames"></span>
            </div>
        `;
        document.body.appendChild(dock);
        return dock;
    }

    function hide() {
        const el = ensureDock();
        el.classList.remove("is-visible");
        el.style.display = "none";
    }

    function show() {
        const el = ensureDock();
        el.style.display = "";
        el.classList.add("is-visible");
    }

    function fullName(u) {
        return `${u.Nombre || ""} ${u.Apellido || ""}`.trim() || ("Usuario #" + u.Id);
    }

    function render(users, moduloKey) {
        const el = ensureDock();
        const avatars = el.querySelector("#rpPresenceAvatars");
        const countEl = el.querySelector("#rpPresenceCount");
        const namesEl = el.querySelector("#rpPresenceNames");
        if (!avatars || !countEl || !namesEl) return;

        const list = Array.isArray(users) ? users : [];
        if (!list.length) {
            hide();
            return;
        }

        const label = (global.RpModulos && RpModulos.label(moduloKey)) || moduloKey || "este módulo";
        const visible = list.slice(0, MAX_VISIBLE);
        const extra = list.length - visible.length;

        avatars.innerHTML = "";
        if (extra > 0) {
            const more = document.createElement("span");
            more.className = "rp-presence-more";
            more.textContent = "+" + extra;
            more.title = list.slice(MAX_VISIBLE).map(fullName).join(", ");
            avatars.appendChild(more);
        }

        // El contenedor es flex row-reverse: para que el primero quede a la
        // izquierda hay que agregarlos en orden inverso.
        for (let i = visible.length - 1; i >= 0; i--) {
            const u = visible[i];
            const chip = document.createElement("span");
            chip.className = "rp-avatar-circle rp-avatar-circle--sm";
            chip.title = fullName(u);
            if (global.RpAvatar) {
                RpAvatar.render(chip, {
                    color: u.AvatarColor,
                    icono: u.AvatarIcono,
                    foto: u.AvatarFoto,
                    size: "sm"
                });
            } else {
                chip.innerHTML = '<i class="fa fa-user"></i>';
            }
            avatars.appendChild(chip);
        }

        countEl.textContent = list.length === 1
            ? "1 también aquí"
            : `${list.length} también aquí`;
        namesEl.textContent = list.slice(0, 3).map(fullName).join(", ")
            + (list.length > 3 ? "…" : "");
        namesEl.title = `${label}: ${list.map(fullName).join(", ")}`;

        show();
    }

    async function refresh() {
        if (document.visibilityState === "hidden") return;
        if (!global.RpModulos) return;

        const modulo = RpModulos.current();
        if (!modulo) {
            hide();
            return;
        }

        // En la grilla de Usuarios el dock sobra: las filas ya muestran la ubicación.
        const path = (global.location.pathname || "").toLowerCase().replace(/\/+$/, "");
        if (path === "/usuarios" || path === "/usuarios/index") {
            hide();
            return;
        }

        try {
            const response = await fetch(
                `/Usuarios/PresenciaModulo?modulo=${encodeURIComponent(modulo)}`,
                { headers: authHeaders() }
            );
            if (response.status === 401) {
                hide();
                return;
            }
            if (!response.ok) return;
            const data = await response.json();
            const me = currentUserId();
            const filtered = (data || []).filter(u => Number(u.Id) !== me);
            render(filtered, modulo);
        } catch {
            /* silencioso */
        }
    }

    function start() {
        if (timer) clearInterval(timer);
        ensureDock();
        refresh();
        timer = setInterval(() => {
            if (document.visibilityState === "hidden") return;
            refresh();
        }, POLL_MS);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") refresh();
        });
    }

    function init() {
        if (global.__rpPresenceInitialized) return;
        global.__rpPresenceInitialized = true;

        const path = (global.location.pathname || "").toLowerCase();
        if (path.indexOf("/login") >= 0) return;

        if (!localStorage.getItem("JwtToken")) return;

        start();
    }

    global.RpPresence = { refresh, start };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})(window);
