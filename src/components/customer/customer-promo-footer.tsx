"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { developerPortfolioWhatsAppHref } from "@/lib/developer-portfolio-contact";
import {
  dismissCustomerPromoFooter,
  isCustomerPromoFooterDismissed,
  notifyCustomerPromoFooterChange,
  subscribeCustomerPromoFooter,
} from "@/lib/customer-promo-footer";
import { FOCUS_BRAND_BORDER, FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export function CustomerPromoFooter() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    // Mounted gate: defer sessionStorage read until after hydration (null → known).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only gate
    setDismissed(isCustomerPromoFooterDismissed());

    return subscribeCustomerPromoFooter(() => {
      setDismissed(isCustomerPromoFooterDismissed());
    });
  }, []);

  function handleDismiss() {
    dismissCustomerPromoFooter();
    notifyCustomerPromoFooterChange();
    setDismissed(true);
  }

  if (dismissed !== false) {
    return null;
  }

  return (
    <footer className="mt-10 print:hidden" aria-label="Desarrollo de software">
      <div className="relative mx-auto max-w-xl rounded-xl border border-[var(--brand-primary)]/25 bg-[var(--brand-primary-soft)]/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso de desarrollo"
          className={cn(
            "absolute right-2 top-2 rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-white/60 hover:text-neutral-900",
            FOCUS_BRAND_OUTLINE,
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex flex-col items-center gap-3 pt-1 text-center sm:gap-4">
          <p className="text-sm leading-relaxed text-neutral-700 sm:text-base">
            ¿Necesitás una app o página web para tu negocio?{" "}
            <span className="text-neutral-600">
              Desarrollo soluciones a medida para pymes y emprendimientos.
            </span>
          </p>
          <Link
            href={developerPortfolioWhatsAppHref()}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-[var(--brand-primary)] bg-white/70 px-4 text-sm font-medium text-[var(--brand-primary)] transition-colors hover:bg-white active:brightness-95",
              FOCUS_BRAND_BORDER,
            )}
          >
            Escribime
          </Link>
        </div>
      </div>
    </footer>
  );
}
