import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { PinChangeHint } from "@/components/account/pin-change-hint";
import { AdminMenuButton } from "@/components/admin/admin-menu-button";
import { AdminThemeToggle } from "@/components/admin/admin-theme-toggle";
import { CustomerMenuButton } from "@/components/customer/customer-menu-button";
import { HeaderProgressLine } from "@/components/header-progress-line";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { getOptionalSession } from "@/lib/session";
import { isAdminPanelRole, staffHomeHref } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";

export async function AppHeader() {
  const session = await getOptionalSession();
  const isCustomer = session?.user?.role === "CUSTOMER";
  const isStaff = isAdminPanelRole(session?.user?.role);
  const staffHome = isStaff
    ? staffHomeHref(session?.user?.permissions, session?.user?.role)
    : "/admin";
  /** From JWT — updated via session.update() after password change. No Neon hit. */
  const mustChangePassword = Boolean(session?.user?.mustChangePassword);

  return (
    <>
      <header className="relative z-10 border-b border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)]/80 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {isStaff ? <AdminMenuButton /> : null}
            {isCustomer ? <CustomerMenuButton /> : null}
            <Link
              href={isCustomer ? "/" : isStaff ? staffHome : "/"}
              className="truncate text-base font-semibold tracking-tight text-[var(--brand-primary)] sm:text-lg"
            >
              Rocha Cotizador
            </Link>
          </div>
          <div className="min-w-0 flex-1" aria-hidden />
          {isCustomer || isStaff ? (
            <div className="flex shrink-0 items-center gap-3 text-sm">
              {isCustomer ? (
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button
                    type="submit"
                    aria-label="Salir"
                    title="Salir"
                    className="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-4">
                  <AdminThemeToggle />
                  <span
                    className="h-5 w-px shrink-0 bg-neutral-300/70"
                    aria-hidden
                  />
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/admin/login" });
                    }}
                  >
                    <button
                      type="submit"
                      aria-label="Salir"
                      title="Salir"
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800",
                        FOCUS_BRAND_OUTLINE,
                      )}
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 translate-y-1/2">
          <HeaderProgressLine />
        </div>
      </header>
      {isCustomer ? <PinChangeHint show={mustChangePassword} /> : null}
    </>
  );
}
