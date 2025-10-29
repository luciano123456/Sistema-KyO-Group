//#########################################################################################################################################################
//#########################################################################################################################################################
//#############################################################################CLIENTES####################################################################
const precioZonaInput = document.getElementById('txtPrecioZona');

let nombreConfiguracion
let controllerConfiguracion;
let listaVacia = false;

async function nuevoCliente() {
    limpiarModalCliente();
    $('#txtNombreCliente').on('input', function () {
        validarCamposCliente()
    });
    validarCamposCliente();
    await listaProvincias();
    $('#ModalEdicionCliente').modal('show');
    $("#btnGuardar").text("Registrar");
    $("#ModalEdicionClienteLabel").text("Nuevo Cliente");
    $('#lblNombre').css('color', 'red');
    $('#txtNombre').css('border-color', 'red');
}


async function listaProvincias() {
    const url = `/Clientes/ListaProvincias`;
    const response = await fetch(url);
    const data = await response.json();

    $('#ProvinciasClientes option').remove();

    selectProvincias = document.getElementById("ProvinciasClientes");

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        selectProvincias.appendChild(option);

    }
}

function limpiarModalCliente() {
    const campos = ["IdCliente", "NombreCliente", "TelefonoCliente", "DireccionCliente", "IdProvinciaCliente", "LocalidadCliente", "DNICliente"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val("");
    });

    $("#lblNombre, #txtNombre").css("color", "").css("border-color", "");
}

