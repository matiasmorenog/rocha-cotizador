import { QuotesAdminPanel } from "@/components/admin/quotes-admin-panel";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import { getAdminCotizacionesQuotes } from "@/lib/admin-cotizaciones-data";

type Props = {
  fromParam?: string;
  toParam?: string;
};

/** Async segment for Suspense — same single DB read as the former page body. */
export async function CotizacionesQuotesLoader({ fromParam, toParam }: Props) {
  const { from, to, fromLocal, toLocal } = resolveQuotesExportRange(
    fromParam,
    toParam,
  );
  const rows = await getAdminCotizacionesQuotes(from, to, toParam);

  return (
    <QuotesAdminPanel
      key={`${fromLocal}_${toLocal}`}
      initialQuotes={rows}
      defaultFromLocal={fromLocal}
      defaultToLocal={toLocal}
    />
  );
}
