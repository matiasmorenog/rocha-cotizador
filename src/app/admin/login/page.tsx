import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { safeCallbackUrl } from "@/lib/callback-url";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallback } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallback, "/admin");
  const session = await auth();
  if (session?.user?.role === "ADMIN") redirect(callbackUrl);

  const customerLoginHref =
    callbackUrl !== "/admin"
      ? `/entrar?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/entrar";

  return (
    <BrandBackdrop className="mx-auto flex min-h-[60vh] max-w-md items-center py-4">
      <div className="w-full space-y-6 rounded-xl border border-[var(--brand-latte)]/50 bg-[var(--brand-primary-soft)]/95 p-6 shadow-sm backdrop-blur-[2px]">
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
        <Suspense fallback={<p className="text-center text-sm text-neutral-500">Cargando…</p>}>
          <AdminLoginForm />
        </Suspense>
        <p className="text-center text-xs text-neutral-500">
          <Link href={customerLoginHref} className="underline">
            Elegir otro tipo de acceso
          </Link>
        </p>
      </div>
    </BrandBackdrop>
  );
}
