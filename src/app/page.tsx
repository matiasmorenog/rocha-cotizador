import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.role === "CUSTOMER") redirect("/cotizar");
  if (session?.user?.role === "ADMIN") redirect("/admin");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--brand-primary)]">
          Mayorista
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
          Rocha Cotizador
        </h1>
        <p className="mx-auto max-w-md text-neutral-600">
          Ingresá con tu código de cliente y contraseña para armar cotizaciones y ver remitos.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white hover:brightness-95"
        >
          Ingresar como cliente
        </Link>
        <Link
          href="/admin/login"
          className="inline-flex h-10 items-center rounded-md border border-neutral-300 bg-white px-4 text-sm text-neutral-800 hover:bg-neutral-50"
        >
          Admin
        </Link>
      </div>
    </div>
  );
}
