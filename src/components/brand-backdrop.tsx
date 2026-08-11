import { cn } from "@/lib/utils";

const LOGIN_PATTERN = {
  /**
   * 4× tile (2504×1252): luminance-faithful recolor of beans stamp.
   * Continuous ink→teal/wheat map keeps organic interstitial stains
   * (not posterized dots). CSS size keeps visual density; pixel density
   * covers retina. Legacy: beans, 1× teal, prior 3× teal.
   */
  src: "/brand/login-pattern-teal-hd.png",
  size: "560px",
  veil: 0.48,
} as const;

type BrandBackdropProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-bleed teal pattern behind auth/landing surfaces.
 * HD stamp tile + soft veil; stains stay organic (wheat midtones).
 * Kept: `/brand/bg-pattern-beans.png`, `login-pattern-teal.png`,
 * `login-pattern-teal-3x.png`.
 */
export function BrandBackdrop({ children, className }: BrandBackdropProps) {
  return (
    <div className={cn("relative isolate", className)}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 select-none"
        style={{
          backgroundImage: `url(${LOGIN_PATTERN.src})`,
          backgroundRepeat: "repeat",
          backgroundSize: LOGIN_PATTERN.size,
          backgroundPosition: "center center",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 select-none"
        style={{
          backgroundColor: `color-mix(in srgb, var(--background) ${Math.round(LOGIN_PATTERN.veil * 100)}%, transparent)`,
        }}
      />
      {children}
    </div>
  );
}
