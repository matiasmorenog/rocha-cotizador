import { getWhatsAppNotifyDigits } from "@/lib/business-settings";
import { requireStaffPermission } from "@/lib/session";
import { PushNotificationsSettings } from "@/components/admin/push-notifications-settings";
import { WhatsAppSettingsForm } from "@/components/admin/whatsapp-settings-form";
import { AdminChangeEmailForm } from "@/components/account/admin-change-email-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export default async function AdminConfigPage() {
  const [whatsappNotifyPhone, session] = await Promise.all([
    getWhatsAppNotifyDigits(),
    requireStaffPermission("settings"),
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
          Notificaciones
        </h2>
        <div className="space-y-4">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
            <p className="font-semibold text-neutral-900">WhatsApp</p>
            <p className="mt-1 text-neutral-600">
              Número para abrir WhatsApp (wa.me) al confirmar una cotización de
              cliente.
            </p>
            <div className="mt-3">
              <WhatsAppSettingsForm initialPhone={whatsappNotifyPhone} />
            </div>
          </div>
          <PushNotificationsSettings />
        </div>
      </section>

      <section
        id="cuenta"
        className="scroll-mt-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Mi cuenta
        </h2>
        <p className="mb-4 text-sm text-neutral-600">
          {session.user.name ?? "Admin"}
          {session.user.email ? ` · ${session.user.email}` : null}
        </p>
        <div className="space-y-4">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
            <p className="font-semibold text-neutral-900">Cambiar email</p>
            <p className="mt-1 text-neutral-600">
              Actualizá el email con el que ingresás al panel de administración.
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
              Elegí una contraseña segura para proteger tu cuenta de admin.
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
    </div>
  );
}
