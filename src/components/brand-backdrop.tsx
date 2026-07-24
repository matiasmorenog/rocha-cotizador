import { cn } from "@/lib/utils";
import {
  BRAND_PATTERNS,
  DEFAULT_BRAND_PATTERN,
  type BrandPatternKey,
} from "@/lib/brand-patterns";

type BrandBackdropProps = {
  children: React.ReactNode;
  className?: string;
  /** Coffee pattern background. Default: light cups (best readability). */
  pattern?: BrandPatternKey;
};

/**
 * Full-bleed coffee backdrop behind auth/landing surfaces.
 * Seamless tiles use repeat; kraft uses cover (portrait art, not tileable).
 * Soft latte veil keeps forms readable.
 */
export function BrandBackdrop({
  children,
  className,
  pattern = DEFAULT_BRAND_PATTERN,
}: BrandBackdropProps) {
  const config = BRAND_PATTERNS[pattern] ?? BRAND_PATTERNS[DEFAULT_BRAND_PATTERN];

  return (
    <div className={cn("relative isolate", className)}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 select-none"
        style={{
          backgroundImage: `url(${config.src})`,
          backgroundRepeat: config.repeat,
          backgroundSize: config.size,
          backgroundPosition: "center center",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 select-none"
        style={{
          backgroundColor: `color-mix(in srgb, var(--background) ${Math.round(config.veil * 100)}%, transparent)`,
        }}
      />
      {children}
    </div>
  );
}
