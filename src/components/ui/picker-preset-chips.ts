import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export const PRESET_CHIP_ACTIVE =
  "border-[var(--brand-primary)]/30 bg-[var(--brand-primary-soft)] font-medium text-[var(--brand-primary)]";

export const PRESET_CHIP_IDLE =
  "border-transparent bg-transparent text-[var(--brand-primary)] hover:bg-transparent";

/** Range presets use pills; single-date presets use rounded rectangles. */
export function presetChipClassName(
  active: boolean,
  shape: "pill" | "rect",
): string {
  return cn(
    "border px-2.5 py-1 text-xs font-medium transition-colors",
    shape === "pill" ? "rounded-full" : "rounded-md",
    active ? PRESET_CHIP_ACTIVE : PRESET_CHIP_IDLE,
    FOCUS_BRAND_OUTLINE,
  );
}
