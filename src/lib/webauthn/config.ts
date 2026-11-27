/**
 * WebAuthn RP config from AUTH_URL / optional WEBAUTHN_* overrides.
 *
 * Prod (`rocha-cotizador.vercel.app`) and demo (`rocha-cotizador-dev.vercel.app`)
 * are separate RPs — passkeys do not transfer between hosts.
 */

const DEFAULT_RP_NAME = "Rocha Cotizador";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** Origin for this deployment (scheme + host, no path). */
export function getWebAuthnOrigin(): string {
  const explicit = process.env.WEBAUTHN_ORIGIN?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const authUrl = process.env.AUTH_URL?.trim();
  if (authUrl) {
    try {
      return stripTrailingSlash(new URL(authUrl).origin);
    } catch {
      // fall through
    }
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, "")}`;
  }

  return "http://localhost:3000";
}

/**
 * RP ID = registrable domain for the origin.
 * Localhost stays `localhost`; Vercel hostnames are used as-is (no custom domain).
 */
export function getWebAuthnRpId(): string {
  const explicit = process.env.WEBAUTHN_RP_ID?.trim();
  if (explicit) return explicit;

  try {
    return new URL(getWebAuthnOrigin()).hostname;
  } catch {
    return "localhost";
  }
}

export function getWebAuthnRpName(): string {
  return process.env.WEBAUTHN_RP_NAME?.trim() || DEFAULT_RP_NAME;
}

export function getWebAuthnExpectedOrigins(): string[] {
  const origin = getWebAuthnOrigin();
  const extras = (process.env.WEBAUTHN_EXTRA_ORIGINS ?? "")
    .split(",")
    .map((s) => stripTrailingSlash(s.trim()))
    .filter(Boolean);
  return Array.from(new Set([origin, ...extras]));
}
