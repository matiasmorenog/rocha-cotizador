import { db } from "@/lib/db";

export async function nextQuoteNumber(): Promise<string> {
  const seq = await db.$transaction(async (tx) => {
    const existing = await tx.quoteSequence.findUnique({ where: { id: 1 } });
    if (!existing) {
      await tx.quoteSequence.create({ data: { id: 1, value: 1 } });
      return 1;
    }
    const updated = await tx.quoteSequence.update({
      where: { id: 1 },
      data: { value: { increment: 1 } },
    });
    return updated.value;
  });

  return `R-${String(seq).padStart(6, "0")}`;
}

/** Public remito detail path — display number (`R-XXXXXX`), not DB cuid. */
export function remitoPath(quoteNumber: string): string {
  return `/remitos/${encodeURIComponent(quoteNumber)}`;
}

/** Normalize URL segment for case-insensitive number match (`r-000018` → `R-000018`). */
export function normalizeRemitoNumberParam(param: string): string {
  return decodeURIComponent(param).trim().toUpperCase();
}
