import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.role === "CUSTOMER") redirect("/cotizar");
  if (session?.user?.role === "ADMIN") redirect("/admin");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <BrandLogo size="lg" priority />
        <p className="mx-auto max-w-md text-neutral-600">
          Ingresá con tu código de cliente y contraseña para armar cotizaciones y
          ver remitos.
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
          className="inline-flex h-10 items-center rounded-md border border-[var(--brand-latte)] bg-white px-4 text-sm text-neutral-800 hover:bg-[var(--brand-primary-soft)]"
        >
          Admin
        </Link>
      </div>
    </div>
  );
}
