import { requireStaffPermission } from "@/lib/session";
import { PriceListCreateForm } from "@/components/admin/price-list-create-form";
import { PriceListsTable } from "@/components/admin/price-lists-table";
import { getAdminPriceListsPageData } from "@/lib/admin-price-lists-data";

export default async function AdminListasPreciosPage() {
  await requireStaffPermission("priceLists");
  const lists = await getAdminPriceListsPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Listas de precios
        </h1>
        <p className="text-sm text-neutral-600">
          Precios fijos por producto. La lista Precio base refleja Product.basePrice
          y no se puede eliminar. Otras listas se pueden borrar; clientes asignados
          vuelven a Precio base.
        </p>
      </div>

      <PriceListCreateForm />

      <PriceListsTable lists={lists} />
    </div>
  );
}
