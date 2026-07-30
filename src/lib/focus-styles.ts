/**
 * Shared focus styles — brand edge only, no ring/ring-offset halo
 * (except filled primary CTAs, which keep the classic ring halo).
 *
 * Bordered controls: 1.5px brand border (midpoint between idle 1px and prior border-2).
 * Unbordered (nav, icon, text links): flush outline (offset 0).
 * Filled primary: brand ring + ring-offset (visible on white page bg).
 *
 * Raw `<button>` / `<a>` / `<Link>` painted like Button MUST apply the matching
 * helper — otherwise globals.css `:focus-visible { outline: 2px }` paints an
 * outer flush ring beside the grey border (or a flat outline on filled primary).
 */

/** Open/active look matching FOCUS_BRAND_BORDER without needing :focus-visible. */
export const BRAND_BORDER_ACTIVE =
  "border-[1.5px] border-[var(--brand-primary)]";

export const FOCUS_BRAND_BORDER =
  "focus:outline-none focus-visible:outline-none focus-visible:border-[1.5px] focus-visible:border-[var(--brand-primary)]";

export const FOCUS_BRAND_OUTLINE =
  "focus:outline-none focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] focus-visible:outline-offset-0";

/** Filled brand CTAs — ring + offset halo; white inset fails on white page bg. */
export const FOCUS_BRAND_PRIMARY =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1";
