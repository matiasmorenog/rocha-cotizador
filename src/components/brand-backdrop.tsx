import { cn } from "@/lib/utils";

const BEANS_PATTERN = {
  src: "/brand/bg-pattern-beans.png",
  size: "560px",
  veil: 0.55,
} as const;

type BrandBackdropProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-bleed coffee backdrop behind auth/landing surfaces.
 * Beans seamless tile + soft latte veil keeps forms readable.
 */
export function BrandBackdrop({ children, className }: BrandBackdropProps) {
  return (
    <div className={cn("relative isolate", className)}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 select-none"
        style={{
          backgroundImage: `url(${BEANS_PATTERN.src})`,
          backgroundRepeat: "repeat",
          backgroundSize: BEANS_PATTERN.size,
          backgroundPosition: "center center",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 select-none"
        style={{
          backgroundColor: `color-mix(in srgb, var(--background) ${Math.round(BEANS_PATTERN.veil * 100)}%, transparent)`,
        }}
      />
      {children}
    </div>
  );
}
