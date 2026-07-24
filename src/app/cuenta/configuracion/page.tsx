import { requireCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { CustomerChangePasswordForm } from "@/components/account/customer-change-password-form";

export default async function AccountConfigPage() {
  const session = await requireCustomerSession();
  const customer = await db.customer.findUnique({
    where: { id: session.user.customerId! },
    select: { mustChangePassword: true },
  });

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Configuración</h1>
        <p className="text-sm text-neutral-600">
          {session.user.name} · código {session.user.customerCode}
        </p>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Cambiar contraseña
        </h2>
        <div className="space-y-3">
          {customer?.mustChangePassword ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Todavía usás el PIN inicial. Podés cambiarlo por una contraseña más segura cuando
              quieras.
            </p>
          ) : null}
          <CustomerChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
