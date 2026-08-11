import { cn } from "@/lib/utils";

type BrandBackdropProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-bleed sage/wheat atmosphere behind auth/landing surfaces.
 * Soft brand washes keep forms readable without a photo tile.
 */
export function BrandBackdrop({ children, className }: BrandBackdropProps) {
  return (
    <div className={cn("relative isolate", className)}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 select-none"
        style={{
          backgroundImage: `
            radial-gradient(
              ellipse 70% 55% at 15% 10%,
              color-mix(in srgb, var(--brand-primary-soft) 90%, transparent) 0%,
              transparent 60%
            ),
            radial-gradient(
              ellipse 55% 45% at 90% 0%,
              color-mix(in srgb, var(--brand-latte) 35%, transparent) 0%,
              transparent 55%
            ),
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--background) 70%, white) 0%,
              var(--background) 100%
            )
          `,
        }}
      />
      {children}
    </div>
  );
}
