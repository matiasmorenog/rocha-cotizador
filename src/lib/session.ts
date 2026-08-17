import { auth } from "@/lib/auth";
import {
  isStaffRole,
  staffHasPermission,
  type StaffPermission,
} from "@/lib/staff-permissions";
import { redirect } from "next/navigation";

export async function requireCustomerSession() {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "CUSTOMER" ||
    !session.user.customerId
  ) {
    redirect("/login");
  }
  return session;
}

/** Any staff role (ADMIN | QUOTES | STOCK). */
export async function requireStaffSession() {
  const session = await auth();
  if (!session?.user || !isStaffRole(session.user.role)) {
    redirect("/admin/login");
  }
  return session;
}

/** @deprecated Use requireStaffSession — ADMIN-only was too narrow. */
export async function requireAdminSession() {
  return requireStaffSession();
}

export async function requireStaffPermission(permission: StaffPermission) {
  const session = await requireStaffSession();
  if (!staffHasPermission(session.user.permissions, permission)) {
    redirect("/admin");
  }
  return session;
}

export async function getOptionalSession() {
  return auth();
}
