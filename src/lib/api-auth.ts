import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isStaffRole,
  staffHasPermission,
  type StaffPermission,
} from "@/lib/staff-permissions";
import type { Session } from "next-auth";

/** Staff session for admin API routes. Optional permission gate. */
export async function requireStaffApi(
  permission?: StaffPermission,
): Promise<Session | null> {
  const session = await auth();
  if (!session?.user || !isStaffRole(session.user.role)) return null;
  if (permission && !staffHasPermission(session.user.permissions, permission)) {
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
  if (session.user.isSuperuser) return session;

  const row = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperuser: true },
  });
  return row?.isSuperuser ? session : null;
}
