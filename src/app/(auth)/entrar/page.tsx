import Link from "next/link";
import { redirect } from "next/navigation";
import { EntrarDemoBlock } from "@/components/auth/demo-login-gate";
import { getOptionalSession } from "@/lib/session";
import { isAdminPanelRole, staffHomeHref } from "@/lib/staff-permissions";
import { safeCallbackUrl } from "@/lib/callback-url";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallback } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallback, "/");
  const session = await getOptionalSession();

  if (isAdminPanelRole(session?.user?.role) && session?.user) {
    const home = staffHomeHref(session.user.permissions, session.user.role);
    redirect(callbackUrl === "/" ? home : callbackUrl);
  }
  if (session?.user?.role === "CUSTOMER") {
    redirect(callbackUrl === "/" ? "/" : callbackUrl);
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
    <>
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Ingresar</h1>
        <p className="text-sm text-neutral-600">
          {isRemito
            ? "Elegí cómo ingresar para ver el remito."
            : "Elegí el tipo de acceso."}
        </p>
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

      <EntrarDemoBlock />
    </>
  );
}
