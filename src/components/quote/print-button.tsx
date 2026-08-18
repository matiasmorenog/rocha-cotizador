"use client";

import { Button } from "@/components/ui/button";

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

  return (
    <Button
      type="button"
      variant={isThermal ? "primary" : "outline"}
      className="print:hidden"
      onClick={() => printWithMode(mode)}
    >
      {isThermal ? "Imprimir térmica" : "Imprimir remito"}
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
