import type { ReactNode } from "react";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

/** Shimmer bone — neutral grey via `.rocha-skeleton` (visible on white + cream). */
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

/** Soft auth/landing card — matches BrandBackdrop surfaces. */
const AUTH_CARD =
  "w-full space-y-6 rounded-xl border border-[var(--brand-latte)]/50 bg-[var(--brand-primary-soft)]/95 p-6 shadow-sm backdrop-blur-[2px]";

function SkeletonLogo({
  size = "xl",
}: {
  size?: "md" | "xl" | "2xl";
}) {
  const sizeClass =
    size === "2xl"
      ? "h-52 w-64 sm:h-64 sm:w-80"
      : size === "md"
        ? "h-20 w-48"
        : "h-44 w-56 sm:h-52 sm:w-64";
  return <Skeleton className={cn("rounded-2xl", sizeClass)} />;
}

function SkeletonPageHeader({
  titleWidth = "w-40",
  descriptionWidth,
}: {
  titleWidth?: string;
  descriptionWidth?: string | null;
}) {
  return (
    <div>
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

function SkeletonExcelSyncPanel() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="space-y-2 md:max-w-sm">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[18rem]">
          <Skeleton className="h-10 w-full rounded-md sm:w-40" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Skeleton className="h-10 w-full rounded-md sm:w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-md sm:w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Home `/` — logo hero + primary CTA + subtle admin link. */
export function SkeletonHomePage() {
  return (
    <SkeletonRegion label="Cargando">
      <BrandBackdrop className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center py-4">
        <div className={AUTH_CARD}>
          <div className="flex flex-col items-center gap-4 text-center">
            <SkeletonLogo size="2xl" />
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-4 w-52 max-w-full" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </BrandBackdrop>
    </SkeletonRegion>
  );
}

/** `/entrar` — chooser with logo + CTAs (admin link subtle). */
export function SkeletonChooserPage() {
  return (
    <SkeletonRegion label="Cargando acceso">
      <BrandBackdrop className="mx-auto flex min-h-[60vh] max-w-md items-center py-4">
        <div className={AUTH_CARD}>
          <div className="flex flex-col items-center gap-4 text-center">
            <SkeletonLogo size="xl" />
            <div className="flex w-full flex-col items-center gap-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </BrandBackdrop>
    </SkeletonRegion>
  );
}

/** Customer / admin login — BrandBackdrop card + rounded logo + form. */
export function SkeletonLoginPage({ title = "Cargando acceso" }: { title?: string }) {
  return (
    <SkeletonRegion label={title}>
      <BrandBackdrop className="mx-auto flex min-h-[60vh] max-w-md items-center py-4">
        <div className={AUTH_CARD}>
          <div className="flex flex-col items-center gap-4 text-center">
            <SkeletonLogo size="xl" />
            <div className="flex w-full flex-col items-center gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="flex justify-center">
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </BrandBackdrop>
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
      {/* Código · Producto · Cant. · Medida · Precio · Importe · actions */}
      <SkeletonTableRows rows={4} cols={7} />
    </SkeletonRegion>
  );
}

export function SkeletonListPage({
  label = "Cargando listado",
  titleWidth = "w-36",
  cols = 4,
  descriptionWidth = null,
}: {
  label?: string;
  titleWidth?: string;
  cols?: number;
  descriptionWidth?: string | null;
}) {
  return (
    <SkeletonRegion label={label} className="space-y-4">
      <SkeletonPageHeader titleWidth={titleWidth} descriptionWidth={descriptionWidth} />
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
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <div className="space-y-3">
            <SkeletonLogo size="md" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <SkeletonTableRows rows={5} cols={5} />
        <div className="mt-6 flex justify-end">
          <Skeleton className="h-7 w-36" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Customer `/cuenta/configuracion` — single password card. */
export function SkeletonAccountPage() {
  return (
    <SkeletonRegion
      label="Cargando configuración"
      className="mx-auto max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <SkeletonPageHeader titleWidth="w-40" descriptionWidth="w-48" />
      <Skeleton className="mb-3 h-3 w-36" />
      <div className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </SkeletonRegion>
  );
}

/**
 * Admin `/admin/configuracion` — two cards:
 * Notificaciones (WhatsApp, in-app, sistema), Mi cuenta (email, contraseña).
 */
export function SkeletonAdminConfigPage() {
  return (
    <SkeletonRegion
      label="Cargando configuración"
      className="mx-auto max-w-lg space-y-6"
    >
      <SkeletonPageHeader titleWidth="w-44" descriptionWidth="w-72" />

      {/* Notificaciones */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <Skeleton className="mb-3 h-3 w-32" />
        <div className="space-y-4">
          {/* WhatsApp */}
          <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <div className="mt-3 space-y-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-52" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-10 w-14 shrink-0 rounded-md" />
                  <Skeleton className="h-10 min-w-0 flex-1 rounded-md" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-10 w-24 rounded-md" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-64" />
          </div>
          {/* In-app */}
          <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-48" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-10 w-56 rounded-md" />
              <Skeleton className="h-10 w-56 rounded-md" />
            </div>
          </div>
          {/* Sistema */}
          <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-60" />
            <Skeleton className="h-3 w-64" />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-64 rounded-md" />
            </div>
            <Skeleton className="h-4 w-64" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-56 rounded-md" />
              <Skeleton className="h-10 w-64 rounded-md" />
            </div>
          </div>
        </div>
      </section>

      {/* Mi cuenta */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <Skeleton className="mb-1 h-3 w-24" />
        <Skeleton className="mb-4 h-4 w-56" />
        <div className="space-y-4">
          {/* Cambiar email */}
          <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <div className="mt-3 space-y-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          {/* Cambiar contraseña */}
          <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full" />
            <div className="mt-3 space-y-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </div>
      </section>
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
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-2 h-9 w-16" />
            <Skeleton className="mt-2 h-3 w-36" />
          </div>
        ))}
      </div>
      {/* Chart slot — sibling: nexus analytics skeleton goes here. */}
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

/** Clientes / productos — title + Excel sync + search/CTA toolbar + table. */
export function SkeletonAdminListPage({
  label = "Cargando listado",
  titleWidth = "w-32",
  descriptionWidth = "w-80",
}: {
  label?: string;
  titleWidth?: string;
  descriptionWidth?: string;
}) {
  return (
    <SkeletonRegion label={label} className="space-y-6">
      <SkeletonPageHeader titleWidth={titleWidth} descriptionWidth={descriptionWidth} />
      <SkeletonExcelSyncPanel />
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-10 min-w-0 flex-1 rounded-md" />
          <Skeleton className="h-10 w-full shrink-0 rounded-md sm:w-36" />
        </div>
        <SkeletonTableRows rows={8} cols={5} />
      </div>
    </SkeletonRegion>
  );
}

/** Cotizaciones list — title + CTA, date export panel, search, table. */
export function SkeletonAdminQuotesPage() {
  return (
    <SkeletonRegion label="Cargando cotizaciones" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Skeleton className="h-10 w-full rounded-md sm:w-32" />
            <Skeleton className="h-10 w-full rounded-md sm:w-36" />
          </div>
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
      <SkeletonTableRows rows={8} cols={5} />
    </SkeletonRegion>
  );
}

export function SkeletonAdminNewQuotePage() {
  return (
    <SkeletonRegion label="Cargando nueva cotización" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SkeletonPageHeader titleWidth="w-48" descriptionWidth="w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-2 h-10 w-full rounded-md" />
      </div>
      <Skeleton className="h-4 w-72" />
    </SkeletonRegion>
  );
}
