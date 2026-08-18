import Link from "next/link";
import { LogOut } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { PinChangeHint } from "@/components/account/pin-change-hint";
import { AdminMenuButton } from "@/components/admin/admin-menu-button";
import { AdminThemeToggle } from "@/components/admin/admin-theme-toggle";
import { HeaderProgressLine } from "@/components/header-progress-line";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { isStaffRole } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";

export async function AppHeader() {
  const session = await auth();
  const isCustomer = session?.user?.role === "CUSTOMER";
  const isStaff = isStaffRole(session?.user?.role);
  /** From JWT — updated via session.update() after password change. No Neon hit. */
  const mustChangePassword = Boolean(session?.user?.mustChangePassword);

  return (
    <>
      <header className="relative z-10 border-b border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)]/80 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {isStaff ? <AdminMenuButton /> : null}
            <Link
              href={isCustomer ? "/cotizar" : isStaff ? "/admin" : "/"}
              className="truncate text-base font-semibold tracking-tight text-[var(--brand-primary)] sm:text-lg"
            >
              Rocha Cotizador
            </Link>
          </div>
          {isCustomer || isStaff ? (
            <nav className="flex items-center gap-3 text-sm">
              {isCustomer ? (
                <>
                  <Link href="/cotizar" className="text-neutral-700 hover:text-neutral-900">
                    Cotizar
                  </Link>
                  <Link href="/remitos" className="text-neutral-700 hover:text-neutral-900">
                    Remitos
                  </Link>
                  <Link
                    href="/cuenta/configuracion"
                    className="text-neutral-700 hover:text-neutral-900"
                  >
                    Configuración
                  </Link>
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
                </>
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
            </nav>
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
