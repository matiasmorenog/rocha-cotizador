import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** Visual size of the mark */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  /** Above-the-fold / LCP: preload + eager decode */
  priority?: boolean;
  /** Prefer `priority` for LCP; use `eager` when priority preload is unwanted */
  loading?: "eager" | "lazy";
};

const SIZE = {
  sm: { width: 128, height: 128, className: "h-14 w-14 sm:h-16 sm:w-16" },
  md: { width: 192, height: 192, className: "h-20 w-20 sm:h-24 sm:w-24" },
  lg: { width: 256, height: 256, className: "h-32 w-32 sm:h-40 sm:w-40" },
  xl: { width: 320, height: 320, className: "h-44 w-44 sm:h-52 sm:w-52" },
  "2xl": { width: 384, height: 384, className: "h-52 w-52 sm:h-64 sm:w-64" },
} as const;

/** Official Rocha tienda de pan mark — solid teal square + forest green. */
export function BrandLogo({
  size = "sm",
  className,
  priority = false,
  loading,
}: BrandLogoProps) {
  const s = SIZE[size];
  return (
    <span className="inline-block overflow-hidden rounded-2xl">
      <Image
        src="/brand/rocha-mark-v3.png"
        alt="ROCHA tienda de pan"
        width={s.width}
        height={s.height}
        priority={priority}
        loading={priority ? undefined : loading}
        // Flat brand mark — skip optimizer cache/resizes that can reintroduce seams.
        unoptimized
        className={cn(s.className, "object-contain", className)}
      />
    </span>
  );
}
