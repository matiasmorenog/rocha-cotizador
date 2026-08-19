import { cache } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isAdminPanelRole,
  staffHasPermission,
  staffHomeHref,
  type StaffPermission,
} from "@/lib/staff-permissions";
import { isSuperuserRole } from "@/lib/platform-owner";
import { notFound, redirect } from "next/navigation";

/** One auth() decode per RSC request (layout + page share). */
const getAuthSession = cache(auth);

export async function requireCustomerSession() {
  const session = await getAuthSession();
  if (session?.user && isAdminPanelRole(session.user.role)) {
    redirect(staffHomeHref(session.user.permissions, session.user.role));
  }
  if (
    !session?.user ||
    session.user.role !== "CUSTOMER" ||
    !session.user.customerId
  ) {
    redirect("/login");
  }
  return session;
}

/** Any admin-panel role (Rocha staff or SUPERUSER). */
export async function requireStaffSession() {
  const session = await getAuthSession();
  if (!session?.user || !isAdminPanelRole(session.user.role)) {
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
  return getAuthSession();
}

/** Platform owner only. Rocha staff get a 404 even if they guess the URL. */
export async function requireSuperuser() {
  const session = await requireStaffSession();
  if (isSuperuserRole(session.user.role)) return session;

  const row = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (row?.role === "SUPERUSER") return session;
  notFound();
}
