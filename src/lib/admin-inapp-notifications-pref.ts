/**
 * Account-level in-app admin toast preference.
 * Read: NextAuth session/JWT (useSession) — no DB.
 * Write: PATCH /api/admin/push/inapp-pref then session.update(...).
 */

/** Persist preference for the logged-in admin (one DB write). */
export async function patchAdminInAppNotificationsEnabled(
  enabled: boolean,
): Promise<boolean> {
  const res = await fetch("/api/admin/push/inapp-pref", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ enabled }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    enabled?: unknown;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "No se pudo guardar la preferencia",
    );
  }
  return data.enabled !== false;
}
