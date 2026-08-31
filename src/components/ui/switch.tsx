import { InputHTMLAttributes, forwardRef } from "react";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export const Switch = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <span className="relative inline-flex h-6 w-11 shrink-0">
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      className={cn(
        "peer absolute inset-0 cursor-pointer appearance-none rounded-full border border-neutral-300 bg-neutral-200 shadow-inner transition-colors",
        "checked:border-[var(--brand-primary)] checked:bg-[var(--brand-primary)]",
        FOCUS_BRAND_PRIMARY,
        "enabled:hover:border-neutral-400",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
    <span
      className="pointer-events-none absolute left-0.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out peer-checked:translate-x-5 peer-disabled:opacity-50"
      aria-hidden
    />
  </span>
));

Switch.displayName = "Switch";
