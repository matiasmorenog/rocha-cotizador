import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** Visual size of the mark */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  priority?: boolean;
};

const SIZE = {
  sm: { width: 180, height: 72, className: "h-14 w-auto sm:h-16" },
  md: { width: 260, height: 104, className: "h-20 w-auto sm:h-24" },
  lg: { width: 360, height: 144, className: "h-32 w-auto sm:h-40" },
  xl: { width: 440, height: 176, className: "h-44 w-auto sm:h-52" },
  "2xl": { width: 560, height: 224, className: "h-52 w-auto sm:h-64" },
} as const;

/** Official Rocha tienda de pan mark — sage circle + forest green. */
export function BrandLogo({
  size = "sm",
  className,
  priority = false,
}: BrandLogoProps) {
  const s = SIZE[size];
  return (
    <span className="inline-block overflow-hidden rounded-2xl">
      <Image
        src="/brand/rocha-logo.png"
        alt="ROCHA tienda de pan"
        width={s.width}
        height={s.height}
        priority={priority}
        className={cn(s.className, "object-contain", className)}
      />
    </span>
  );
}
