/** UI labels for QuoteStatus enum (DB stays English). */
export const QUOTE_STATUS_LABELS = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviada",
  CONFIRMED: "Confirmada",
} as const;

export type QuoteStatusKey = keyof typeof QUOTE_STATUS_LABELS;

export function quoteStatusLabel(status: string): string {
  return QUOTE_STATUS_LABELS[status as QuoteStatusKey] ?? status;
}
