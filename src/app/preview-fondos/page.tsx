import Link from "next/link";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import {
  BRAND_PATTERN_KEYS,
  BRAND_PATTERNS,
  DEFAULT_BRAND_PATTERN,
  parseBrandPattern,
  type BrandPatternKey,
} from "@/lib/brand-patterns";

export default async function PreviewFondosPage({
  searchParams,
}: {
  searchParams: Promise<{ bg?: string }>;
}) {
  const { bg } = await searchParams;
  const pattern = parseBrandPattern(bg);

  return (
    <BrandBackdrop
      pattern={pattern}
      className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 py-4"
    >
      <div className="w-full space-y-5 rounded-xl border border-[var(--brand-latte)]/50 bg-[var(--brand-primary-soft)]/95 p-6 shadow-sm backdrop-blur-[2px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo size="xl" priority />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-neutral-900">
              Preview fondos
            </h1>
            <p className="text-sm text-neutral-600">
              Patrón activo:{" "}
              <span className="font-medium text-neutral-900">
                {BRAND_PATTERNS[pattern].label}
              </span>
              {pattern === DEFAULT_BRAND_PATTERN ? (
                <span className="text-neutral-500"> (default)</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {BRAND_PATTERN_KEYS.map((key) => (
            <PatternLink key={key} pattern={key} active={key === pattern} />
          ))}
        </div>

        <p className="text-center text-xs text-neutral-500">
          También en{" "}
          <Link href={`/?bg=${pattern}`} className="underline">
            home
          </Link>
          ,{" "}
          <Link href={`/entrar?bg=${pattern}`} className="underline">
            /entrar
          </Link>
          ,{" "}
          <Link href={`/login?bg=${pattern}`} className="underline">
            /login
          </Link>
          ,{" "}
          <Link href={`/admin/login?bg=${pattern}`} className="underline">
            /admin/login
          </Link>
        </p>
      </div>
    </BrandBackdrop>
  );
}

function PatternLink({
  pattern,
  active,
}: {
  pattern: BrandPatternKey;
  active: boolean;
}) {
  return (
    <Link
      href={`/preview-fondos?bg=${pattern}`}
      className={
        active
          ? "inline-flex h-11 items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
          : "inline-flex h-11 items-center justify-center rounded-md border border-[var(--brand-latte)] bg-white px-4 text-sm font-medium text-neutral-900 hover:bg-[var(--brand-primary-soft)]"
      }
    >
      {BRAND_PATTERNS[pattern].label}
      {pattern === DEFAULT_BRAND_PATTERN ? (
        <span className="ml-1 text-xs opacity-90">· default</span>
      ) : null}{" "}
      <span className="ml-1 text-xs opacity-70">(?bg={pattern})</span>
    </Link>
  );
}
