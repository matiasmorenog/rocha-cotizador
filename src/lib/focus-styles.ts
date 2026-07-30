/**
 * Shared focus styles — brand edge only, no ring/ring-offset halo.
 *
 * Bordered controls: thicker brand border.
 * Unbordered (nav, icon, text links): flush outline (offset 0).
 * Filled primary: white inset outline (brand border invisible on fill).
 */
export const FOCUS_BRAND_BORDER =
  "focus:outline-none focus-visible:outline-none focus-visible:border-2 focus-visible:border-[var(--brand-primary)]";

export const FOCUS_BRAND_OUTLINE =
  "focus:outline-none focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] focus-visible:outline-offset-0";

/** Filled brand CTAs — white inner outline contrasts against primary fill. */
export const FOCUS_BRAND_PRIMARY =
  "focus:outline-none focus-visible:outline-2 focus-visible:outline-white/95 focus-visible:outline-offset-[-3px]";
