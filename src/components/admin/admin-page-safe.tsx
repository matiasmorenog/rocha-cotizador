"use client";

import type { ReactNode } from "react";
import { AdminClientSafe } from "@/components/admin/admin-client-safe";
import { RoutePendingShell } from "@/components/route-pending-shell";
import { Button } from "@/components/ui/button";
import { forceReloadApp } from "@/lib/force-reload-app";

function AdminPageFallback() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-700">
      <p className="font-medium text-neutral-900">No se pudo cargar esta página.</p>
      <p className="mt-2">
        Revisá tu conexión a internet: a veces el fallo es de red, no de la app.
        Recargá con el botón de abajo. Si sigue fallando, volvé al{" "}
        <a className="text-[var(--brand-primary)] underline" href="/admin">
          dashboard
        </a>
        .
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={() => {
          void forceReloadApp();
        }}
      >
        Recargar
      </Button>
    </div>
  );
}

/** Isolate admin page body so a crash cannot unmount the sidebar. */
export function AdminPageSafe({ children }: { children: ReactNode }) {
  return (
    <AdminClientSafe label="admin-page" fallback={<AdminPageFallback />}>
      <RoutePendingShell variant="admin" coverGutters={false}>
        {children}
      </RoutePendingShell>
    </AdminClientSafe>
  );
}
