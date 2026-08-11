import { cn } from "@/lib/utils";

const LOGIN_PATTERN = {
  /** 3× tile (1878×939) for crisp retina; CSS size keeps visual density. */
  src: "/brand/login-pattern-teal-3x.png",
  size: "560px",
  veil: 0.55,
} as const;

type BrandBackdropProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-bleed teal pattern behind auth/landing surfaces.
 * Seamless 3× tile + soft veil keeps forms readable on retina.
 * Legacy assets kept: `/brand/bg-pattern-beans.png`, `/brand/login-pattern-teal.png`.
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
