import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Switch = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      className={cn(
        "peer size-full cursor-pointer appearance-none rounded-full border border-neutral-300 bg-neutral-200 shadow-inner transition-colors",
        "checked:border-[var(--brand-primary)] checked:bg-[var(--brand-primary)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1",
        "enabled:hover:border-neutral-400",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
    <span
      className="pointer-events-none absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out peer-checked:translate-x-4 peer-disabled:opacity-50"
      aria-hidden
    />
  </span>
));

Switch.displayName = "Switch";
