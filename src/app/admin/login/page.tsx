import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
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
    <div className="mx-auto max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white/90 p-6 shadow-sm">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Admin</h1>
        <p className="text-sm text-neutral-600">Acceso administradores</p>
        {callbackUrl.startsWith("/remitos/") ? (
          <p className="text-xs text-neutral-500">
            Después del login vas a ver el remito del enlace.
          </p>
        ) : null}
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
  );
}
