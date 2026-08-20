"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrintMode = "normal" | "thermal";

const THERMAL_PAGE_STYLE_ID = "remito-thermal-page-size";

function printWithMode(mode: PrintMode) {
  const root = document.documentElement;

  if (mode === "thermal") {
    root.dataset.printMode = "thermal";
    if (!document.getElementById(THERMAL_PAGE_STYLE_ID)) {
      const styleEl = document.createElement("style");
      styleEl.id = THERMAL_PAGE_STYLE_ID;
      styleEl.textContent =
        "@media print { @page { size: 80mm auto; margin: 2mm; } }";
      document.head.appendChild(styleEl);
    }
  } else {
    delete root.dataset.printMode;
  }

  const cleanup = () => {
    delete root.dataset.printMode;
    document.getElementById(THERMAL_PAGE_STYLE_ID)?.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.print();
}

type PrintButtonProps = {
  mode?: PrintMode;
};

export function PrintButton({ mode = "normal" }: PrintButtonProps) {
  const isThermal = mode === "thermal";
  const label = isThermal ? "Imprimir térmica" : "Imprimir PDF";

  return (
    <Button
      type="button"
      variant={isThermal ? "primary" : "outline"}
      className={cn(
        "print:hidden",
        isThermal ? "size-10 shrink-0 p-0" : "gap-1.5",
      )}
      onClick={() => printWithMode(mode)}
      aria-label={label}
      title={label}
    >
      <Printer className="size-4" aria-hidden />
      {isThermal ? null : <span>PDF</span>}
    </Button>
  );
}

/** Thermal (primary) + full-width remito print actions. */
export function RemitoPrintButtons() {
  return (
    <>
      <PrintButton mode="thermal" />
      <PrintButton mode="normal" />
    </>
  );
}
