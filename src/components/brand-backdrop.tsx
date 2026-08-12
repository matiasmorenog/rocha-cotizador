import { cn } from "@/lib/utils";

const LOGIN_PATTERN = {
  /** Single teal coffee/bakery tile (1024×512). */
  src: "/brand/login-pattern-teal.png",
  size: "520px",
  veil: 0.52,
} as const;

type BrandBackdropProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-bleed teal pattern behind auth/landing surfaces.
 * Soft veil keeps form text readable over the busy stamp.
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
