"use client";

import dynamic from "next/dynamic";
import { SkeletonHomePage } from "@/components/ui/skeleton";
import type { CustomerModuleSession } from "@/types/auth";

const CustomerHomeHub = dynamic(
  () =>
    import("@/components/customer/customer-home-hub").then(
      (m) => m.CustomerHomeHub,
    ),
  { loading: () => <SkeletonHomePage /> },
);

export function CustomerHomeHubLazy({
  userName,
  modules,
}: {
  userName?: string | null;
  modules: CustomerModuleSession[];
}) {
  return <CustomerHomeHub userName={userName} modules={modules} />;
}
