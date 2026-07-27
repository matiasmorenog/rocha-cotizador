"use client";

import { AdminClientSafe } from "@/components/admin/admin-client-safe";
import { AdminPushSwRegister } from "@/components/admin/admin-push-sw-register";

/**
 * Isolate push/toast client tree so a render/hydration error cannot
 * unmount the admin sidebar (siblings share the layout parent).
 */
export function AdminPushSafe() {
  return (
    <AdminClientSafe label="admin-push">
      <AdminPushSwRegister />
    </AdminClientSafe>
  );
}
