$(document).ready(function () {
    // Verificar si el usuario tiene credenciales guardadas
    if (localStorage.getItem('rememberMe') === 'true') {
        // Si el checkbox estaba seleccionado la última vez
        $("#username").val(localStorage.getItem('username'));
        $("#password").val(localStorage.getItem('password'));
        $("#rememberMe").prop('checked', true);
        $("#checkIcon").show(); // Mostrar el ícono verde de check
    }

    // Al enviar el formulario
    $("#loginForm").on("submit", function (event) {
        event.preventDefault(); // Evitar el envío tradicional del formulario

        var username = $("#username").val(); // Obtener el nombre de usuario
        var password = $("#password").val(); // Obtener la contraseña
        var token = $('input[name="__RequestVerificationToken"]').val(); // Obtener token CSRF
        var rememberMe = $("#rememberMe").prop('checked'); // Obtener el estado del checkbox

        // Crear el objeto de datos para enviar
        var data = {
            Usuario: username,
            Contrasena: password,
            __RequestVerificationToken: token // Enviar el token CSRF
        };

        fetch(loginUrl, { // Aquí usamos la variable generada por Razor
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': token // Enviar el token CSRF
            },
            body: JSON.stringify(data)
        })
            .then(response => {
                console.log(response); // Verificar la respuesta
                if (!response.ok) {
                    throw new Error("Error en la respuesta del servidor");
                }
                return response.json(); // Parsear la respuesta JSON
            })
            .then(data => {
                
                
                if (data.success) {
                    localStorage.setItem("JwtToken", data.token)
                    // Si "Recordar credenciales" está seleccionado, guarda las credenciales
                    if (rememberMe) {
                        localStorage.setItem('username', username);
                        localStorage.setItem('password', password);
                        localStorage.setItem('rememberMe', true);
                        $("#checkIcon").show(); // Mostrar el ícono verde de check
                    } else {
                        // Si no está seleccionado, eliminar las credenciales guardadas
                        localStorage.removeItem('username');
                        localStorage.removeItem('password');
                        localStorage.removeItem('rememberMe');
                        $("#checkIcon").hide(); // Ocultar el ícono de check
                    }

                    // Redirigir a la página principal
                    localStorage.setItem('userSession', JSON.stringify(data.user)); // Guardar el usuario
                    window.location.href = 'Usuarios';
                } else {
                    // Mostrar el mensaje de error
                    $(document).ready(function () {
                        // Mostrar el mensaje de error
                        $("#errorMessage").text(data.message).show(); // Establecer el mensaje
                        $("#diverrorMessage").show(); // Mostrar el div

                        // Ocultar el div después de 3 segundos
                        setTimeout(function () {
                            $("#diverrorMessage").fadeOut();
                        }, 3000); // 3000 milisegundos = 3 segundos
                    });
                }
            })
            .catch(error => {
                console.error("Error: " + error);
                $("#errorMessage").text("Hubo un problema al procesar la solicitud. Error: " + error).show();
            });
    });

    // Al cambiar el estado del checkbox, mostrar u ocultar el ícono
    $("#rememberMe").on("change", function () {
        var username = $("#username").val(); // Obtener el nombre de usuario
        var password = $("#password").val(); // Obtener la contraseña
        if ($(this).prop('checked')) {
            $("#checkIcon").show(); // Mostrar el ícono verde de check
            localStorage.setItem('username', username);
            localStorage.setItem('password', password);
            localStorage.setItem('rememberMe', true);
        } else {
            $("#checkIcon").hide(); // Ocultar el ícono de check
            localStorage.removeItem('username');
            localStorage.removeItem('password');
            localStorage.removeItem('rememberMe');
        }
    });
});
