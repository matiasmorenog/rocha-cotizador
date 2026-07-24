import { cn } from "@/lib/utils";

type BrandBackdropProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * `watermark` — one large faded mark behind content (auth/landing default).
   * `mosaic` — sparse low-opacity tile; use when more atmosphere needed.
   */
  variant?: "watermark" | "mosaic";
};

/**
 * Soft brand atmosphere behind auth/landing surfaces.
 * Logo PNG is solid beige (#D2BFA9-ish) — never use mix-blend-multiply
 * against the latte page bg or the mark vanishes.
 */
export function BrandBackdrop({
  children,
  className,
  variant = "watermark",
}: BrandBackdropProps) {
  const isMosaic = variant === "mosaic";

  return (
    <div className={cn("relative isolate", className)}>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 select-none",
          isMosaic ? "opacity-20" : "opacity-[0.22]",
        )}
        style={
          isMosaic
            ? {
                backgroundImage: "url(/brand/rocha-logo.png)",
                backgroundRepeat: "repeat",
                backgroundSize: "220px",
                backgroundPosition: "center top",
              }
            : {
                backgroundImage: "url(/brand/rocha-logo.png)",
                backgroundRepeat: "no-repeat",
                backgroundSize: "min(80vw, 520px)",
                backgroundPosition: "center 12%",
              }
        }
      />
      {/* Light veil only — keep watermark readable */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_65%_50%_at_50%_40%,transparent_40%,var(--background)_92%)] opacity-60"
      />
      {children}
    </div>
  );
}
