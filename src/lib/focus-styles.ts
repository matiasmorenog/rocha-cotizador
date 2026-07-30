/**
 * Shared focus styles — brand edge only, no ring/ring-offset halo
 * (except filled primary CTAs, which keep the classic ring halo).
 *
 * Bordered controls: thicker brand border.
 * Unbordered (nav, icon, text links): flush outline (offset 0).
 * Filled primary: brand ring + ring-offset (visible on white page bg).
 */
export const FOCUS_BRAND_BORDER =
  "focus:outline-none focus-visible:outline-none focus-visible:border-2 focus-visible:border-[var(--brand-primary)]";

export const FOCUS_BRAND_OUTLINE =
  "focus:outline-none focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] focus-visible:outline-offset-0";

/** Filled brand CTAs — ring + offset halo; white inset fails on white page bg. */
export const FOCUS_BRAND_PRIMARY =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1";
