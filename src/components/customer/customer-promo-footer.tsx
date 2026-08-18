import Link from "next/link";
import { developerPortfolioMailtoHref } from "@/lib/developer-portfolio-contact";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export function CustomerPromoFooter() {
  return (
    <footer className="mt-10 print:hidden" aria-label="Desarrollo de software">
      <div className="mx-auto max-w-xl rounded-xl border border-[var(--brand-primary)]/25 bg-[var(--brand-primary-soft)]/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
          <p className="text-sm leading-relaxed text-neutral-700 sm:text-base">
            ¿Necesitás una app o página web para tu negocio?{" "}
            <span className="text-neutral-600">
              Desarrollo soluciones a medida para pymes y emprendimientos.
            </span>
          </p>
          <Link
            href={developerPortfolioMailtoHref()}
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
