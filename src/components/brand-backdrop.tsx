import { cn } from "@/lib/utils";

type BrandBackdropProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-bleed teal/sage atmosphere behind auth/landing surfaces.
 * Soft brand washes keep forms readable without a photo tile.
 * Uses same teal family as `.brand-page-atmosphere` (no wheat/latte wash).
 */
export function BrandBackdrop({ children, className }: BrandBackdropProps) {
  return (
    <div className={cn("relative isolate", className)}>
      <div
        aria-hidden
        className="brand-page-atmosphere pointer-events-none fixed inset-0 -z-10 select-none"
      />
      {children}
    </div>
  );
}
