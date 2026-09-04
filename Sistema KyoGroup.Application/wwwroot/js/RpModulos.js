/**
 * Catálogo de módulos de navbar para presencia / heartbeat / Ir.
 * Las claves deben coincidir con ModulosPermitidos de UsuariosConexionesService.
 */
(function (global) {
    const CATALOG = [
        {
            key: "Proveedores",
            label: "Proveedores",
            url: "/Proveedores",
            prefixes: [
                "/proveedores",
                "/proveedorescuentacorriente",
                "/proveedoresinsumos",
                "/compras",
                "/ordenescompras"
            ]
        },
        {
            key: "Recetas",
            label: "Recetas",
            url: "/Recetas",
            prefixes: ["/recetas", "/subrecetas"]
        },
        {
            key: "Insumos",
            label: "Insumos",
            url: "/Insumos",
            prefixes: ["/insumos"]
        },
        {
            key: "Ventas",
            label: "Ventas",
            url: "/Ventas",
            prefixes: ["/ventas"]
        },
        {
            key: "Finanzas",
            label: "Finanzas",
            url: "/Finanzas",
            prefixes: ["/finanzas", "/tesoreria", "/cajas", "/gastos", "/cuentas", "/mediospago", "/cuentastipos", "/gastoscategorias"]
        },
        {
            key: "AnalisisDatos",
            label: "Análisis de datos",
            url: "/AnalisisDatos",
            prefixes: ["/analisisdatos"]
        },
        {
            key: "Usuarios",
            label: "Usuarios",
            url: "/Usuarios",
            prefixes: ["/usuarios"]
        }
    ];

    function normalizePath(pathname) {
        return (pathname || "/")
            .toLowerCase()
            .replace(/\/+$/, "") || "/";
    }

    function fromPath(pathname) {
        const path = normalizePath(pathname);
        if (path === "/" || path.indexOf("/login") === 0) return null;

        for (let i = 0; i < CATALOG.length; i++) {
            const item = CATALOG[i];
            for (let j = 0; j < item.prefixes.length; j++) {
                const p = item.prefixes[j];
                if (path === p || path.startsWith(p + "/")) return item.key;
            }
        }
        return null;
    }

    function current() {
        return fromPath(global.location && global.location.pathname);
    }

    function find(key) {
        if (!key) return null;
        const k = String(key);
        return CATALOG.find(x => x.key.toLowerCase() === k.toLowerCase()) || null;
    }

    function label(key) {
        return find(key)?.label || key || "";
    }

    function url(key) {
        return find(key)?.url || null;
    }

    global.RpModulos = {
        CATALOG,
        fromPath,
        current,
        find,
        label,
        url
    };
})(window);
