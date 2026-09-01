"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import { CustomerPromoFooter } from "@/components/customer/customer-promo-footer";
import { buildCustomerHomeActions } from "@/lib/customer-nav-items";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import type { CustomerModuleSession } from "@/types/auth";
import { cn } from "@/lib/utils";
import { useHomeHubEnterOnce } from "@/hooks/use-home-hub-enter-once";

export function CustomerHomeHub({
  userName,
  modules,
}: {
  userName?: string | null;
  modules: CustomerModuleSession[];
}) {
  const { animate } = useHomeHubEnterOnce();
  const actions = buildCustomerHomeActions(modules);
  const displayName = userName?.trim() || "Cliente";
  const threeCol = actions.length === 3;
  const containerMax = threeCol ? "max-w-3xl" : "max-w-xl";
  const hubEnterDelay = (ms: number): CSSProperties =>
    ({ "--hub-enter-delay": `${ms}ms` }) as CSSProperties;
  const enterClass = animate ? "customer-home-hub-enter" : "";
  const gateClass = animate
    ? enterClass
    : "pointer-events-none opacity-0";

  return (
    <BrandBackdrop
      data-customer-home-hub=""
      className="flex w-full min-h-[calc(100dvh-8rem)] flex-col items-center justify-start rounded-xl px-4 pb-6 pt-2 sm:pt-4"
    >
      <div className={cn("mx-auto flex w-full flex-1 flex-col", containerMax)}>
        <div
          className={cn(
            "grid w-full grid-cols-1 gap-3",
            threeCol ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          <div
            className={cn(
              "flex w-full justify-center",
              threeCol ? "sm:col-span-3" : "sm:col-span-2",
            )}
          >
            <div
              className={cn(
                gateClass,
                "flex w-full max-w-md flex-col items-center gap-5 rounded-2xl bg-white/95 px-6 py-12 text-center shadow-sm backdrop-blur-[2px] sm:gap-6 sm:py-14",
              )}
              style={animate ? hubEnterDelay(0) : undefined}
            >
              <BrandLogo size="xl" priority />
              <div className="space-y-0.5">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
                  Hola, {displayName}
                </h1>
                <p className="text-sm text-neutral-700">
                  Elegí qué querés hacer hoy.
                </p>
              </div>
            </div>
          </div>

          {actions.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={animate ? hubEnterDelay(90 + index * 55) : undefined}
                className={cn(
                  gateClass,
                  "flex w-full flex-col items-start gap-3 rounded-xl border border-[var(--brand-primary)]/20 bg-white/90 p-4 text-left shadow-sm backdrop-blur-[2px] transition-colors hover:border-[var(--brand-primary)]/32 hover:bg-[color-mix(in_srgb,var(--brand-primary)_5%,var(--brand-primary-soft))]",
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
        <div
          className={cn(gateClass, "mt-auto w-full pt-6 sm:pt-8")}
          style={animate ? hubEnterDelay(90 + actions.length * 55) : undefined}
        >
          <CustomerPromoFooter />
        </div>
      </div>
    </BrandBackdrop>
  );
}
