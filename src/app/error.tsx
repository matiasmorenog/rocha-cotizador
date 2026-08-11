"use client";

import { useEffect } from "react";
import { ConnectionErrorPanel } from "@/components/connection-error-panel";

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

  const retry = unstable_retry ?? reset ?? (() => window.location.reload());

  return <ConnectionErrorPanel onRetry={retry} />;
}
