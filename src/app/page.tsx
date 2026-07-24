import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { BrandLogo } from "@/components/brand-logo";
import { auth } from "@/lib/auth";
import { parseBrandPattern, withBgParam } from "@/lib/brand-patterns";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ bg?: string }>;
}) {
  const { bg } = await searchParams;
  const pattern = parseBrandPattern(bg);
  const session = await auth();
  if (session?.user?.role === "CUSTOMER") redirect("/cotizar");
  if (session?.user?.role === "ADMIN") redirect("/admin");

  return (
    <BrandBackdrop
      pattern={pattern}
      className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center"
    >
      <div className="flex flex-col items-center gap-5">
        <BrandLogo size="2xl" priority />
        <p className="mx-auto max-w-md text-neutral-600">
          Ingresá con tu código de cliente y contraseña para armar cotizaciones y
          ver remitos.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href={withBgParam("/login", pattern)}
          className="inline-flex h-10 items-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white hover:brightness-95"
        >
          Ingresar como cliente
        </Link>
        <Link
          href={withBgParam("/admin/login", pattern)}
          className="inline-flex h-10 items-center rounded-md border border-[var(--brand-latte)] bg-white px-4 text-sm text-neutral-800 hover:bg-[var(--brand-primary-soft)]"
        >
          Admin
        </Link>
      </div>
      <p className="text-xs text-neutral-500">
        <Link href={`/preview-fondos?bg=${pattern}`} className="underline">
          Comparar fondos
        </Link>
      </p>
    </BrandBackdrop>
  );
}
