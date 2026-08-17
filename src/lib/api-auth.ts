import { auth } from "@/lib/auth";
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
