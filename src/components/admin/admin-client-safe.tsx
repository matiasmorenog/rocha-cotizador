"use client";

import { Component, type ReactNode } from "react";

/**
 * Isolate a client island so a render/hydration error cannot unmount
 * siblings in the admin layout (e.g. sidebar / push / page body).
 */
class AdminClientErrorBoundary extends Component<
  { children: ReactNode; label: string; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}] suppressed layout crash`, error);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function AdminClientSafe({
  children,
  label,
  fallback = null,
}: {
  children: ReactNode;
  label: string;
  fallback?: ReactNode;
}) {
  return (
    <AdminClientErrorBoundary label={label} fallback={fallback}>
      {children}
    </AdminClientErrorBoundary>
  );
}
