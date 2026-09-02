import { QuotesAdminPanel } from "@/components/admin/quotes-admin-panel";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import { getAdminCotizacionesQuotes } from "@/lib/admin-cotizaciones-data";
import { getOrderCutoffHourAr } from "@/lib/business-settings";

type Props = {
  fromParam?: string;
  toParam?: string;
};

/** Async segment for Suspense — same single DB read as the former page body. */
export async function CotizacionesQuotesLoader({ fromParam, toParam }: Props) {
  const [{ from, to, fromLocal, toLocal }, orderCutoffHourAr] = await Promise.all([
    Promise.resolve(resolveQuotesExportRange(fromParam, toParam)),
    getOrderCutoffHourAr(),
  ]);
  const rows = await getAdminCotizacionesQuotes(from, to, toParam);

  return (
    <QuotesAdminPanel
      key={`${fromLocal}_${toLocal}`}
      initialQuotes={rows}
      defaultFromLocal={fromLocal}
      defaultToLocal={toLocal}
      orderCutoffHourAr={orderCutoffHourAr}
    />
  );
}
