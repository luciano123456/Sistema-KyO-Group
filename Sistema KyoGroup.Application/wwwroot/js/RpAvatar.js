/**
 * Renderizado compartido del avatar circular (navbar + configuración).
 * Soporta foto, icono Font Awesome y color de fondo.
 */
(function (global) {
    const DEFAULT_COLOR = "#e8879f";
    const DEFAULT_ICON = "user";

    const COLORES = [
        "#e8879f", "#f4a4b8", "#8bc34a", "#b5d99c", "#ffb74d",
        "#64b5f6", "#ce93d8", "#06b6d4", "#f97316", "#64748b",
        "#e11d48", "#7c3aed"
    ];

    const ICONOS = [
        "user", "smile-o", "star", "heart", "leaf", "car",
        "plane", "bicycle", "coffee", "music", "gamepad", "paw",
        "rocket", "home", "briefcase", "graduation-cap", "diamond", "fire"
    ];

    function normalizeColor(color) {
        if (!color || typeof color !== "string") return DEFAULT_COLOR;
        const c = color.trim();
        return /^#[0-9A-Fa-f]{6}$/.test(c) ? c.toLowerCase() : DEFAULT_COLOR;
    }

    function normalizeIcon(icon) {
        if (!icon || typeof icon !== "string") return DEFAULT_ICON;
        let i = icon.trim().toLowerCase();
        if (i.startsWith("fa-")) i = i.slice(3);
        return ICONOS.includes(i) ? i : DEFAULT_ICON;
    }

    function readSessionAvatar() {
        try {
            const raw = localStorage.getItem("userSession");
            if (!raw) return { color: DEFAULT_COLOR, icono: DEFAULT_ICON, foto: null };
            const u = JSON.parse(raw);
            return {
                color: normalizeColor(u.AvatarColor),
                icono: normalizeIcon(u.AvatarIcono),
                foto: u.AvatarFoto || null,
                nombre: u.Nombre || "",
                apellido: u.Apellido || ""
            };
        } catch {
            return { color: DEFAULT_COLOR, icono: DEFAULT_ICON, foto: null };
        }
    }

    function writeSessionAvatar(partial) {
        try {
            const raw = localStorage.getItem("userSession");
            if (!raw) return;
            const u = JSON.parse(raw);
            if (partial.AvatarColor !== undefined) u.AvatarColor = partial.AvatarColor;
            if (partial.AvatarIcono !== undefined) u.AvatarIcono = partial.AvatarIcono;
            if (partial.AvatarFoto !== undefined) u.AvatarFoto = partial.AvatarFoto;
            localStorage.setItem("userSession", JSON.stringify(u));
        } catch { /* ignore */ }
    }

    function render(el, opts) {
        const node = typeof el === "string" ? document.querySelector(el) : el;
        if (!node) return;

        const color = normalizeColor(opts?.color);
        const icono = normalizeIcon(opts?.icono);
        const foto = opts?.foto || null;

        node.classList.add("rp-avatar-circle");
        if (opts?.size) node.classList.add("rp-avatar-circle--" + opts.size);
        node.style.background = foto ? "#fff9fb" : color;
        node.setAttribute("aria-hidden", "true");

        if (foto) {
            const cacheBust = foto.includes("?") ? foto : (foto + "?v=" + encodeURIComponent(foto.split("/").pop() || "1"));
            node.innerHTML = `<img class="rp-avatar-img" src="${cacheBust}" alt="" />`;
        } else {
            node.innerHTML = `<i class="fa fa-${icono}"></i>`;
        }
    }

    function applyToNavbar(opts) {
        const data = opts || readSessionAvatar();
        const el = document.querySelector(".rp-user-avatar");
        if (!el) return;
        render(el, {
            color: data.color || data.AvatarColor,
            icono: data.icono || data.AvatarIcono,
            foto: data.foto !== undefined ? data.foto : data.AvatarFoto,
            size: "sm"
        });
    }

    global.RpAvatar = {
        DEFAULT_COLOR,
        DEFAULT_ICON,
        COLORES,
        ICONOS,
        normalizeColor,
        normalizeIcon,
        readSessionAvatar,
        writeSessionAvatar,
        render,
        applyToNavbar
    };
})(window);
