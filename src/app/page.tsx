import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import { LoginCard } from "@/components/auth/login-card";
import { CustomerHomeHub } from "@/components/customer/customer-home-hub";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { getOptionalSession } from "@/lib/session";
import { isAdminPanelRole, staffHomeHref } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getOptionalSession();
  if (isAdminPanelRole(session?.user?.role)) {
    redirect(staffHomeHref(session?.user?.permissions, session?.user?.role));
  }

  if (session?.user?.role === "CUSTOMER" && session.user.customerId) {
    return (
      <CustomerHomeHub
        userName={session.user.name}
        modules={session.user.modules ?? []}
      />
    );
  }

  return (
    <BrandBackdrop className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center py-4">
      <LoginCard>
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo size="2xl" priority />
          <p className="max-w-sm text-sm text-neutral-600">
            Ingresá con tu código de cliente y contraseña para armar cotizaciones
            y ver remitos.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/login"
            className={cn(
              "inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white hover:brightness-95",
              FOCUS_BRAND_PRIMARY,
            )}
          >
            Ingresar como cliente
          </Link>
          <Link
            href="/admin/login"
            className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
          >
            Ingresar como administrador
          </Link>
        </div>
      </LoginCard>
    </BrandBackdrop>
  );
}
