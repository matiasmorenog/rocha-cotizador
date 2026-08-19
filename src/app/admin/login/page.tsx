import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getOptionalSession } from "@/lib/session";
import { isAdminPanelRole, staffHomeHref } from "@/lib/staff-permissions";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { LoginCard } from "@/components/auth/login-card";
import { Skeleton } from "@/components/ui/skeleton";
import { safeCallbackUrl } from "@/lib/callback-url";

export const dynamic = "force-dynamic";

function LoginFormFallback() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4" aria-hidden>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallback } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallback, "/admin");
  const session = await getOptionalSession();
  if (isAdminPanelRole(session?.user?.role) && session?.user) {
    redirect(
      session.user.role === "SUPERUSER"
        ? staffHomeHref(session.user.permissions, session.user.role)
        : callbackUrl,
    );
  }

  const customerLoginHref =
    callbackUrl !== "/admin"
      ? `/entrar?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/entrar";

  return (
    <BrandBackdrop className="mx-auto flex min-h-[60vh] max-w-md items-center py-4">
      <LoginCard>
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo size="xl" priority />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-neutral-900">Admin</h1>
            <p className="text-sm text-neutral-600">Acceso administradores</p>
            {callbackUrl.startsWith("/remitos/") ? (
              <p className="text-xs text-neutral-500">
                Después del login vas a ver el remito del enlace.
              </p>
            ) : null}
          </div>
        </div>
        <Suspense fallback={<LoginFormFallback />}>
          <AdminLoginForm />
        </Suspense>
        <p className="text-center text-xs text-neutral-500">
          <Link href={customerLoginHref} className="underline">
            Elegir otro tipo de acceso
          </Link>
        </p>
      </LoginCard>
    </BrandBackdrop>
  );
}
