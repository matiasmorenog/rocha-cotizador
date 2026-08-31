"use client";

import { SolapasTabContent } from "@/components/ui/solapas-tabs";
import type { ReactNode } from "react";

export function StockTabPanel({
  tabKey,
  children,
}: {
  tabKey: string;
  children: ReactNode;
}) {
  return <SolapasTabContent tabKey={tabKey}>{children}</SolapasTabContent>;
}