function registrarCliente() {
    if (validarCamposCliente()) {
        const idCliente = $("#txtIdCliente").val();
        const nuevoModelo = {
            "Id": idCliente !== "" ? idCliente : 0,
            "Nombre": $("#txtNombreCliente").val(),
            "Telefono": $("#txtTelefonoCliente").val(),
            "Direccion": $("#txtDireccionCliente").val(),
            "IdProvincia": $("#ProvinciasClientes").val(),
            "Localidad": $("#txtLocalidadCliente").val(),
            "DNI": $("#txtDNICliente").val()
        };

        const url = "Clientes/Insertar";
        const method = idCliente === "" ? "POST" : "PUT";

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(dataJson => {
                const mensaje = idCliente === "" ? "Cliente registrado correctamente" : "Cliente modificado correctamente";
                $('#ModalEdicionCliente').modal('hide');
                exitoModal(mensaje);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        errorModal('Debes completar los campos requeridos');
    }
}


function validarCamposCliente() {
    const nombre = $("#txtNombreCliente").val();
    const camposValidos = nombre !== "";

    $("#lblNombreCliente").css("color", camposValidos ? "" : "red");
    $("#txtNombreCliente").css("border-color", camposValidos ? "" : "red");


    return camposValidos;
}

//##########################################################################################################################################################
//##########################################################################################################################################################
//#############################################################################Proveedores#################################################################


function registrarProveedor() {
    if (validarCamposProveedor()) {
        const idProveedor = $("#txtIdProveedor").val();
        const nuevoModelo = {
            "Id": idProveedor !== "" ? idProveedor : 0,
            "Nombre": $("#txtNombreProveedor").val(),
            "Apodo": $("#txtApodoProveedor").val(),
            "Ubicacion": $("#txtUbicacionProveedor").val(),
            "Telefono": $("#txtTelefonoProveedor").val(),
        };

        const url = "Proveedores/Insertar";
        const method = "POST";

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(dataJson => {
                const mensaje = "Proveedor registrado correctamente";
                $('#ModalEdicionProveedor').modal('hide');
                exitoModal(mensaje);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        errorModal('Debes completar los campos requeridos');
    }
}


function validarCamposProveedor() {
    const nombre = $("#txtNombreProveedor").val();
    const camposValidos = nombre !== "";

    $("#lblNombreProveedor").css("color", camposValidos ? "" : "red");
    $("#txtNombreProveedor").css("border-color", camposValidos ? "" : "red");

    return camposValidos;
}
function nuevoProveedor() {
    $('#txtNombreProveedor').on('input', function () {
        validarCamposProveedor()
    });
    limpiarModalProveedor();
    $('#ModalEdicionProveedor').modal('show');
    $("#btnGuardarProveedor").text("Registrar");
    $("#ModalEdicionProveedorLabel").text("Nuevo Proveedor");
    $('#lblNombreProveedor').css('color', 'red');
    $('#txtNombreProveedor').css('border-color', 'red');
}

async function mostrarModalProveedor(modelo) {
    const campos = ["IdProveedor", "NombreProveedor", "ApodoProveedor", "UbicacionProveedor", "TelefonoProveedor"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val(modelo[campo]);
    });


    $('#modalEdicionProveedor').modal('show');
    $("#btnGuardarProveedor").text("Guardar");
    $("#modalEdicionProveedorLabel").text("Editar Proveedor");

    $('#lblNombreProveedor, #txtNombreProveedor').css('color', '').css('border-color', '');
}




function limpiarModalProveedor() {
    const campos = ["IdProveedor", "NombreProveedor", "ApodoProveedor", "UbicacionProveedor", "TelefonoProveedor"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val("");
    });

    $("#lblNombreProveedor, #txtNombreProveedor").css("color", "").css("border-color", "");
}


//##########################################################################################################################################################
//##########################################################################################################################################################
//#########################################################################CHOFERES########################################################################

function registrarChofer() {
    if (validarCamposChofer()) {
        const idChofer = $("#txtIdChofer").val();
        const nuevoModelo = {
            "Id": idChofer !== "" ? idChofer : 0,
            "Nombre": $("#txtNombreChofer").val(),
            "Telefono": $("#txtTelefonoChofer").val(),
            "Direccion": $("#txtDireccionChofer").val(),
            "DNI": $("#txtDNIChofer").val()
        };

        const url = "Choferes/Insertar";
        const method = "POST";

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(dataJson => {
                const mensaje = "Chofer registrado correctamente";
                $('#modalEdicionChofer').modal('hide');
                exitoModal(mensaje);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        errorModal('Debes completar los campos requeridos');
    }
}


function validarCamposChofer() {
    const nombre = $("#txtNombreChofer").val();
    const camposValidos = nombre !== "";

    $("#lblNombreChofer").css("color", camposValidos ? "" : "red");
    $("#txtNombreChofer").css("border-color", camposValidos ? "" : "red");

    return camposValidos;
}
function nuevoChofer() {
    limpiarModal();

    $('#txtNombreChofer').on('input', function () {
        validarCamposChofer()
    });

    $('#modalEdicionChofer').modal('show');
    $("#btnGuardarChofer").text("Registrar");
    $("#modalEdicionChoferLabel").text("Nuevo Chofer");
    $('#lblNombreChofer').css('color', 'red');
    $('#txtNombreChofer').css('border-color', 'red');
}



async function mostrarModalChofer(modelo) {
    const campos = ["IdChofer", "NombreChofer", "TelefonoChofer", "DireccionChofer"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val(modelo[campo]);
    });


    $('#modalEdicionChofer').modal('show');
    $("#btnGuardarChofer").text("Guardar");
    $("#modalEdicionChoferLabel").text("Editar Chofer");

    $('#lblNombreChofer, #txtNombreChofer').css('color', '').css('border-color', '');
}

function limpiarModal() {
    const campos = ["IdChofer", "NombreChofer", "TelefonoChofer", "DireccionChofer"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val("");
    });

    $("#lblNombreChofer, #txtNombreChofer").css("color", "").css("border-color", "");
}



//##########################################################################################################################################################
//##########################################################################################################################################################
//#########################################################################ZONAS########################################################################

function registrarZona() {
    if (validarCamposZona()) {
        const idZona = $("#txtIdZona").val();
        const nuevoModelo = {
            "Id": idZona !== "" ? idZona : 0,
            "Nombre": $("#txtNombreZona").val(),
            "Precio": formatoNumero($("#txtPrecioZona").val()),
        };

        const url = "Zonas/Insertar";
        const method = "POST";

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(dataJson => {
                const mensaje = "Zona registrada correctamente";
                $('#modalEdicionZona').modal('hide');
                exitoModal(mensaje);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        errorModal('Debes completar los campos requeridos');
    }
}


function validarCamposZona() {
    const nombre = $("#txtNombreZona").val();
    const camposValidos = nombre !== "";

    $("#lblNombreZona").css("color", camposValidos ? "" : "red");
    $("#txtNombreZona").css("border-color", camposValidos ? "" : "red");

    return camposValidos;
}
function nuevaZona() {
    limpiarModalZona();

    $('#txtNombreZona').on('input', function () {
        validarCamposZona()
    });

    $('#modalEdicionZona').modal('show');
    $("#btnGuardarZona").text("Registrar");
    $("#modalEdicionZonaLabel").text("Nueva Zona");
    $('#lblNombreZona').css('color', 'red');
    $('#txtNombreZona').css('border-color', 'red');
}



async function mostrarModalZona(modelo) {
    const campos = ["IdZona", "NombreZona", "PrecioZona"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val(modelo[campo]);
    });


    $('#modalEdicionZona').modal('show');
    $("#btnGuardarZona").text("Guardar");
    $("#modalEdicionZonaLabel").text("Editar Chofer");

    $('#lblNombreZona, #txtNombreZona').css('color', '').css('border-color', '');
}

function limpiarModalZona() {
    const campos = ["IdZona", "NombreZona", "PrecioZona"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val("");
    });

    $("#lblNombreZona, #txtNombreZona").css("color", "").css("border-color", "");
}

//##########################################################################################################################################################
//##########################################################################################################################################################
//#########################################################################USUARIOS#########################################################################

function registrarUsuario() {
    if (validarCamposUsuario()) {
        const nuevoModelo = {
            "Id": 0,
            "Usuario": $("#txtUserUsuario").val(),
            "Nombre": $("#txtNombreUsuario").val(),
            "Apellido": $("#txtApellidoUsuario").val(),
            "DNI": $("#txtDniUsuario").val(),
            "Telefono": $("#txtTelefonoUsuario").val(),
            "Direccion": $("#txtDireccionUsuario").val(),
            "IdRol": $("#RolesUsuario").val(),
            "IdEstado": $("#EstadosUsuario").val(),
            "Contrasena": $("#txtContrasenaUsuario").val()
        };

        const url = "Usuarios/Insertar";
        const method = "POST";

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(dataJson => {
                const mensaje = "Usuario registrado correctamente";
                $('#ModalEdicionUsuario').modal('hide');
                exitoModal(mensaje);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        errorModal('Debes completar los campos requeridos');
    }
}


function validarCamposUsuario() {
    const nombre = $("#txtNombreUsuario").val();
    const usuario = $("#txtUserUsuario").val();
    const apellido = $("#txtApellidoUsuario").val();
    const contrasena = $("#txtContrasenaUsuario").val();


    // Validación independiente para cada campo
    const nombreValido = nombre !== "";
    const usuarioValido = usuario !== "";
    const apellidoValido = apellido !== "";
    const contrasenaValido = contrasena !== "";

    // Cambiar el color de texto y borde según la validez de los campos
    $("#lblNombreUsuario").css("color", nombreValido ? "" : "red");
    $("#txtNombreUsuario").css("border-color", nombreValido ? "" : "red");

    $("#lblUserUsuario").css("color", usuarioValido ? "" : "red");
    $("#txtUserUsuario").css("border-color", usuarioValido ? "" : "red");

    $("#lblApellidoUsuario").css("color", apellidoValido ? "" : "red");
    $("#txtApellidoUsuario").css("border-color", apellidoValido ? "" : "red");


    $("#lblContrasenaUsuario").css("color", contrasenaValido ? "" : "red");
    $("#txtContrasenaUsuario").css("border-color", contrasenaValido ? "" : "red");



    // La función retorna 'true' si todos los campos son válidos, de lo contrario 'false'
    return nombreValido && usuarioValido && apellidoValido && contrasenaValido;
}



function nuevoUsuario() {
    limpiarModalUsuario();

    $('#txtNombreUsuario, #txtUserUsuario, #txtApellidoUsuario, #txtContrasenaUsuario').on('input', function () {
        validarCamposUsuario()
    });

    listaEstados();
    listaRoles();

    $('#ModalEdicionUsuario').modal('show');
    $("#btnGuardarUsuario").text("Registrar");
    $("#ModalEdicionUsuarioLabel").text("Nuevo Usuario");
    $('#lblUserUsuario').css('color', 'red');
    $('#txtUserUsuario').css('border-color', 'red');

    $('#lblNombreUsuario').css('color', 'red');
    $('#txtNombreUsuario').css('border-color', 'red');

    $('#lblApellidoUsuario').css('color', 'red');
    $('#txtApellidoUsuario').css('border-color', 'red');

    $('#lblContrasenaUsuario').css('color', 'red');
    $('#txtContrasenaUsuario').css('border-color', 'red');
}


function limpiarModalUsuario() {
    const campos = ["IdUsuario", "UserUsuario", "NombreUsuario", "ApellidoUsuario", "DniUsuario", "TelefonoUsuario", "DireccionUsuario", "ContrasenaUsuario"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val("");
    });

     $('#lblUserUsuario, #txtUserUsuario').css('color', '').css('border-color', '');
    $('#lblNombreUsuario, #txtNombreUsuario').css('color', '').css('border-color', '');
    $('#lblApellidoUsuario, #txtApellidoUsuario').css('color', '').css('border-color', '');
}


//##########################################################################################################################################################
//##########################################################################################################################################################
//#########################################################################PRODUCTOS########################################################################

function nuevoProducto() {

    limpiarModalProducto();
    listaMarcasProducto();
    listaCategoriasProducto();
    listaMonedasProducto();
    listaUnidadesDeMedidaProducto();
    document.getElementById("MarcasProducto").removeAttribute("disabled");
    document.getElementById("txtDescripcionProducto").removeAttribute("disabled");
    document.getElementById("CategoriasProducto").removeAttribute("disabled");
    document.getElementById("MonedasProducto").removeAttribute("disabled");
    document.getElementById("Imagen").removeAttribute("disabled");
    document.getElementById("UnidadesDeMedidasProducto").removeAttribute("disabled");
    document.getElementById("txtPrecioCostoProducto").classList.remove("txtEdicion");
    document.getElementById("txtPorcentajeGananciaProducto").classList.remove("txtEdicion");
    document.getElementById("txtPrecioVentaProducto").classList.remove("txtEdicion");
    $('#modalEdicionProductos').modal('show');
    $("#btnGuardarProducto").text("Registrar");
    $("#modalEdicionProductoLabel").text("Nuevo Producto");
    asignarCamposObligatoriosProducto()
}


function asignarCamposObligatoriosProducto() {
    $('#lblDescripcionProducto').css('color', 'red');
    $('#txtDescripcionProducto').css('border-color', 'red');
    $('#lblPrecioCostoProducto').css('color', 'red');
    $('#txtPrecioCostoProducto').css('border-color', 'red');
    $('#lblPorcentajeGananciaProducto').css('color', 'red');
    $('#txtPorcentajeGananciaProducto').css('border-color', 'red');
}

async function listaMarcasProducto() {
    const url = `/Marcas/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    $('#MarcasProducto option').remove();

    select = document.getElementById("MarcasProducto");

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}

async function listaCategoriasProducto() {
    const url = `/Categorias/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    $('#CategoriasProducto option').remove();

    select = document.getElementById("CategoriasProducto");

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}

async function listaMonedasProducto() {
    const url = `/Monedas/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    $('#MonedasProducto option').remove();

    select = document.getElementById("MonedasProducto");

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}

async function listaUnidadesDeMedidaProducto() {
    const url = `/UnidadesDeMedidas/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    $('#UnidadesDeMedidasProducto option').remove();

    select = document.getElementById("UnidadesDeMedidasProducto");

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}

function limpiarModalProducto() {
    const campos = ["IdProducto", "DescripcionProducto", "PrecioCostoProducto", "PrecioVentaProducto", "PorcentajeGananciaProducto"];
    campos.forEach(campo => {
        $(`#txt${campo}`).val("");
    });

    $("#imgProducto").attr("src", "");
    $("#imgProd").val("");

}

function registrarProducto() {
    if (validarCamposProducto()) {
        sumarPorcentajeProducto(); //Por si las dudas
        const idProducto = $("#txtIdProducto").val();
        const nuevoModelo = {
            IdCliente: -1,
            IdProveedor: -1,
            "Id": idProducto !== "" ? idProducto : 0,
            "Descripcion": $("#txtDescripcionProducto").val(),
            "IdMarca": $("#MarcasProducto").val(),
            "IdCategoria": $("#CategoriasProducto").val(),
            "IdMoneda": $("#MonedasProducto").val(),
            "IdUnidadDeMedida": $("#UnidadesDeMedidasProducto").val(),
            "PCosto": parseDecimal($("#txtPrecioCostoProducto").val()),
            "PVenta": parseDecimal($("#txtPrecioVentaProducto").val()),
            "PorcGanancia": parseDecimal($("#txtPorcentajeGananciaProducto").val()),
            "Image": document.getElementById("imgProd").value,
        };

        const url = "Productos/Insertar";
        const method = "POST";

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(dataJson => {
                const mensaje = "Producto registrado correctamente";
                $('#modalEdicionProductos').modal('hide');
                exitoModal(mensaje);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        errorModal('Debes completar los campos requeridos');
    }
}


function abrirConfiguraciones() {
    $('#ModalEdicionConfiguraciones').modal('show');
    $("#btnGuardarConfiguracion").text("Aceptar");
    $("#modalEdicionLabel").text("Configuraciones");
}

async function listaMarcas() {
    const url = `/Productos/ListaMarcas`;
    const response = await fetch(url);
    const data = await response.json();

    return data.map(marca => ({
        Id: marca.Id,
        Nombre: marca.Nombre
    }));

}

async function listaConfiguracion() {
    const url = `/${controllerConfiguracion}/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    return data.map(configuracion => ({
        Id: configuracion.Id,
        Nombre: configuracion.Nombre
    }));

}

$('#txtDescripcionProducto, #txtPorcentajeGananciaProducto').on('input', function () {
    validarCamposProducto()
});

$('#txtPrecioCostoProducto').on('input', function () {
    validarCamposProducto()
    sumarPorcentajeProducto()

});
$('#txtPorcentajeGananciaProducto').on('input', function () {
    sumarPorcentajeProducto()
});

$('#txtPrecioVentaProducto').on('input', function () {
    calcularPorcentajeProducto()
});

const fileInput = document.getElementById("Imagen");

fileInput.addEventListener("change", (e) => {
    var files = e.target.files
    let base64String = "";
    let baseTotal = "";

    // get a reference to the file
    const file = e.target.files[0];



    // encode the file using the FileReader API
    const reader = new FileReader();
    reader.onloadend = () => {
        // use a regex to remove data url part

        base64String = reader.result
            .replace("data:", "")
            .replace(/^.+,/, "");


        var inputImg = document.getElementById("imgProd");
        inputImg.value = base64String;

        $("#imgProducto").removeAttr('hidden');
        $("#imgProducto").attr("src", "data:image/png;base64," + base64String);

    };

    reader.readAsDataURL(file);

}
);

function sumarPorcentajeProducto() {
    let precioCosto = Number($("#txtPrecioCostoProducto").val());
    let porcentajeGanancia = Number($("#txtPorcentajeGananciaProducto").val());

    if (!isNaN(precioCosto) && !isNaN(porcentajeGanancia)) {
        let precioVenta = precioCosto + (precioCosto * (porcentajeGanancia / 100));
        // Limitar el precio de venta a 2 decimales
        precioVenta = precioVenta.toFixed(2);
        $("#txtPrecioVentaProducto").val(precioVenta);
    }
}


function calcularPorcentajeProducto() {
    let precioCosto = Number($("#txtPrecioCostoProducto").val());
    let precioVenta = Number($("#txtPrecioVentaProducto").val());

    if (!isNaN(precioCosto) && !isNaN(precioVenta) && precioCosto !== 0) {
        let porcentajeGanancia = ((precioVenta - precioCosto) / precioCosto) * 100;
        // Limitar el porcentaje de ganancia a 2 decimales
        porcentajeGanancia = porcentajeGanancia.toFixed(2);
        $("#txtPorcentajeGananciaProducto").val(porcentajeGanancia);
    }
}

function validarCamposProducto() {
    const descripcion = $("#txtDescripcionProducto").val();
    const precioCosto = $("#txtPrecioCostoProducto").val();
    const precioVenta = $("#txtPrecioVentaProducto").val();
    const porcentajeGanancia = $("#txtPorcentajeGananciaProducto").val();

    const descripcionValida = descripcion !== "";
    const precioCostoValido = precioCosto !== "" && !isNaN(precioCosto);
    const precioVentaValido = precioVenta !== "" && !isNaN(precioVenta);
    const porcentajeGananciaValido = porcentajeGanancia !== "" && !isNaN(porcentajeGanancia);

    $("#lblDescripcionProducto").css("color", descripcionValida ? "" : "red");
    $("#txtDescripcionProducto").css("border-color", descripcionValida ? "" : "red");

    $("#lblPrecioCostoProducto").css("color", precioCostoValido ? "" : "red");
    $("#txtPrecioCostoProducto").css("border-color", precioCostoValido ? "" : "red");

    $("#lblPorcentajeGananciaProducto").css("color", porcentajeGananciaValido ? "" : "red");
    $("#txtPorcentajeGananciaProducto").css("border-color", porcentajeGananciaValido ? "" : "red");

    return descripcionValida && precioCostoValido && precioVentaValido && porcentajeGananciaValido;
}


async function abrirConfiguracion(_nombreConfiguracion, _controllerConfiguracion) {
    $('#ModalEdicionConfiguraciones').modal('hide');
    $('#modalConfiguracion').modal('show');

    cancelarModificarConfiguracion();

    $('#txtNombreConfiguracion').on('input', function () {
        validarCamposConfiguracion()
    });

    nombreConfiguracion = _nombreConfiguracion;
    controllerConfiguracion = _controllerConfiguracion
    llenarConfiguraciones()


    document.getElementById("modalConfiguracionLabel").innerText = "Configuracion de " + nombreConfiguracion;

}

async function llenarConfiguraciones() {
    let configuraciones = await listaConfiguracion();

    document.getElementById("lblListaVacia").innerText = "";
    document.getElementById("lblListaVacia").setAttribute("hidden", "hidden");

    $("#configuracion-list").empty();

    if (configuraciones.length == 0) {
        document.getElementById("lblListaVacia").innerText = `La lista de ${nombreConfiguracion} esta vacia.`;

        document.getElementById("lblListaVacia").style.color = 'red';
        document.getElementById("lblListaVacia").removeAttribute("hidden");
        listaVacia = true;

    } else {

        listaVacia = false;
        configuraciones.forEach((configuracion, index) => {
            var indexado = configuracion.Id
            $("#configuracion-list").append(`
                         <div class="list-item" data-id="${configuracion.Id}">
                    <span>${configuracion.Nombre}</span>
                    
                    <i class="fa fa-pencil-square-o edit-icon text-white" data-index="${indexado}" onclick="editarConfiguracion(${indexado})" style="float: right;"></i>
                    <i class="fa fa-trash eliminar-icon text-danger" data-index="${indexado}" onclick="eliminarConfiguracion(${indexado})"></i>
                </div>
                    `);
        });
    }
}


async function eliminarConfiguracion(id) {
    let resultado = window.confirm("¿Desea eliminar la " + nombreConfiguracion + "?");

    if (resultado) {
        try {
            const response = await fetch(controllerConfiguracion + "/Eliminar?id=" + id, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error("Error al eliminar la " + nombreConfiguracion);
            }

            const dataJson = await response.json();

            if (dataJson.valor) {
                llenarConfiguraciones()

                exitoModal(nombreConfiguracion + " eliminada correctamente")
            }
        } catch (error) {
            console.error("Ha ocurrido un error:", error);
        }
    }
}


const editarConfiguracion = id => {
    fetch(controllerConfiguracion + "/EditarInfo?id=" + id)
        .then(response => {
            if (!response.ok) throw new Error("Ha ocurrido un error.");
            return response.json();
        })
        .then(dataJson => {
            if (dataJson !== null) {
                document.getElementById("btnRegistrarModificarConfiguracion").textContent = "Modificar";
                document.getElementById("agregarConfiguracion").setAttribute("hidden", "hidden");
                document.getElementById("txtNombreConfiguracion").value = dataJson.Nombre;
                document.getElementById("txtIdConfiguracion").value = dataJson.Id;
                document.getElementById("contenedorNombreConfiguracion").removeAttribute("hidden");
            } else {
                throw new Error("Ha ocurrido un error.");
            }
        })
        .catch(error => {
            errorModal("Ha ocurrido un error.");
        });
}


function validarCamposConfiguracion() {
    const nombre = $("#txtNombreConfiguracion").val();
    const camposValidos = nombre !== "";

    $("#lblNombreConfiguracion").css("color", camposValidos ? "" : "red");
    $("#txtNombreConfiguracion").css("border-color", camposValidos ? "" : "red");

    return camposValidos;
}

function guardarCambiosConfiguracion() {
    if (validarCamposConfiguracion()) {
        const idConfiguracion = $("#txtIdConfiguracion").val();
        const nuevoModelo = {
            "Id": idConfiguracion !== "" ? idConfiguracion : 0,
            "Nombre": $("#txtNombreConfiguracion").val(),
        };

        const url = idConfiguracion === "" ? controllerConfiguracion + "/Insertar" : controllerConfiguracion + "/Actualizar";
        const method = idConfiguracion === "" ? "POST" : "PUT";

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(nuevoModelo)
        })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
            })
            .then(dataJson => {
                const mensaje = idConfiguracion === "" ? nombreConfiguracion + " registrada correctamente" : nombreConfiguracion + " modificada correctamente";
                llenarConfiguraciones()
                cancelarModificarConfiguracion();
                exitoModal(mensaje)
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        errorModal('Debes completar los campos requeridos');
    }
}


function cancelarModificarConfiguracion() {
    document.getElementById("txtNombreConfiguracion").value = "";
    document.getElementById("txtIdConfiguracion").value = "";
    document.getElementById("contenedorNombreConfiguracion").setAttribute("hidden", "hidden");
    document.getElementById("agregarConfiguracion").removeAttribute("hidden");

    if (listaVacia == true) {
        document.getElementById("lblListaVacia").innerText = `La lista de ${nombreConfiguracion} esta vacia.`;
        document.getElementById("lblListaVacia").style.color = 'red';
        document.getElementById("lblListaVacia").removeAttribute("hidden");
    }
}

function agregarConfiguracion() {
    document.getElementById("txtNombreConfiguracion").value = "";
    document.getElementById("txtIdConfiguracion").value = "";
    document.getElementById("contenedorNombreConfiguracion").removeAttribute("hidden");
    document.getElementById("agregarConfiguracion").setAttribute("hidden", "hidden");
    document.getElementById("lblListaVacia").innerText = "";
    document.getElementById("lblListaVacia").setAttribute("hidden", "hidden");
    document.getElementById("btnRegistrarModificarConfiguracion").textContent = "Agregar";

    $('#lblNombreConfiguracion').css('color', 'red');
    $('#txtNombreConfiguracion').css('border-color', 'red');
} 


precioZonaInput.addEventListener('blur', function () {
    const rawValue = this.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    const parsedValue = parseFloat(rawValue) || 0;

    // Formatear el número al finalizar la edición
    this.value = formatNumber(parsedValue);

});

function formatNumber(number) {
    return '$' + number.toLocaleString('es-AR');
}

async function listaRoles() {
    const url = `/Roles/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    $('#RolesUsuario option').remove();

    select = document.getElementById("RolesUsuario");

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}

async function listaEstados() {
    const url = `/EstadosUsuarios/Lista`;
    const response = await fetch(url);
    const data = await response.json();

    $('#EstadosUsuario option').remove();

    select = document.getElementById("EstadosUsuario");

    for (i = 0; i < data.length; i++) {
        option = document.createElement("option");
        option.value = data[i].Id;
        option.text = data[i].Nombre;
        select.appendChild(option);

    }
}