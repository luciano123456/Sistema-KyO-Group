/**
 * Gestion de sesion JWT: duracion, contador en navbar, expiracion y redireccion al login.
 */
(function (window) {
    "use strict";

    const STORAGE_TOKEN = "JwtToken";
    const STORAGE_USER = "userSession";
    const STORAGE_EXPIRES = "sessionExpiresAt";
    const KEY_SESION_EXPIRADA = "sesionExpirada";
    const KEY_LOGOUT_VOLUNTARIO = "logoutVoluntario";
    const KEY_WARNING_DISMISSED = "sessionWarningDismissed";
    const KEY_JTI = "sessionJti";
    /** Segundos restantes para mostrar cartel / contador (5:00 o menos). */
    const WARNING_SECONDS = 5 * 60;
    const API_RENOVAR = "/Login/RenovarSesion";
    const API_HEARTBEAT = "/Login/Heartbeat";
    const API_DESCONEXION = "/Login/RegistrarDesconexion";
    /** 1 min: el servidor considera online hasta 5 min sin latido. */
    const HEARTBEAT_MS = 60 * 1000;
    /** Pantalla a la que entra el usuario ya logueado. */
    const HOME_URL = "/Proveedores";

    let countdownTimer = null;
    let heartbeatTimer = null;
    let expiredModalShown = false;
    let warningModalVisible = false;
    let warningDismissed = false;
    let renewingSession = false;
    let voluntaryLogout = false;
    let warningModalInstance = null;

    function isLoginPage() {
        const path = (window.location.pathname || "").toLowerCase();
        return path.includes("/login");
    }

    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function decodeJwtExpMs(token) {
        if (!token || token.split(".").length < 2) return null;
        try {
            const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            const json = decodeURIComponent(
                atob(base64)
                    .split("")
                    .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                    .join("")
            );
            const payload = JSON.parse(json);
            if (payload.exp) return payload.exp * 1000;
        } catch (e) {
            console.warn("SessionManager: no se pudo leer exp del token", e);
        }
        return null;
    }

    function decodeJwtJti(token) {
        try {
            const part = String(token || "").split(".")[1];
            if (!part) return null;
            const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
            const payload = JSON.parse(json);
            return payload.jti || payload.Jti || null;
        } catch {
            return null;
        }
    }

    function getExpiresAtMs() {
        const stored = localStorage.getItem(STORAGE_EXPIRES);
        if (stored) {
            const n = parseInt(stored, 10);
            if (!Number.isNaN(n)) return n;
        }
        return decodeJwtExpMs(localStorage.getItem(STORAGE_TOKEN));
    }

    function getToken() {
        return localStorage.getItem(STORAGE_TOKEN);
    }

    function isSessionValid() {
        const token = getToken();
        if (!token) return false;
        const exp = getExpiresAtMs();
        if (!exp) return false;
        return Date.now() < exp;
    }

    function isSessionExpired() {
        const exp = getExpiresAtMs();
        return !!exp && Date.now() >= exp;
    }

    function stopCountdown() {
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
    }

    function resolveModuloActual() {
        if (window.RpModulos && typeof window.RpModulos.current === "function") {
            return window.RpModulos.current();
        }
        // Fallback si el layout no cargó RpModulos
        const path = (window.location.pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
        if (path.indexOf("/login") === 0) return null;
        const map = [
            [["/proveedores", "/proveedorescuentacorriente", "/proveedoresinsumos", "/compras", "/ordenescompras"], "Proveedores"],
            [["/recetas", "/subrecetas"], "Recetas"],
            [["/insumos"], "Insumos"],
            [["/ventas"], "Ventas"],
            [["/analisisdatos"], "AnalisisDatos"],
            [["/usuarios"], "Usuarios"]
        ];
        for (let i = 0; i < map.length; i++) {
            const prefixes = map[i][0];
            const key = map[i][1];
            for (let j = 0; j < prefixes.length; j++) {
                const p = prefixes[j];
                if (path === p || path.startsWith(p + "/")) return key;
            }
        }
        return null;
    }

    function sendHeartbeat() {
        if (isLoginPage() || !isSessionValid()) return;
        if (document.visibilityState === "hidden") return;
        const token = localStorage.getItem(STORAGE_TOKEN);
        if (!token) return;

        fetch(API_HEARTBEAT, {
            method: "POST",
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ modulo: resolveModuloActual() })
        }).catch(() => { /* ignore */ });
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    function startHeartbeat() {
        stopHeartbeat();
        if (isLoginPage() || !isSessionValid()) return;

        sendHeartbeat();
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);

        if (!window.__rpHeartbeatVisibilityBound) {
            window.__rpHeartbeatVisibilityBound = true;
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") sendHeartbeat();
            });
            window.addEventListener("pageshow", () => sendHeartbeat());
        }
    }

    /** motivo: 2=cierre manual, 3=sesión expirada. */
    async function registrarDesconexion(motivo) {
        const token = localStorage.getItem(STORAGE_TOKEN);
        if (!token) return;
        const jti = sessionStorage.getItem(KEY_JTI) || decodeJwtJti(token) || "";
        try {
            await fetch(`${API_DESCONEXION}?motivo=${motivo}&jti=${encodeURIComponent(jti)}`, {
                method: "POST",
                headers: { Authorization: "Bearer " + token },
                keepalive: true
            });
        } catch {
            /* ignore */
        }
    }

    function clearSession() {
        stopHeartbeat();
        localStorage.removeItem(STORAGE_TOKEN);
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_EXPIRES);
        sessionStorage.removeItem(KEY_JTI);
        window.token = null;
    }

    function markSessionExpired() {
        sessionStorage.setItem(KEY_SESION_EXPIRADA, "1");
    }

    function clearExpiredFlag() {
        sessionStorage.removeItem(KEY_SESION_EXPIRADA);
    }

    function setWarningDismissed(value) {
        warningDismissed = !!value;
        if (warningDismissed) {
            sessionStorage.setItem(KEY_WARNING_DISMISSED, "1");
        } else {
            sessionStorage.removeItem(KEY_WARNING_DISMISSED);
        }
    }

    function loadWarningDismissed() {
        warningDismissed = sessionStorage.getItem(KEY_WARNING_DISMISSED) === "1";
    }

    function redirectToLogin(expired) {
        stopCountdown();
        stopHeartbeat();

        const go = () => {
            if (isLoginPage()) return;
            window.location.replace("/Login/Index");
        };

        if (expired) markSessionExpired();

        const token = localStorage.getItem(STORAGE_TOKEN);
        if (expired && token && !voluntaryLogout) {
            registrarDesconexion(3).finally(() => {
                clearSession();
                go();
            });
            return;
        }

        clearSession();
        go();
    }

    /** Cierre de sesion manual (navbar): sin mensaje de expiracion. */
    async function beginVoluntaryLogout() {
        voluntaryLogout = true;
        stopCountdown();
        clearExpiredFlag();
        sessionStorage.setItem(KEY_LOGOUT_VOLUNTARIO, "1");
        sessionStorage.removeItem(KEY_WARNING_DISMISSED);
        await registrarDesconexion(2);
        clearSession();
    }

    function formatRemaining(ms) {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    }

    function formatRemainingShort(ms) {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${pad2(m)}:${pad2(s)}`;
    }

    function getRemainingMs() {
        const exp = getExpiresAtMs();
        if (!exp) return 0;
        return Math.max(0, exp - Date.now());
    }

    function getRemainingSeconds() {
        return Math.max(0, Math.floor(getRemainingMs() / 1000));
    }

    /** Cartel y contador solo con 5:00 o menos (p. ej. 5:57 no entra; 5:00 si). */
    function shouldShowSessionCartel() {
        const sec = getRemainingSeconds();
        return sec > 0 && sec <= WARNING_SECONDS;
    }

    function isInWarningWindow() {
        return shouldShowSessionCartel();
    }

    function getWarningModal() {
        const el = document.getElementById("modalSessionPorExpirar");
        if (!el || !window.bootstrap?.Modal) return null;
        if (!warningModalInstance) {
            warningModalInstance = new bootstrap.Modal(el, {
                backdrop: "static",
                keyboard: false
            });
        }
        return warningModalInstance;
    }

    function updateWarningModalCountdown(remaining) {
        const el = document.getElementById("modalSessionPorExpirarCountdown");
        if (el) el.textContent = formatRemainingShort(remaining);
    }

    function hideWarningModal() {
        const modal = getWarningModal();
        if (modal && warningModalVisible) {
            modal.hide();
        }
        warningModalVisible = false;
    }

    function showWarningModal() {
        if (warningDismissed || warningModalVisible || expiredModalShown || voluntaryLogout || isLoginPage()) {
            return;
        }
        if (!isInWarningWindow()) return;

        const modal = getWarningModal();
        if (!modal) return;

        updateWarningModalCountdown(getRemainingMs());
        modal.show();
        warningModalVisible = true;

        const btnContinuar = document.getElementById("btnSessionPorExpirarContinuar");
        if (btnContinuar) {
            btnContinuar.onclick = () => {
                setWarningDismissed(true);
                hideWarningModal();
            };
        }

        const btnRenovar = document.getElementById("btnSessionRenovar");
        if (btnRenovar) {
            btnRenovar.onclick = () => renovarSesion();
        }
    }

    function syncWarningModal() {
        const remaining = getRemainingMs();
        const sec = getRemainingSeconds();

        if (sec > WARNING_SECONDS) {
            hideWarningModal();
            setWarningDismissed(false);
            return;
        }

        if (sec <= 0) {
            hideWarningModal();
            return;
        }

        if (warningModalVisible) {
            updateWarningModalCountdown(remaining);
            return;
        }

        if (!warningDismissed) {
            showWarningModal();
        }
    }

    function syncSessionCartelVisibility() {
        const navItem = document.getElementById("sessionCountdownNav")
            || document.getElementById("sessionCountdown")?.closest(".nav-item");
        const visible = shouldShowSessionCartel();

        if (navItem) {
            navItem.classList.toggle("d-none", !visible);
        }
    }

    async function renovarSesion() {
        if (renewingSession || voluntaryLogout || isLoginPage()) return;

        const confirmar = typeof window.confirmarModal === "function"
            ? window.confirmarModal
            : (msg) => Promise.resolve(window.confirm(msg));

        const ok = await confirmar("¿Desea renovar la sesión?");
        if (!ok) return;

        hideWarningModal();

        const token = getToken();
        if (!token) {
            handleSessionExpired();
            return;
        }

        const btn = document.getElementById("btnSessionRenovar");
        renewingSession = true;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin me-1"></i> Renovando...';
        }

        try {
            const response = await fetch(API_RENOVAR, {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success || !data.token) {
                const msg = data.message || "No se pudo renovar la sesión.";
                if (typeof window.errorModal === "function") {
                    window.errorModal(msg);
                } else {
                    alert(msg);
                }
                return;
            }

            let user = null;
            try {
                user = JSON.parse(localStorage.getItem(STORAGE_USER) || "null");
            } catch { /* ignore */ }

            const expMs = data.expiresAtUnixMs
                ? parseInt(data.expiresAtUnixMs, 10)
                : (data.expiresAt ? Date.parse(data.expiresAt) : null);

            setSession(data.token, user, expMs, data.jti);
            setWarningDismissed(false);
            updateCountdownUi();

            if (typeof window.exitoModal === "function") {
                window.exitoModal("Sesión renovada correctamente.");
            }
        } catch (e) {
            console.error("SessionManager: error al renovar", e);
            if (typeof window.errorModal === "function") {
                window.errorModal("Error de conexión al renovar la sesión.");
            }
        } finally {
            renewingSession = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa fa-refresh me-1"></i> Renovar sesión';
            }
        }
    }

    function updateCountdownUi() {
        const wrap = document.getElementById("sessionCountdown");
        const text = document.getElementById("sessionCountdownText");
        if (!text) return true;

        if (!isSessionValid()) {
            text.textContent = "00:00:00";
            if (wrap) {
                wrap.classList.add("rp-session-expired");
                wrap.classList.remove("rp-session-warning");
            }
            syncSessionCartelVisibility();
            hideWarningModal();
            return false;
        }

        const remaining = getRemainingMs();
        text.textContent = formatRemaining(remaining);

        syncSessionCartelVisibility();

        if (wrap) {
            wrap.classList.remove("rp-session-expired");
            const warn = isInWarningWindow();
            wrap.classList.toggle("rp-session-warning", warn);
            if (warn) {
                wrap.style.cursor = "pointer";
                wrap.title = "Clic para ver opciones de renovación";
                wrap.onclick = (e) => {
                    e.preventDefault();
                    setWarningDismissed(false);
                    showWarningModal();
                };
            } else {
                wrap.style.cursor = "";
                wrap.title = "Tiempo restante de sesión";
                wrap.onclick = null;
            }
        }

        syncWarningModal();
        return true;
    }

    function showSessionExpiredModal() {
        if (expiredModalShown || isLoginPage() || voluntaryLogout) return;
        expiredModalShown = true;
        markSessionExpired();
        hideWarningModal();

        stopCountdown();

        const modalEl = document.getElementById("modalSessionExpirada");
        if (!modalEl || !window.bootstrap?.Modal) {
            redirectToLogin(true);
            return;
        }

        const modal = new bootstrap.Modal(modalEl, {
            backdrop: "static",
            keyboard: false
        });

        const btn = document.getElementById("btnSessionExpiradaAceptar");
        if (btn) {
            btn.onclick = () => {
                modal.hide();
                redirectToLogin(true);
            };
        }

        modalEl.addEventListener("hidden.bs.modal", () => {
            redirectToLogin(true);
        }, { once: true });

        modal.show();
    }

    function handleSessionExpired() {
        if (voluntaryLogout || isLoginPage()) return;

        if (isSessionExpired() || sessionStorage.getItem(KEY_SESION_EXPIRADA) === "1") {
            markSessionExpired();
            showSessionExpiredModal();
            return;
        }

        redirectToLogin(false);
    }

    function startCountdown() {
        stopCountdown();

        if (!updateCountdownUi()) {
            handleSessionExpired();
            return;
        }

        countdownTimer = setInterval(() => {
            if (voluntaryLogout) return;
            if (!updateCountdownUi()) {
                handleSessionExpired();
            }
        }, 1000);
    }

    function installFetchInterceptor() {
        if (window.__fetchSessionPatched) return;
        window.__fetchSessionPatched = true;

        const originalFetch = window.fetch.bind(window);
        window.fetch = async function (input, init) {
            if (voluntaryLogout || isLoginPage()) {
                return originalFetch(input, init);
            }

            if (!isSessionValid()) {
                handleSessionExpired();
                return new Response(null, { status: 401, statusText: "Session expired" });
            }

            const response = await originalFetch(input, init);

            if (response.status === 401 && !voluntaryLogout) {
                handleSessionExpired();
            }

            return response;
        };
    }

    function setSession(token, user, expiresAtMs, jti) {
        if (!token) return;

        voluntaryLogout = false;
        clearExpiredFlag();
        sessionStorage.removeItem(KEY_LOGOUT_VOLUNTARIO);

        let exp = expiresAtMs;
        if (!exp) exp = decodeJwtExpMs(token);

        localStorage.setItem(STORAGE_TOKEN, token);
        if (user) localStorage.setItem(STORAGE_USER, JSON.stringify(user));
        if (exp) localStorage.setItem(STORAGE_EXPIRES, String(exp));

        const resolvedJti = jti || decodeJwtJti(token);
        if (resolvedJti) sessionStorage.setItem(KEY_JTI, resolvedJti);

        window.token = token;
        expiredModalShown = false;
        setWarningDismissed(false);
        warningModalVisible = false;
        startHeartbeat();
    }

    function guardPage() {
        if (isLoginPage()) {
            const logoutVoluntario = sessionStorage.getItem(KEY_LOGOUT_VOLUNTARIO) === "1";
            sessionStorage.removeItem(KEY_LOGOUT_VOLUNTARIO);

            if (logoutVoluntario) {
                clearExpiredFlag();
            }

            if (isSessionValid()) {
                window.location.replace(HOME_URL);
            } else {
                clearSession();
            }
            return;
        }

        if (!isSessionValid()) {
            if (voluntaryLogout || sessionStorage.getItem(KEY_LOGOUT_VOLUNTARIO) === "1") {
                redirectToLogin(false);
                return;
            }

            if (isSessionExpired()) {
                handleSessionExpired();
            } else {
                redirectToLogin(false);
            }
            return;
        }

        window.token = getToken();
        loadWarningDismissed();
        installFetchInterceptor();
        syncSessionCartelVisibility();
        hideWarningModal();
        startHeartbeat();
        startCountdown();
    }

    function shouldShowExpiredMessageOnLogin() {
        if (sessionStorage.getItem(KEY_LOGOUT_VOLUNTARIO) === "1") {
            return false;
        }
        return sessionStorage.getItem(KEY_SESION_EXPIRADA) === "1";
    }

    function consumeExpiredMessageOnLogin() {
        const show = shouldShowExpiredMessageOnLogin();
        clearExpiredFlag();
        sessionStorage.removeItem(KEY_LOGOUT_VOLUNTARIO);
        return show;
    }

    function init() {
        if (window.__sessionManagerInitialized) return;
        window.__sessionManagerInitialized = true;

        guardPage();

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && !isLoginPage() && !voluntaryLogout) {
                if (!isSessionValid()) handleSessionExpired();
                else updateCountdownUi();
            }
        });
    }

    window.SessionManager = {
        setSession,
        clearSession,
        beginVoluntaryLogout,
        getToken,
        isSessionValid,
        getExpiresAtMs,
        getRemainingMs,
        decodeJwtExpMs,
        redirectToLogin,
        handleSessionExpired,
        renovarSesion,
        sendHeartbeat,
        startHeartbeat,
        stopHeartbeat,
        registrarDesconexion,
        startCountdown,
        stopCountdown,
        guardPage,
        formatRemaining,
        formatRemainingShort,
        getRemainingSeconds,
        shouldShowSessionCartel,
        shouldShowExpiredMessageOnLogin,
        consumeExpiredMessageOnLogin,
        WARNING_SECONDS
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})(window);
