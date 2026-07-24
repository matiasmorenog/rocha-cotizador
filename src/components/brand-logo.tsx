import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** Visual size of the mark */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
};

const SIZE = {
  sm: { width: 140, height: 56, className: "h-11 w-auto" },
  md: { width: 220, height: 88, className: "h-20 w-auto" },
  lg: { width: 320, height: 128, className: "h-28 w-auto sm:h-32" },
  xl: { width: 400, height: 160, className: "h-36 w-auto sm:h-44" },
} as const;

/** Official Rocha tienda de café mark — beige + coffee brown. */
export function BrandLogo({
  size = "sm",
  className,
  priority = false,
}: BrandLogoProps) {
  const s = SIZE[size];
  return (
    <Image
      src="/brand/rocha-logo.png"
      alt="ROCHA tienda de café"
      width={s.width}
      height={s.height}
      priority={priority}
      className={cn(s.className, "object-contain", className)}
    />
  );
}
