/** Spanish UI label for User.isSuperuser. Not a UserRole enum value. */
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

export function isPlatformOwnerEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return parsePlatformOwnerEmails().includes(email.trim().toLowerCase());
}
