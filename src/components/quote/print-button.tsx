"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type PrintMode = "normal" | "thermal";

const PRINT_PAGE_STYLE_ID = "remito-print-page-size";

const PAGE_CSS: Record<PrintMode, string> = {
  thermal: "@media print { @page { size: 80mm auto; margin: 2mm; } }",
  normal: "@media print { @page { size: A4 portrait; margin: 7mm; } }",
};

function applyPrintPageStyle(mode: PrintMode) {
  let styleEl = document.getElementById(PRINT_PAGE_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = PRINT_PAGE_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = PAGE_CSS[mode];
}

function printWithMode(mode: PrintMode, documentTitle?: string) {
  const root = document.documentElement;
  const previousTitle = document.title;

  if (mode === "thermal") {
    root.dataset.printMode = "thermal";
  } else {
    delete root.dataset.printMode;
  }
  applyPrintPageStyle(mode);
  if (documentTitle) {
    document.title = documentTitle;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.title = previousTitle;
    delete root.dataset.printMode;
    document.getElementById(PRINT_PAGE_STYLE_ID)?.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.print();
}

type PrintButtonProps = {
  mode?: PrintMode;
  documentTitle?: string;
};

export function PrintButton({
  mode = "normal",
  documentTitle,
}: PrintButtonProps) {
  const isThermal = mode === "thermal";
  const label = isThermal ? "Imprimir térmica" : "Imprimir PDF";

  return (
    <Button
      type="button"
      variant={isThermal ? "primary" : "outline"}
      className="print:hidden gap-1.5"
      onClick={() => printWithMode(mode, documentTitle)}
      aria-label={label}
      title={label}
    >
      <Printer className="size-4" aria-hidden />
      <span>{isThermal ? "Térmica" : "PDF"}</span>
    </Button>
  );
}

/** Thermal (primary) + full-width remito print actions. */
export function RemitoPrintButtons({
  documentTitle,
}: {
  documentTitle?: string;
}) {
  return (
    <>
      <PrintButton mode="thermal" documentTitle={documentTitle} />
      <PrintButton mode="normal" documentTitle={documentTitle} />
    </>
  );
}
