import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-permissions";
import { safeCallbackUrl } from "@/lib/callback-url";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallback } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallback, "/");
  const session = await auth();

  if (isStaffRole(session?.user?.role)) {
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
    <BrandBackdrop className="mx-auto flex min-h-[60vh] max-w-md items-center py-4">
      <div className="w-full space-y-6 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)]/95 p-6 shadow-sm backdrop-blur-[2px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo size="xl" priority />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-neutral-900">Ingresar</h1>
            <p className="text-sm text-neutral-600">
              {isRemito
                ? "Elegí cómo ingresar para ver el remito."
                : "Elegí el tipo de acceso."}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link
            href={customerHref}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white transition-colors hover:opacity-90",
              FOCUS_BRAND_PRIMARY,
            )}
          >
            Soy cliente
          </Link>
          <Link
            href={adminHref}
            className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
          >
            Ingresar como administrador
          </Link>
        </div>
      </div>
    </BrandBackdrop>
  );
}
