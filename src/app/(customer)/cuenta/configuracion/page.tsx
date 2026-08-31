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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Configuración</h1>
        <p className="text-sm text-neutral-600">
          {session.user.name} · código {session.user.customerCode}
        </p>
      </div>

      <section className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Mi cuenta
        </h2>
        <p className="mb-4 text-sm text-neutral-600">
          Actualizá la contraseña con la que ingresás al cotizador.
        </p>

        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
          <p className="font-semibold text-neutral-900">Cambiar contraseña</p>
          <p className="mt-1 text-neutral-600">
            Elegí una contraseña segura. Si todavía usás el PIN inicial, ingresalo
            como contraseña actual.
          </p>
          <div className="mt-3 space-y-3">
            {customer?.mustChangePassword ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Todavía usás el PIN inicial. Podés cambiarlo por una contraseña más
                segura cuando quieras.
              </p>
            ) : null}
            <CustomerChangePasswordForm />
          </div>
        </div>
      </section>
    </div>
  );
}
