import { getWhatsAppNotifyDigits } from "@/lib/business-settings";
import { requireAdminSession } from "@/lib/session";
import { PushNotificationsSettings } from "@/components/admin/push-notifications-settings";
import { WhatsAppSettingsForm } from "@/components/admin/whatsapp-settings-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export default async function AdminConfigPage() {
  const [whatsappNotifyPhone, session] = await Promise.all([
    getWhatsAppNotifyDigits(),
    requireAdminSession(),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Configuración</h1>
        <p className="text-sm text-neutral-600">
          Ajustes generales del cotizador y de tu cuenta.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Avisos (app + sistema)
        </h2>
        <PushNotificationsSettings />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Avisos / WhatsApp
        </h2>
        <WhatsAppSettingsForm initialPhone={whatsappNotifyPhone} />
      </section>

      <section
        id="cuenta"
        className="scroll-mt-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Mi cuenta
        </h2>
        <p className="mb-3 text-sm text-neutral-600">
          {session.user.name ?? "Admin"}
          {session.user.email ? ` · ${session.user.email}` : null}
        </p>
        <h3 className="mb-3 text-sm font-medium text-neutral-800">
          Cambiar contraseña
        </h3>
        <ChangePasswordForm
          apiPath="/api/admin/account/password"
          showPinHint={false}
        />
      </section>
    </div>
  );
}
