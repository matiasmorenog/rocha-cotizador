import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** Visual size of the mark */
  size?: "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
};

const SIZE = {
  sm: { width: 120, height: 48, className: "h-9 w-auto" },
  md: { width: 180, height: 72, className: "h-14 w-auto" },
  lg: { width: 280, height: 112, className: "h-24 w-auto sm:h-28" },
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
