import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        {description ? (
          <div className="text-xs text-neutral-600">{description}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
