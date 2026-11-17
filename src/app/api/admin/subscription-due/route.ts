import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { isSubscriptionBillingEnabled } from "@/lib/subscription-billing";
import {
  argentinaYearMonth,
  formatPeriodLabel,
  getSubscriptionDueReminder,
} from "@/lib/subscription-payments";
import { argentinaTodayYmd } from "@/lib/argentina-time";

export const runtime = "nodejs";
export const maxDuration = 15;

/** Lightweight due-reminder flag for any /admin staff session. */
export async function GET() {
  if (!(await requireStaffApi())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isSubscriptionBillingEnabled()) {
    const todayAr = argentinaTodayYmd();
    const { year, month } = argentinaYearMonth();
    return NextResponse.json({
      due: false,
      paid: true,
      periodYear: year,
      periodMonth: month,
      periodLabel: formatPeriodLabel(year, month),
      dayAr: Number(todayAr.slice(8, 10)),
      todayAr,
      billingEnabled: false,
    });
  }

  const reminder = await getSubscriptionDueReminder();
  return NextResponse.json({ ...reminder, billingEnabled: true });
}
