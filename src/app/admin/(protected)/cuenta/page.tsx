import { requireStaffPermission } from "@/lib/session";
import { AdminChangeEmailForm } from "@/components/account/admin-change-email-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { PushNotificationsSettings } from "@/components/admin/push-notifications-settings";

export default async function AdminAccountPage() {
  const session = await requireStaffPermission("account");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Mi cuenta</h1>
        <p className="text-sm text-neutral-600">
          {session.user.name ?? "Usuario"}
          {session.user.email ? ` · ${session.user.email}` : null}
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Notificaciones
        </h2>
        <PushNotificationsSettings />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
            <p className="font-semibold text-neutral-900">Cambiar email</p>
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
