let timerError; // Mover la variable fuera del evento para que sea accesible globalmente

document.querySelector('#formularioActualizar').addEventListener('submit', async function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    console.log(data);

    // Realiza la solicitud PUT
    const response = await fetch('/Usuarios/Actualizar', {
        method: 'PUT',  // Aquí es donde usamos el método PUT
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    const result = await response.json();

    const msjError = $('#msjerror');
    const btnGuardar = $('#btnGuardar');
    msjError.attr("hidden", false);

    // Limpiar cualquier temporizador previo
    if (timerError) {
        clearTimeout(timerError);
    }

    // Procesar la respuesta
    if (result.valor === "Contrasena") {
        msjError.html('<i class="fa fa-exclamation-circle"></i> Contraseña incorrecta <i class="fa fa-exclamation-circle"></i>');
        msjError.css('color', 'red');
        btnGuardar.show();
        timerError = setTimeout(() => {
            msjError.attr("hidden", true);
        }, 6000);

    } else if (result.valor === "OK") {
        msjError.html('<i class="fa fa-check-circle"></i> Datos guardados correctamente <i class="fa fa-check-circle"></i><br>En <span id="contador">5</span> segundos serás redirigido a la página principal.');
        msjError.css('color', 'green');
        btnGuardar.hide();
        let seconds = 5;
        const interval = setInterval(() => {
            seconds--;
            $('#contador').text(seconds);
            if (seconds === 0) {
                clearInterval(interval);
                window.location.href = '/Operaciones/';
            }
        }, 1000);
    } else {
        msjError.html('<i class="fa fa-exclamation-circle"></i> Ha ocurrido un error al actualizar los datos. <i class="fa fa-exclamation-circle"></i>');
        msjError.css('color', 'red');
        btnGuardar.show();
        timerError = setTimeout(() => {
            msjError.attr("hidden", true);
        }, 6000);
    }

    console.log(result);
});
