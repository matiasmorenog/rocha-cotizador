import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  /** Accessible label; omit when adjacent text already conveys loading. */
  label?: string;
};

/** Inline loading indicator — brand primary. */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <>
      <Loader2
        className={cn(
          "size-4 shrink-0 animate-spin text-[var(--brand-primary)]",
          className,
        )}
        aria-hidden
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
