"use client";

import { Component, type ReactNode } from "react";
import { AdminPushSwRegister } from "@/components/admin/admin-push-sw-register";

/**
 * Isolate push/toast client tree so a render/hydration error cannot
 * unmount the admin sidebar (siblings share the layout parent).
 */
class AdminPushErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[admin-push] suppressed layout crash", error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export function AdminPushSafe() {
  return (
    <AdminPushErrorBoundary>
      <AdminPushSwRegister />
    </AdminPushErrorBoundary>
  );
}
