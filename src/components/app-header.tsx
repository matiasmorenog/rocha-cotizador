import Link from "next/link";
import { LogOut } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { PinChangeHint } from "@/components/account/pin-change-hint";
import { AdminMenuButton } from "@/components/admin/admin-menu-button";
import { BrandLogo } from "@/components/brand-logo";

export async function AppHeader() {
  const session = await auth();
  const isCustomer = session?.user?.role === "CUSTOMER";
  const isAdmin = session?.user?.role === "ADMIN";
  /** From JWT — updated via session.update() after password change. No Neon hit. */
  const mustChangePassword = Boolean(session?.user?.mustChangePassword);

  return (
    <>
      <header className="border-b border-[var(--brand-latte)]/60 bg-[var(--brand-primary-soft)]/80 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {isAdmin ? <AdminMenuButton /> : null}
            <Link
              href={isCustomer ? "/cotizar" : isAdmin ? "/admin" : "/"}
              className="flex min-w-0 items-center gap-2.5"
            >
              <BrandLogo size="sm" />
              <span className="hidden truncate text-sm font-medium tracking-tight text-[var(--brand-primary)] sm:inline">
                Cotizador
              </span>
            </Link>
          </div>
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
            ) : isAdmin ? (
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
            ) : (
              <>
                <Link href="/login" className="text-neutral-700 hover:text-neutral-900">
                  Cliente
                </Link>
                <Link href="/admin/login" className="text-neutral-700 hover:text-neutral-900">
                  Admin
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {isCustomer ? <PinChangeHint show={mustChangePassword} /> : null}
    </>
  );
}
