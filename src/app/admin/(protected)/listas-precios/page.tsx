import { requireStaffPermission } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { DataTableScroll } from "@/components/ui/data-table";
import { PriceListCreateForm } from "@/components/admin/price-list-create-form";
import { PriceListRowActions } from "@/components/admin/price-list-row-actions";
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

      <DataTableScroll className="data-table-rows-2l">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Excel</th>
              <th className="px-3 py-2">Productos</th>
              <th className="px-3 py-2">Clientes</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lists.map((l) => (
              <tr key={l.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{l.name}</td>
                <td className="px-3 py-2 font-mono text-neutral-600">
                  {l.excelKey ?? "—"}
                </td>
                <td className="px-3 py-2">{l.itemCount}</td>
                <td className="px-3 py-2">{l.customerCount}</td>
                <td className="px-3 py-2">
                  <Badge variant={l.active ? "success" : "danger"}>
                    {l.active ? "Activa" : "Inactiva"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <PriceListRowActions
                    id={l.id}
                    name={l.name}
                    customerCount={l.customerCount}
                    isBase={l.isBase}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableScroll>
    </div>
  );
}
