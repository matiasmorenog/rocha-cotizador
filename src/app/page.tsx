import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import { SkeletonHomePage } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";

async function HomeContent() {
  const session = await auth();
  if (session?.user?.role === "CUSTOMER") redirect("/cotizar");
  if (session?.user?.role === "ADMIN") redirect("/admin");

  return (
    <BrandBackdrop className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center py-4">
      <div className="w-full space-y-6 rounded-xl border border-[var(--brand-latte)]/50 bg-[var(--brand-primary-soft)]/95 p-6 shadow-sm backdrop-blur-[2px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo size="2xl" priority />
          <p className="max-w-sm text-sm text-neutral-600">
            Ingresá con tu código de cliente y contraseña para armar cotizaciones
            y ver remitos.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white hover:brightness-95"
          >
            Ingresar como cliente
          </Link>
          <Link
            href="/admin/login"
            className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
          >
            Ingresar como administrador
          </Link>
        </div>
      </div>
    </BrandBackdrop>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<SkeletonHomePage />}>
      <HomeContent />
    </Suspense>
  );
}
