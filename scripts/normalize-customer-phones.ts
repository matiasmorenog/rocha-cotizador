/**
 * One-off: normalize all Customer.phone to XX-XXXX-XXXX / +54 … format.
 * Usage: SEED_TARGET=development npx tsx scripts/normalize-customer-phones.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { normalizePhone } from "../src/lib/phone-contact";
import { revalidateAppCache } from "./revalidate-app-cache";

const db = new PrismaClient();

async function main() {
  assertSafeDestructiveDb();

  const customers = await db.customer.findMany({
    where: { phone: { not: null } },
    select: { id: true, code: true, phone: true },
    orderBy: { code: "asc" },
  });

  let updated = 0;
  const examples: Array<{ code: string; before: string; after: string | null }> =
    [];

  for (const c of customers) {
    const before = c.phone!;
    const after = normalizePhone(before);
    if ((after ?? null) === before) continue;

    await db.customer.update({
      where: { id: c.id },
      data: { phone: after },
    });

    updated += 1;
    console.log(`[${c.code}] "${before}" → "${after ?? ""}"`);
    if (examples.length < 8) {
      examples.push({ code: c.code, before, after });
    }
  }

  console.log(`\nUpdated: ${updated} / ${customers.length} with phone`);
  if (examples.length) {
    console.log("\nExamples:");
    for (const e of examples) {
      console.log(`  ${e.code}: "${e.before}" → "${e.after ?? ""}"`);
    }
  }
  await revalidateAppCache();
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
