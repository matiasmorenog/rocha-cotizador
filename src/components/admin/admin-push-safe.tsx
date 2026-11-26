"use client";

import { AdminBottomStackHost } from "@/components/admin/admin-bottom-stack";
import { AdminClientSafe } from "@/components/admin/admin-client-safe";
import { AdminPushSwRegister } from "@/components/admin/admin-push-sw-register";

/**
 * Isolate push/toast client tree so a render/hydration error cannot
 * unmount the admin sidebar (siblings share the layout parent).
 * Bottom stack host is a sibling so draft chips can portal into the same column.
 */
export function AdminPushSafe() {
  return (
    <AdminClientSafe label="admin-push">
      <AdminBottomStackHost />
      <AdminPushSwRegister />
    </AdminClientSafe>
  );
}
