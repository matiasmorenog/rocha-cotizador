import { Suspense } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { PlatformPaymentsPanel } from "@/components/admin/platform-payments-panel";
import { SkeletonAdminPriceListsBody } from "@/components/ui/skeleton";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import { getSubscriptionPayments } from "@/lib/subscription-payments";
import { requireStaffPermission } from "@/lib/session";

async function PlataformaBody({ canRegister }: { canRegister: boolean }) {
  const payments = await getSubscriptionPayments();
  return (
    <PlatformPaymentsPanel payments={payments} canRegister={canRegister} />
  );
}

export default async function PlatformPaymentsPage() {
  const session = await requireStaffPermission("settings");
  const canRegister =
    Boolean(session.user.isSuperuser) && !session.user.staffPreview;
  const chrome = adminModuleChromeForPath("/admin/plataforma")!;

  return (
    <div className="space-y-6">
      <AdminModulePageHeader
        title={chrome.title}
        description={
          canRegister
            ? "Registro interno del abono mensual. No figura en el menú."
            : (chrome.description ??
              "Historial del abono mensual (solo lectura).")
        }
      />
      <Suspense fallback={<SkeletonAdminPriceListsBody />}>
        <PlataformaBody canRegister={canRegister} />
      </Suspense>
    </div>
  );
}
