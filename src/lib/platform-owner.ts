/** Spanish UI label for UserRole.SUPERUSER. */
export const SUPERUSER_LABEL = "Superusuario";

export function parsePlatformOwnerEmails(
  raw = process.env.PLATFORM_OWNER_EMAIL,
): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Primary platform owner email (singleton superuser). */
export function primaryPlatformOwnerEmail(): string | null {
  const emails = parsePlatformOwnerEmails();
  return emails[0] ?? null;
}

export function isPlatformOwnerEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return parsePlatformOwnerEmails().includes(email.trim().toLowerCase());
}

export function isSuperuserRole(
  role: string | undefined | null,
): role is "SUPERUSER" {
  return role === "SUPERUSER";
}
