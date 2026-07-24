import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import { CustomerLoginForm } from "@/components/auth/customer-login-form";
import { safeCallbackUrl } from "@/lib/callback-url";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallback } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallback, "/cotizar");
  const session = await auth();
  if (session?.user?.role === "CUSTOMER") redirect(callbackUrl);
  if (session?.user?.role === "ADMIN") {
    redirect(safeCallbackUrl(rawCallback, "/admin"));
  }

  const chooserHref = rawCallback?.trim()
    ? `/entrar?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/entrar";

  return (
    <BrandBackdrop className="mx-auto flex min-h-[60vh] max-w-md items-center py-4">
      <div className="w-full space-y-6 rounded-xl border border-[var(--brand-latte)]/50 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" priority />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-neutral-900">
              Acceso clientes
            </h1>
            <p className="text-sm text-neutral-600">
              Código de cliente y contraseña (PIN inicial la primera vez)
            </p>
            {callbackUrl.startsWith("/remitos/") ? (
              <p className="text-xs text-neutral-500">
                Después del login vas a ver el remito del enlace.
              </p>
            ) : null}
          </div>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-neutral-500">Cargando…</p>}>
          <CustomerLoginForm />
        </Suspense>
        <p className="text-center text-xs text-neutral-500">
          <Link href={chooserHref} className="underline">
            Elegir otro tipo de acceso
          </Link>
        </p>
      </div>
    </BrandBackdrop>
  );
}
