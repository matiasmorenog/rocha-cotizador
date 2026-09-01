"use client";

import dynamic from "next/dynamic";
import { SkeletonQuoteBuilderContent } from "@/components/ui/skeleton";

export const CotizarQuoteBuilder = dynamic(
  () =>
    import("@/components/quote/quote-builder").then((m) => m.QuoteBuilder),
  {
    loading: () => <SkeletonQuoteBuilderContent />,
  },
);
