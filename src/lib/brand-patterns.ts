export const BRAND_PATTERN_KEYS = ["cups", "beans", "kraft"] as const;

export type BrandPatternKey = (typeof BRAND_PATTERN_KEYS)[number];

export const DEFAULT_BRAND_PATTERN: BrandPatternKey = "cups";

export const BRAND_PATTERNS: Record<
  BrandPatternKey,
  {
    label: string;
    src: string;
    /** CSS background-size */
    size: string;
    /** CSS background-repeat */
    repeat: "repeat" | "no-repeat";
    /** White/latte veil opacity (0–1) over the pattern */
    veil: number;
  }
> = {
  cups: {
    label: "Tazas / medialunas",
    src: "/brand/bg-pattern-cups.png",
    size: "420px",
    repeat: "repeat",
    veil: 0.48,
  },
  beans: {
    label: "Granos / hojas",
    src: "/brand/bg-pattern-beans.png",
    size: "560px",
    repeat: "repeat",
    veil: 0.55,
  },
  // Portrait illustration (575×1024), not seamless — cover avoids mosaic seams.
  kraft: {
    label: "Kraft / equipo",
    src: "/brand/bg-pattern-kraft.png",
    size: "cover",
    repeat: "no-repeat",
    veil: 0.58,
  },
};

export function parseBrandPattern(
  value: string | string[] | undefined,
): BrandPatternKey {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && (BRAND_PATTERN_KEYS as readonly string[]).includes(raw)) {
    return raw as BrandPatternKey;
  }
  return DEFAULT_BRAND_PATTERN;
}

export function withBgParam(href: string, pattern: BrandPatternKey): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("bg", pattern);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
