"use client";

import { useEffect } from "react";
import { ConnectionErrorPanel } from "@/components/connection-error-panel";
import { forceReloadApp } from "@/lib/force-reload-app";

export default function AppError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  const retry = unstable_retry ?? reset ?? (() => void forceReloadApp());

  return <ConnectionErrorPanel onRetry={retry} />;
}
