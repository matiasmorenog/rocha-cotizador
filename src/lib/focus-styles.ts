/**
 * Shared focus styles — brand border only, no ring/ring-offset halo.
 *
 * Bordered controls: flip border to brand.
 * Unbordered (nav, icon, text links): flush outline (offset 0).
 */
export const FOCUS_BRAND_BORDER =
  "focus:outline-none focus-visible:outline-none focus-visible:border-[var(--brand-primary)]";

export const FOCUS_BRAND_OUTLINE =
  "focus:outline-none focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] focus-visible:outline-offset-0";
