"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

/** Ported from nexus-web-store AdminTableActions / AdminTableIconAction. */

export function AdminTableActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex gap-2", className)}>{children}</div>;
}

const iconLinkClass = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] shadow-sm transition-colors hover:bg-[var(--brand-primary-soft)] active:brightness-95 disabled:pointer-events-none disabled:opacity-50",
  FOCUS_BRAND_BORDER,
);

type AdminTableIconActionProps = {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Disabled look but still clickable (e.g. blocked-edit hint). */
  blocked?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  form?: string;
  variant?: "primary" | "secondary" | "outline" | "destructive";
};

export function AdminTableIconAction({
  label,
  icon: Icon,
  href,
  onClick,
  disabled = false,
  blocked = false,
  loading = false,
  type = "button",
  form,
  variant = "secondary",
}: AdminTableIconActionProps) {
  const icon = loading ? (
    <Loader2 className="size-4 animate-spin" aria-hidden />
  ) : (
    <Icon className="size-4" aria-hidden />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          iconLinkClass,
          variant === "secondary" && "admin-edit-hover",
          (disabled || loading) && "pointer-events-none opacity-50",
        )}
        aria-label={label}
        aria-disabled={disabled || loading}
      >
        {icon}
      </Link>
    );
  }

  return (
    <Button
      type={type}
      form={form}
      variant={variant}
      size="sm"
      className={cn(
        "size-8 shrink-0 p-0",
        variant === "secondary" && "admin-edit-hover",
        blocked && !loading && "cursor-not-allowed opacity-50",
      )}
      onClick={onClick}
      disabled={disabled || loading}
      aria-disabled={disabled || blocked || loading}
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  );
}
