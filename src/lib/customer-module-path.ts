export function isCustomerHomePath(path: string): boolean {
  return path === "/" || path === "";
}

/** Guest landing on `/` (login card, not customer hub). */
export function isGuestLandingPath(path: string): boolean {
  return isCustomerHomePath(path);
}

/** Login / chooser routes — never show admin dashboard skeleton while pending. */
export function isPublicAuthPath(path: string): boolean {
  return (
    path === "/entrar" ||
    path.startsWith("/login") ||
    path.startsWith("/admin/login")
  );
}

/**
 * Soft nav between auth surfaces — same card family, no heavy fetch.
 * Guest `/` ↔ /entrar|/login|/admin/login included.
 */
export function isAuthSessionSurfaceNav(
  from: string,
  to: string,
  isGuest: boolean,
): boolean {
  if (isPublicAuthPath(from) && isPublicAuthPath(to)) return true;
  if (!isGuest) return false;
  return (
    (isPublicAuthPath(from) && isGuestLandingPath(to)) ||
    (isGuestLandingPath(from) && isPublicAuthPath(to))
  );
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
