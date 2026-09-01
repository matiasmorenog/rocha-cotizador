/** Defer non-critical client work until idle (fallback timeout for Safari). */
export function scheduleIdleWork(
  task: () => void,
  options?: { timeoutMs?: number; fallbackMs?: number },
): () => void {
  if (typeof window === "undefined") return () => {};

  const timeoutMs = options?.timeoutMs ?? 4_000;
  const fallbackMs = options?.fallbackMs ?? 2_000;
  let cancelled = false;

  const run = () => {
    if (!cancelled) task();
  };

  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: timeoutMs });
    return () => {
      cancelled = true;
      cancelIdleCallback(id);
    };
  }

  const id = window.setTimeout(run, fallbackMs);
  return () => {
    cancelled = true;
    clearTimeout(id);
  };
}
