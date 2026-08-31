import Link from "next/link";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import { buildCustomerHomeActions } from "@/lib/customer-nav-items";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import type { CustomerModuleSession } from "@/types/auth";
import { cn } from "@/lib/utils";

export function CustomerHomeHub({
  userName,
  customerCode,
  modules,
}: {
  userName?: string | null;
  customerCode?: string | null;
  modules: CustomerModuleSession[];
}) {
  const actions = buildCustomerHomeActions(modules);
  const displayName = userName?.trim() || "Cliente";
  const code = customerCode?.trim();
  const threeCol = actions.length === 3;
  const containerMax = threeCol ? "max-w-3xl" : "max-w-xl";

  return (
    <BrandBackdrop className="flex w-full min-h-[min(calc(100vh-10rem),40rem)] flex-col items-center justify-center rounded-xl px-4 py-10 sm:py-12">
      <div className={cn("mx-auto w-full space-y-6 text-center", containerMax)}>
        <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-white/95 px-5 py-4 text-center shadow-sm backdrop-blur-[2px]">
          <BrandLogo size="md" priority />
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
              Hola, {displayName}
            </h1>
            {code ? (
              <p className="text-sm font-medium text-neutral-800">Código {code}</p>
            ) : null}
            <p className="text-sm text-neutral-700">
              Elegí qué querés hacer hoy.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mx-auto grid w-full grid-cols-1 gap-3",
            threeCol ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {actions.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-full flex-col items-start gap-3 rounded-xl border border-[var(--brand-primary)]/20 bg-white/90 p-4 text-left shadow-sm backdrop-blur-[2px] transition-colors hover:border-[var(--brand-primary)]/35 hover:bg-white",
                  FOCUS_BRAND_OUTLINE,
                )}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="space-y-1">
                  <span className="block text-base font-semibold text-neutral-900">
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="block text-sm text-neutral-600">
                      {item.description}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </BrandBackdrop>
  );
}
