import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { auth } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/callback-url";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallback } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallback, "/");
  const session = await auth();

  if (session?.user?.role === "ADMIN") {
    redirect(callbackUrl === "/" ? "/admin" : callbackUrl);
  }
  if (session?.user?.role === "CUSTOMER") {
    redirect(callbackUrl === "/" ? "/cotizar" : callbackUrl);
  }

  const encoded = encodeURIComponent(callbackUrl);
  const customerHref =
    callbackUrl !== "/" ? `/login?callbackUrl=${encoded}` : "/login";
  const adminHref =
    callbackUrl !== "/"
      ? `/admin/login?callbackUrl=${encoded}`
      : "/admin/login";

  const isRemito = callbackUrl.startsWith("/remitos/");

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-xl border border-[var(--brand-latte)]/50 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLogo size="md" priority />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">Ingresar</h1>
          <p className="text-sm text-neutral-600">
            {isRemito
              ? "Elegí cómo ingresar para ver el remito."
              : "Elegí el tipo de acceso."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href={customerHref}
          className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          Soy cliente
        </Link>
        <Link
          href={adminHref}
          className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--brand-latte)] bg-white px-4 text-sm font-medium text-neutral-900 transition-colors hover:bg-[var(--brand-primary-soft)]"
        >
          Soy administrador
        </Link>
      </div>
    </div>
  );
}
