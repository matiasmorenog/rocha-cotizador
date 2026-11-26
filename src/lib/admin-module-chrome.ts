/**
 * Static admin module title/description for soft-nav pending shell and
 * segment `loading.tsx` — real text, not skeleton bones.
 */
export type AdminModuleChrome = {
  title: string;
  description?: string;
};

export function adminModuleChromeForPath(path: string): AdminModuleChrome | null {
  if (path === "/admin" || path === "/admin/") {
    return {
      title: "Dashboard",
      description: "Resumen de cotizaciones y actividad.",
    };
  }
  if (path.startsWith("/admin/clientes")) {
    return {
      title: "Clientes",
      description:
        "Asigná una lista de precios fijos. El cliente solo ve el precio final.",
    };
  }
  if (path.startsWith("/admin/productos")) {
    return {
      title: "Productos",
      description:
        "Precio base = lista Precio base (también editable en Listas). Al crear solo pedimos base; precios por lista de dto se editan en la tabla o con “Rellenar desde…”.",
    };
  }
  if (path.startsWith("/admin/listas-precios")) {
    return {
      title: "Listas de precios",
      description:
        "Precios fijos por producto. La lista Precio base refleja Product.basePrice y no se puede eliminar. Otras listas se pueden borrar; clientes asignados vuelven a Precio base.",
    };
  }
  if (path.startsWith("/admin/cotizaciones/nueva")) {
    return {
      title: "Nueva cotización",
      description: "Armá una cotización en nombre de un cliente.",
    };
  }
  if (path.startsWith("/admin/cotizaciones")) {
    return { title: "Cotizaciones" };
  }
  if (path.startsWith("/admin/configuracion")) {
    return {
      title: "Configuración",
      description: "Ajustes del cotizador y de tu cuenta.",
    };
  }
  if (path.startsWith("/admin/usuarios")) {
    return {
      title: "Usuarios",
      description: "Administradores internos con acceso completo al panel.",
    };
  }
  if (path.startsWith("/admin/plataforma")) {
    return {
      title: "Pagos de plataforma",
      description: "Historial del abono mensual.",
    };
  }
  if (path.startsWith("/admin/stock")) {
    return {
      title: "Stock",
      description: "Resumen e historial de conteos por sucursal.",
    };
  }
  if (path.startsWith("/admin/desperdicios")) {
    return {
      title: "Desperdicios",
      description: "Conteos de desperdicio por sucursal.",
    };
  }
  if (path.startsWith("/admin/consumibles")) {
    return {
      title: "Consumibles",
      description: "Conteos de consumibles por sucursal.",
    };
  }
  if (path.startsWith("/admin/mermas")) {
    return {
      title: "Activos",
      description: "Conteos de activos locales por sucursal.",
    };
  }
  return null;
}
