import Link from "next/link";
import { LogOut } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { PinChangeHint } from "@/components/account/pin-change-hint";
import { AdminMenuButton } from "@/components/admin/admin-menu-button";
import { HeaderProgressLine } from "@/components/header-progress-line";
import { isStaffRole } from "@/lib/staff-permissions";

export async function AppHeader() {
  const session = await auth();
  const isCustomer = session?.user?.role === "CUSTOMER";
  const isStaff = isStaffRole(session?.user?.role);
  const modules = session?.user?.modules ?? [];
  const hasMermas = modules.includes("MERMAS");
  const hasConsumables = modules.includes("CONSUMABLES");
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
                  {hasMermas ? (
                    <Link
                      href="/mermas"
                      className="text-neutral-700 hover:text-neutral-900"
                    >
                      Mermas
                    </Link>
                  ) : null}
                  {hasConsumables ? (
                    <Link
                      href="/consumibles"
                      className="text-neutral-700 hover:text-neutral-900"
                    >
                      Consumibles
                    </Link>
                  ) : null}
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
                    className="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                  </button>
                </form>
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
