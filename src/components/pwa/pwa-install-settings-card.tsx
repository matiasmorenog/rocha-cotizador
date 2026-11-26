"use client";

import { useEffect } from "react";
import { ensureInstallPromptCapture } from "@/lib/pwa-install-client";
import { PwaInstallActions } from "@/components/pwa/pwa-install-actions";

/**
 * Permanent install guide for customer `/cuenta/configuracion` and admin Cuenta tab.
 */
export function PwaInstallSettingsCard() {
  useEffect(() => {
    ensureInstallPromptCapture();
  }, []);

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
      <p className="font-semibold text-neutral-900">Instalar en el celular</p>
      <p className="mt-1 text-neutral-600">
        Abrí Rocha Cotizador desde el inicio, sin la barra del navegador.
      </p>
      <div className="mt-3">
        <PwaInstallActions />
      </div>
    </div>
  );
}
