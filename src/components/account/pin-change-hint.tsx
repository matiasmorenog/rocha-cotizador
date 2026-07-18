"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

const STORAGE_KEY = "rocha-pin-hint-dismissed";
const EVENT = "rocha-pin-hint";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  return () => window.removeEventListener(EVENT, onStoreChange);
}

function getDismissed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  // Hide on SSR to avoid hydration mismatch; client decides.
  return true;
}

export function PinChangeHint({ show }: { show: boolean }) {
  const dismissed = useSyncExternalStore(subscribe, getDismissed, getServerSnapshot);

  if (!show || dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 print:hidden"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm text-amber-950">
        <p>
          Estás usando el PIN inicial. Te recomendamos cambiarlo por una contraseña en{" "}
          <Link href="/cuenta/configuracion" className="font-semibold underline">
            Configuración
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1 text-amber-900 hover:bg-amber-100"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
