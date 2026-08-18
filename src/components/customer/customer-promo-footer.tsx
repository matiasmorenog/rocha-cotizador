import Link from "next/link";
import { developerPortfolioMailtoHref } from "@/lib/developer-portfolio-contact";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export function CustomerPromoFooter() {
  return (
    <footer
      className="mt-10 border-t border-[var(--brand-primary)]/15 pt-6 pb-2 print:hidden"
      aria-label="Desarrollo de software"
    >
      <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-neutral-500 sm:text-sm">
        ¿Necesitás una app o página web para tu negocio?{" "}
        <span className="text-neutral-600">
          Desarrollo soluciones a medida para pymes y emprendimientos.
        </span>{" "}
        <Link
          href={developerPortfolioMailtoHref()}
          className={cn(
            "font-medium text-[var(--brand-primary)] underline-offset-2 hover:underline",
            FOCUS_BRAND_OUTLINE,
          )}
        >
          Escribime
        </Link>
        .
      </p>
    </footer>
  );
}
