import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { PriceListEditor } from "@/components/admin/price-list-editor";

export default async function AdminListaPrecioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await db.priceList.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              rubro: true,
              basePrice: true,
              active: true,
            },
          },
        },
        orderBy: { product: { code: "asc" } },
      },
      _count: { select: { customers: true } },
    },
  });

  if (!list) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/listas-precios"
          className="text-sm text-[var(--brand-primary)] underline hover:opacity-80"
        >
          ← Listas de precios
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          {list.name}
        </h1>
        <p className="text-sm text-neutral-600">
          {list._count.customers} cliente(s) ·{" "}
          {list.isBase
            ? "Precio base (Product.basePrice)"
            : list.excelKey
              ? `Excel lista ${list.excelKey}`
              : "Lista manual"}
        </p>
      </div>

      <PriceListEditor
        key={`${list.id}-${list.items.length}-${list.updatedAt.toISOString()}`}
        priceList={{
          id: list.id,
          name: list.name,
          active: list.active,
          isBase: list.isBase,
          items: list.items.map((i) => ({
            productId: i.productId,
            unitPrice: Number(i.unitPrice),
            product: {
              code: i.product.code,
              name: i.product.name,
              rubro: i.product.rubro,
              basePrice: Number(i.product.basePrice),
              active: i.product.active,
            },
          })),
        }}
      />
    </div>
  );
}
