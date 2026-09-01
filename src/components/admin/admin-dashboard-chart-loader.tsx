import { AdminQuoteActivitySection } from "@/components/admin/admin-quote-activity-section";
import {
  getAdminQuoteActivity,
  type QuoteActivityPeriod,
} from "@/lib/admin-quote-activity";

type Props = {
  period: QuoteActivityPeriod;
};

/** Async chart segment — one cached query, streamed after KPI shell paints. */
export async function AdminDashboardChartLoader({ period }: Props) {
  const activity = await getAdminQuoteActivity(period);

  return (
    <AdminQuoteActivitySection
      initial={{
        period: activity.period,
        points: activity.points,
        totalQuotes: activity.totalQuotes,
        totalRevenue: activity.totalRevenue,
      }}
    />
  );
}
