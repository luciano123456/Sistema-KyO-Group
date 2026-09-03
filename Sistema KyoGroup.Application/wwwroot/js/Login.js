$(document).ready(function () {

    if (window.SessionManager?.consumeExpiredMessageOnLogin?.()) {
        $("#errorMessage").text("La sesión ha expirado. Iniciá sesión nuevamente.");
        $("#diverrorMessage").show();
    }

    // Toggle mostrar/ocultar contraseña
    $("#togglePassword").on("click", function () {
        var passwordInput = $("#password");
        var icon = $("#togglePasswordIcon");
        var isPassword = passwordInput.attr("type") === "password";

        passwordInput.attr("type", isPassword ? "text" : "password");
        icon.removeClass(isPassword ? "fa-eye" : "fa-eye-slash")
            .addClass(isPassword ? "fa-eye-slash" : "fa-eye");
        $(this).attr({
            "aria-label": isPassword ? "Ocultar contraseña" : "Mostrar contraseña",
            title: isPassword ? "Ocultar contraseña" : "Mostrar contraseña"
        });
    });

    // Verificar si el usuario tiene credenciales guardadas
    if (localStorage.getItem('rememberMe') === 'true') {
        // Si el checkbox estaba seleccionado la última vez
        $("#username").val(localStorage.getItem('username'));
        $("#password").val(localStorage.getItem('password'));
        $("#rememberMe").prop('checked', true);
    }

    // Al enviar el formulario
    $("#loginForm").on("submit", function (event) {
        event.preventDefault(); // Evitar el envío tradicional del formulario

        var username = $("#username").val(); // Obtener el nombre de usuario
        var password = $("#password").val(); // Obtener la contraseña
        var token = $('input[name="__RequestVerificationToken"]').val(); // Obtener token CSRF
        var rememberMe = $("#rememberMe").prop('checked'); // Obtener el estado del checkbox

        return withBusy("#btnLogin", () => {
            $("#diverrorMessage").hide();

            // Crear el objeto de datos para enviar
            var data = {
                Usuario: username,
                Contrasena: password,
                __RequestVerificationToken: token // Enviar el token CSRF
            };

            return fetch(loginUrl, { // Aquí usamos la variable generada por Razor
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': token // Enviar el token CSRF
                },
                body: JSON.stringify(data)
            })
                .then(response => {
                    // Leemos el cuerpo aunque el status sea 401/500: ahí viene el mensaje del servidor
                    return response.json()
                        .catch(() => null)
                        .then(body => {
                            if (!response.ok && !(body && body.message)) {
                                throw new Error("Error en la respuesta del servidor");
                            }
                            return body || {};
                        });
                })
                .then(data => {


                    if (data.success) {
                        const expiresMs = data.expiresAtUnixMs
                            ?? (data.expiresAt ? Date.parse(data.expiresAt) : null)
                            ?? (window.SessionManager?.decodeJwtExpMs?.(data.token) ?? null);

                        if (window.SessionManager?.setSession) {
                            window.SessionManager.setSession(data.token, data.user, expiresMs, data.jti);
                        } else {
                            localStorage.setItem("JwtToken", data.token);
                            localStorage.setItem("userSession", JSON.stringify(data.user));
                            if (expiresMs) localStorage.setItem("sessionExpiresAt", String(expiresMs));
                        }

                        // Si "Recordar credenciales" está seleccionado, guarda las credenciales
                        if (rememberMe) {
                            localStorage.setItem('username', username);
                            localStorage.setItem('password', password);
                            localStorage.setItem('rememberMe', true);
                        } else {
                            // Si no está seleccionado, eliminar las credenciales guardadas
                            localStorage.removeItem('username');
                            localStorage.removeItem('password');
                            localStorage.removeItem('rememberMe');
                        }

                        // Redirigir a la página principal
                        window.location.href = '/Proveedores';
                    } else {
                        $("#errorMessage").text(data.message || "Usuario o contraseña incorrectos.");
                        $("#diverrorMessage").show();
                        setTimeout(function () {
                            $("#diverrorMessage").fadeOut();
                        }, 5000);
                    }
                })
                .catch(error => {
                    console.error("Error: " + error);
                    $("#errorMessage").text("No se pudo conectar con el servidor. Intentá nuevamente.");
                    $("#diverrorMessage").show();
                });
        }, { label: "Ingresando..." });
    });

    // Al cambiar el estado del checkbox, mostrar u ocultar el ícono
    $("#rememberMe").on("change", function () {
        var username = $("#username").val(); // Obtener el nombre de usuario
        var password = $("#password").val(); // Obtener la contraseña
        if ($(this).prop('checked')) {
            localStorage.setItem('username', username);
            localStorage.setItem('password', password);
            localStorage.setItem('rememberMe', true);
        } else {
            localStorage.removeItem('username');
            localStorage.removeItem('password');
            localStorage.removeItem('rememberMe');
        }
    });
});
