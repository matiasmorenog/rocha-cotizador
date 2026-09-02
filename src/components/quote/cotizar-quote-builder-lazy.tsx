"use client";

import dynamic from "next/dynamic";
import { SkeletonQuoteBuilderContent } from "@/components/ui/skeleton";

const QuoteBuilder = dynamic(
  () =>
    import("@/components/quote/quote-builder").then((m) => m.QuoteBuilder),
  {
    loading: () => <SkeletonQuoteBuilderContent />,
  },
);

export function CotizarQuoteBuilder({
  orderCutoffHourAr,
}: {
  orderCutoffHourAr: number;
}) {
  return <QuoteBuilder orderCutoffHourAr={orderCutoffHourAr} />;
}
