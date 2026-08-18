import { unstable_cache } from "next/cache";
import type { CustomerModule } from "@prisma/client";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  modulesFromAccess,
  type CustomerModuleFlags,
} from "@/lib/customer-modules";
import { sortPriceListsForDisplay } from "@/lib/pricing";

export type AdminCustomerTableRow = {
  id: string;
  code: string;
  name: string;
  nameNote: string | null;
  priceListId: string | null;
  priceListName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  paymentTerms: string | null;
  deliveryHours: string | null;
  active: boolean;
  modules: CustomerModuleFlags;
};

export type AdminCustomerPriceListOption = {
  id: string;
  name: string;
  active: boolean;
  isBase?: boolean;
};

export type AdminClientesPageData = {
  customers: AdminCustomerTableRow[];
  priceLists: AdminCustomerPriceListOption[];
};

async function fetchAdminClientesPageDataUncached(): Promise<AdminClientesPageData> {
  const [customers, moduleAccessRows, priceListsRaw] = await Promise.all([
    db.customer.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        nameNote: true,
        priceListId: true,
        address: true,
        phone: true,
        email: true,
        notes: true,
        paymentTerms: true,
        deliveryHours: true,
        active: true,
      },
    }),
    db.customerModuleAccess.findMany({
      select: { customerId: true, module: true, enabled: true },
    }),
    db.priceList.findMany({
      select: { id: true, name: true, active: true, excelKey: true, isBase: true },
    }),
  ]);

  const modulesByCustomer = new Map<
    string,
    { module: CustomerModule; enabled: boolean }[]
  >();
  for (const row of moduleAccessRows) {
    const list = modulesByCustomer.get(row.customerId);
    if (list) list.push(row);
    else modulesByCustomer.set(row.customerId, [row]);
  }

  const priceListNameById = new Map(
    priceListsRaw.map((l) => [l.id, l.name] as const),
  );

  const tableRows: AdminCustomerTableRow[] = customers.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    nameNote: c.nameNote,
    priceListId: c.priceListId,
    priceListName: c.priceListId
      ? (priceListNameById.get(c.priceListId) ?? null)
      : null,
    address: c.address,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    paymentTerms: c.paymentTerms,
    deliveryHours: c.deliveryHours,
    active: c.active,
    modules: modulesFromAccess(modulesByCustomer.get(c.id) ?? []),
  }));

  const priceLists = sortPriceListsForDisplay(priceListsRaw).map(
    ({ id, name, active, isBase }) => ({ id, name, active, isBase }),
  );

  return { customers: tableRows, priceLists };
}

/**
 * Admin /clientes table payload (all customers + list options + module flags).
 * Flat queries avoid nested Prisma joins; TTL 24h via customers + price-lists tags.
 */
const getCachedAdminClientesPageData = unstable_cache(
  fetchAdminClientesPageDataUncached,
  ["admin-clientes-page"],
  {
    tags: [CACHE_TAGS.customers, CACHE_TAGS.priceLists],
    revalidate: 86400,
  },
);

export function getAdminClientesPageData(): Promise<AdminClientesPageData> {
  return getCachedAdminClientesPageData();
}
