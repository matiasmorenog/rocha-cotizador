/**
 * Monthly subscription / abono UI + due reminder.
 *
 * Demo / Neon development: set both flags to `0` so Configuración hides
 * Servicio and `/admin` never shows the unpaid toast.
 * Production client (`rocha-cotizador`): omit or `1` (default enabled).
 */

function envFlagOn(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function envFlagOff(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "no";
}

/**
 * Server + client (via NEXT_PUBLIC). Explicit `0` wins; explicit `1` enables;
 * unset defaults to enabled (production).
 */
export function isSubscriptionBillingEnabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_SUBSCRIPTION_BILLING_ENABLED;
  if (envFlagOff(pub)) return false;
  if (envFlagOn(pub)) return true;

  const srv = process.env.SUBSCRIPTION_BILLING_ENABLED;
  if (envFlagOff(srv)) return false;
  if (envFlagOn(srv)) return true;

  return true;
}
