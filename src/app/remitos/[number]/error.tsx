"use client";

import { useEffect } from "react";
import { ConnectionErrorPanel } from "@/components/connection-error-panel";

export default function RemitoDetailError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("[remitos/[id]]", error);
  }, [error]);

  // Next 16: unstable_retry re-fetches Server Components (needed after DB blips).
  // reset only clears client error state without re-fetch.
  const retry = unstable_retry ?? reset ?? (() => window.location.reload());

  return (
    <ConnectionErrorPanel
      onRetry={retry}
      backHref="/remitos"
      backLabel="Volver a remitos"
    />
  );
}
