/**
 * Dev-only: wipe stock sample entries and seed multi-day Desperdicios /
 * Consumibles / Activos data for admin Stock tabs.
 *
 * Safety: assertSafeDestructiveDb() — Neon main blocked; needs SEED_TARGET=development.
 *
 *   npm run dev:seed-stock
 *   DAYS_BACK=21 ENTRIES_PER_CUSTOMER=10 npm run dev:seed-stock
 *
 * Optional env: DAYS_BACK, ENTRIES_PER_CUSTOMER, CUSTOMERS_PER_MODULE, LINES_PER_ENTRY
 */
import "dotenv/config";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { seedCustomerModuleAccess } from "../src/lib/customer-modules";
import { db } from "../src/lib/db";
import { seedStockSampleData } from "../src/lib/stock-seed";
import { revalidateAppCache } from "./revalidate-app-cache";

async function main() {
  assertSafeDestructiveDb();
  const modules = await seedCustomerModuleAccess();
  console.log(
    `Customer modules: Desperdicios=${modules.desperdicios}, Consumibles=${modules.consumables}, Activos=${modules.activos}`,
  );
  const stock = await seedStockSampleData();
  console.log(
    `Stock sample: desperdicios=${stock.desperdiciosCustomer ?? "n/a"} entries=${stock.desperdicioEntries} lines=${stock.desperdicioLines}; consumibles=${stock.consumableCustomer ?? "n/a"} entries=${stock.consumableEntries} lines=${stock.consumableLines}; activos=${stock.activoCustomer ?? "n/a"} entries=${stock.activoEntries} lines=${stock.activoLines}`,
  );
}

main()
  .then(async () => {
    await revalidateAppCache();
    await db.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
