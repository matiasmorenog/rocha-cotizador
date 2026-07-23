import { requireAdminSession } from "@/lib/session";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export default async function AdminAccountPage() {
  const session = await requireAdminSession();

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Mi cuenta</h1>
        <p className="text-sm text-neutral-600">
          {session.user.name ?? "Admin"}
          {session.user.email ? ` · ${session.user.email}` : null}
        </p>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Cambiar contraseña
        </h2>
        <ChangePasswordForm
          apiPath="/api/admin/account/password"
          showPinHint={false}
        />
      </div>
    </div>
  );
}
