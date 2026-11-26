import type { ReactNode } from "react";
import type { AdminModuleChrome } from "@/lib/admin-module-chrome";
import { cn } from "@/lib/utils";

type Props = AdminModuleChrome & {
  actions?: ReactNode;
  /** Match stock headers (`text-xl`) when needed. */
  titleClassName?: string;
  className?: string;
};

/**
 * Sync module chrome — keep outside Suspense / pending content skeleton.
 * Title → short brand accent underline → description (Nexus-style, Rocha teal).
 */
export function AdminModulePageHeader({
  title,
  description,
  actions,
  titleClassName = "text-2xl font-semibold text-neutral-900",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="w-fit max-w-full">
          <h1 className={titleClassName}>{title}</h1>
          <div
            className="mx-auto mt-1.5 h-[3px] w-[calc(100%+0.75rem)] rounded-sm bg-[var(--brand-primary)]"
            aria-hidden
          />
        </div>
        {description ? (
          <p className="mt-2.5 text-sm text-neutral-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
