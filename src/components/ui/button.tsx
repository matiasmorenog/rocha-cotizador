import { ButtonHTMLAttributes, forwardRef } from "react";
import {
  FOCUS_BRAND_BORDER,
  FOCUS_BRAND_PRIMARY,
} from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "destructive";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
          "rounded-md border border-transparent",
          variant === "primary" ? FOCUS_BRAND_PRIMARY : FOCUS_BRAND_BORDER,
          {
            "bg-[var(--brand-primary)] text-white hover:brightness-95 active:brightness-90":
              variant === "primary",
            "border-[var(--brand-primary)] bg-transparent text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]":
              variant === "secondary",
            "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50":
              variant === "outline",
            "btn-destructive border-red-200 bg-white text-red-600 hover:bg-red-50":
              variant === "destructive",
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
