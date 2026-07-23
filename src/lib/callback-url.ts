/**
 * Safe relative callback paths for post-login redirects.
 * Rejects open redirects (`//evil.com`, `https://...`).
 */
export function safeCallbackUrl(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  return trimmed;
}
