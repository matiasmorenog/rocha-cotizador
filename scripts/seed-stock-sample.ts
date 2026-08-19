/**
 * Idempotent sample data for stock catalog + 1 merma + 1 consumible entry.
 * Dev Neon only (assertSafeDestructiveDb).
 *
 *   SEED_TARGET=development npx tsx scripts/seed-stock-sample.ts
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
    `Customer modules: Mermas=${modules.mermas}, Consumibles=${modules.consumables}`,
  );
  const stock = await seedStockSampleData();
  console.log(
    `Stock sample: merma lines=${stock.mermaLines}, consumibles lines=${stock.consumableLines}, merma customer=${stock.mermaCustomer ?? "n/a"}, consumibles customer=${stock.consumableCustomer ?? "n/a"}`,
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
