/** Static customer module titles for pending shell / loading (real text). */
export type CustomerModuleChrome = {
  title: string;
  description?: string;
};

export function customerModuleChromeForPath(
  path: string,
): CustomerModuleChrome | null {
  if (path.startsWith("/cotizar")) {
    return {
      title: "Nueva cotización",
      description: "Armá el pedido y enviá el remito.",
    };
  }
  if (path === "/remitos" || path.startsWith("/remitos?")) {
    return { title: "Mis remitos" };
  }
  if (path.startsWith("/stock")) {
    return { title: "Stock" };
  }
  if (path.startsWith("/cuenta")) {
    return {
      title: "Configuración",
      description: "Datos de tu cuenta y acceso.",
    };
  }
  return null;
}
