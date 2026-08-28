"use client";

import { Component, type ReactNode } from "react";

/**
 * Isolate a client island so a render/hydration error cannot unmount
 * siblings in the admin layout (e.g. sidebar / push / page body).
 */
class AdminClientErrorBoundary extends Component<
  {
    children: ReactNode;
    label: string;
    fallback: ReactNode;
    /** When this changes (e.g. pathname), recover from fallback without full reload. */
    resetKey?: string;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prevProps: { resetKey?: string }) {
    if (
      this.state.failed &&
      prevProps.resetKey !== undefined &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ failed: false });
    }
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
  resetKey,
}: {
  children: ReactNode;
  label: string;
  fallback?: ReactNode;
  resetKey?: string;
}) {
  return (
    <AdminClientErrorBoundary label={label} fallback={fallback} resetKey={resetKey}>
      {children}
    </AdminClientErrorBoundary>
  );
}
