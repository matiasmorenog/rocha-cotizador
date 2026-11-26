import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { PriceListEditor } from "@/components/admin/price-list-editor";
import { getAdminPriceListDetail } from "@/lib/admin-price-lists-data";
import { requireStaffPermission } from "@/lib/session";

export default async function AdminListaPrecioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffPermission("priceLists");
  const { id } = await params;
  const list = await getAdminPriceListDetail(id);

  if (!list) notFound();

  const description = `${list.customerCount} cliente(s) · ${
    list.isBase
      ? "Precio base (Product.basePrice)"
      : list.excelKey
        ? `Excel lista ${list.excelKey}`
        : "Lista manual"
  }`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/listas-precios"
          className="text-sm text-[var(--brand-primary)] underline hover:opacity-80"
        >
          ← Listas de precios
        </Link>
        <AdminModulePageHeader title={list.name} description={description} />
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
