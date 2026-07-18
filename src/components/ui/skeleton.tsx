import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

/** Shimmer block — adapted from nexus AdminSkeleton / StorefrontSkeleton. */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("rocha-skeleton rounded-md", className)} aria-hidden />;
}

export function SkeletonRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function SkeletonPageHeader({
  titleWidth = "w-40",
  descriptionWidth = "w-64",
}: {
  titleWidth?: string;
  descriptionWidth?: string;
}) {
  return (
    <div className="mb-4">
      <Skeleton className={cn("h-8", titleWidth)} />
      {descriptionWidth ? (
        <Skeleton className={cn("mt-2 h-4", descriptionWidth)} />
      ) : null}
    </div>
  );
}

function SkeletonTableRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="flex gap-3 border-b border-neutral-100 bg-neutral-50 px-3 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-neutral-100">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex gap-3 px-3 py-3">
            {Array.from({ length: cols }, (_, col) => (
              <Skeleton key={col} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonLoginPage({ title = "Cargando acceso" }: { title?: string }) {
  return (
    <SkeletonRegion
      label={title}
      className="mx-auto max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white/90 p-6 shadow-sm"
    >
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </SkeletonRegion>
  );
}

export function SkeletonQuotePage() {
  return (
    <SkeletonRegion label="Cargando cotizador" className="space-y-4">
      <SkeletonPageHeader titleWidth="w-52" descriptionWidth="w-48" />
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="flex items-end">
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>
      </div>
      <SkeletonTableRows rows={4} cols={5} />
    </SkeletonRegion>
  );
}

export function SkeletonListPage({
  label = "Cargando listado",
  titleWidth = "w-36",
  cols = 4,
}: {
  label?: string;
  titleWidth?: string;
  cols?: number;
}) {
  return (
    <SkeletonRegion label={label} className="space-y-4">
      <SkeletonPageHeader titleWidth={titleWidth} descriptionWidth="w-72" />
      <SkeletonTableRows rows={8} cols={cols} />
    </SkeletonRegion>
  );
}

export function SkeletonRemitoDetailPage() {
  return (
    <SkeletonRegion label="Cargando remito" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SkeletonPageHeader titleWidth="w-44" descriptionWidth="w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap justify-between gap-4 border-b border-neutral-200 pb-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <SkeletonTableRows rows={5} cols={5} />
        <div className="mt-4 flex justify-end">
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function SkeletonAccountPage() {
  return (
    <SkeletonRegion
      label="Cargando configuración"
      className="mx-auto max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <SkeletonPageHeader titleWidth="w-40" descriptionWidth="w-48" />
      <Skeleton className="h-3 w-36" />
      <div className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </SkeletonRegion>
  );
}

export function SkeletonAdminDashboardPage() {
  return (
    <SkeletonRegion label="Cargando dashboard" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="divide-y divide-neutral-100">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="ml-auto h-4 w-20" />
                <Skeleton className="ml-auto h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function SkeletonAdminListPage({
  label = "Cargando listado",
  titleWidth = "w-32",
}: {
  label?: string;
  titleWidth?: string;
}) {
  return (
    <SkeletonRegion label={label} className="space-y-6">
      <SkeletonPageHeader titleWidth={titleWidth} descriptionWidth="w-80" />
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
      <SkeletonTableRows rows={8} cols={5} />
    </SkeletonRegion>
  );
}

export function SkeletonAdminNewQuotePage() {
  return (
    <SkeletonRegion label="Cargando nueva cotización" className="space-y-6">
      <SkeletonPageHeader titleWidth="w-48" descriptionWidth="w-64" />
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-2 h-10 w-full rounded-md" />
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="flex items-end">
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>
      </div>
      <SkeletonTableRows rows={4} cols={5} />
    </SkeletonRegion>
  );
}
