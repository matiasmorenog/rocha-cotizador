export function isCustomerHomePath(path: string): boolean {
  return path === "/" || path === "";
}

export function isCustomerModulePath(path: string): boolean {
  return (
    path.startsWith("/cotizar") ||
    path.startsWith("/remitos") ||
    path.startsWith("/stock") ||
    path.startsWith("/cuenta")
  );
}

/** Desktop sidebar + two-column shell (not when destination is home). */
export function shouldShowCustomerModuleShell(
  pathname: string,
  dest: string,
): boolean {
  if (isCustomerHomePath(dest)) return false;
  return isCustomerModulePath(pathname) || isCustomerModulePath(dest);
}
