import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isAdminPanelRole,
  staffHasPermission,
  type StaffPermission,
} from "@/lib/staff-permissions";
import type { Session } from "next-auth";

/**
 * Effective staff permissions for API gates — JWT/session after staff preview.
 * Superuser without preview has `[]` (platform-only; use preview or requireSuperuserApi).
 */
export function getEffectiveStaffPermissions(
  session: Session,
): readonly StaffPermission[] {
  return session.user.permissions ?? [];
}

/** Staff session for admin API routes. Optional permission gate. */
export async function requireStaffApi(
  permission?: StaffPermission,
): Promise<Session | null> {
  const session = await auth();
  if (!session?.user || !isAdminPanelRole(session.user.role)) return null;
  if (
    permission &&
    !staffHasPermission(getEffectiveStaffPermissions(session), permission)
  ) {
    return null;
  }
  return session;
}

/** @deprecated Prefer requireStaffApi — kept for gradual migration. */
export async function requireAdminApi(): Promise<Session | null> {
  return requireStaffApi();
}

/** Hidden owner APIs: missing session or Rocha staff → treat as not found. */
export async function requireSuperuserApi(): Promise<Session | null> {
  const session = await requireStaffApi();
  if (!session?.user?.id) return null;
  if (session.user.staffPreview) return null;
  if (session.user.isSuperuser) return session;

  const row = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return row?.role === "SUPERUSER" ? session : null;
}
