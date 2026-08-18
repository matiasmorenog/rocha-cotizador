import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaffPermission } from "@/lib/session";
import { PriceListEditor } from "@/components/admin/price-list-editor";
import { getAdminPriceListDetail } from "@/lib/admin-price-lists-data";

export default async function AdminListaPrecioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffPermission("priceLists");
  const { id } = await params;
  const list = await getAdminPriceListDetail(id);

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
          {list.customerCount} cliente(s) ·{" "}
          {list.isBase
            ? "Precio base (Product.basePrice)"
            : list.excelKey
              ? `Excel lista ${list.excelKey}`
              : "Lista manual"}
        </p>
      </div>

      <PriceListEditor
        key={`${list.id}-${list.items.length}-${list.updatedAt}`}
        priceList={{
          id: list.id,
          name: list.name,
          active: list.active,
          isBase: list.isBase,
          items: list.items,
        }}
      />
    </div>
  );
}
