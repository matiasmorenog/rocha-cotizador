import { Suspense } from "react";
import { requireStaffPermission } from "@/lib/session";
import { staffHasPermission } from "@/lib/staff-permissions";
import { getRochaSubscriptionStatus } from "@/lib/subscription-payments";
import { parseConfigTab } from "@/lib/admin-config-tabs";
import { PushNotificationsSettings } from "@/components/admin/push-notifications-settings";
import { SubscriptionStatusSection } from "@/components/admin/subscription-status-section";
import { WhatsAppSettingsSection } from "@/components/admin/whatsapp-settings-section";
import { WhatsAppSettingsSectionSkeleton } from "@/components/admin/whatsapp-settings-section-skeleton";
import { AdminChangeEmailForm } from "@/components/account/admin-change-email-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";

type SearchParams = Promise<{ tab?: string }>;

export default async function AdminConfigPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tab = parseConfigTab(params.tab);
  const session = await requireStaffPermission("account");
  const canEditAppSettings = staffHasPermission(session.user.permissions, "settings");
  const canViewPayments = canEditAppSettings;
  const canRegisterPayments =
    Boolean(session.user.isSuperuser) && !session.user.staffPreview;
  const subscriptionStatus =
    tab === "servicio" ? await getRochaSubscriptionStatus() : null;

  if (tab === "notificaciones") {
    return (
      <section className="max-w-2xl rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Notificaciones
        </h2>
        <div className="space-y-4">
          {canEditAppSettings ? (
            <Suspense fallback={<WhatsAppSettingsSectionSkeleton />}>
              <WhatsAppSettingsSection />
            </Suspense>
          ) : null}
          <PushNotificationsSettings />
        </div>
      </section>
    );
  }

  if (tab === "servicio" && subscriptionStatus) {
    return (
      <SubscriptionStatusSection
        status={subscriptionStatus}
        canViewPayments={canViewPayments}
        canRegisterPayments={canRegisterPayments}
      />
    );
  }

  return (
    <section className="w-fit max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Mi cuenta
      </h2>
      <p className="mb-4 text-sm text-neutral-600">
        {session.user.name ?? "Usuario"}
        {session.user.email ? ` · ${session.user.email}` : null}
      </p>
      <div className="space-y-4">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
          <p className="font-semibold text-neutral-900">Cambiar email</p>
          <p className="mt-1 text-neutral-600">
            Actualizá el email con el que ingresás al panel.
          </p>
          <div className="mt-3">
            {session.user.email ? (
              <AdminChangeEmailForm currentEmail={session.user.email} />
            ) : (
              <p className="text-sm text-neutral-500">
                No hay email asociado a esta cuenta.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
          <p className="font-semibold text-neutral-900">Cambiar contraseña</p>
          <p className="mt-1 text-neutral-600">
            Elegí una contraseña segura para proteger tu cuenta.
          </p>
          <div className="mt-3">
            <ChangePasswordForm
              apiPath="/api/admin/account/password"
              showPinHint={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
