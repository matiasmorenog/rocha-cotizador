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
 * PNG has solid beige fill — mix-blend-multiply + low opacity blends into latte page bg.
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
          "pointer-events-none absolute inset-0 -z-10 select-none mix-blend-multiply",
          isMosaic ? "opacity-[0.1]" : "opacity-[0.14]",
        )}
        style={
          isMosaic
            ? {
                backgroundImage: "url(/brand/rocha-logo.png)",
                backgroundRepeat: "repeat",
                backgroundSize: "180px",
                backgroundPosition: "center top",
              }
            : {
                backgroundImage: "url(/brand/rocha-logo.png)",
                backgroundRepeat: "no-repeat",
                backgroundSize: "min(72vw, 420px)",
                backgroundPosition: "center 18%",
              }
        }
      />
      {/* Soft veil so form cards stay readable over the mark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_50%_35%,transparent_0%,var(--background)_78%)]"
      />
      {children}
    </div>
  );
}
