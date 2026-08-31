/**
 * Set the same PIN/password for every customer (dev Neon only).
 *
 *   SEED_TARGET=development npx tsx scripts/dev-set-all-customer-pins.ts
 *   DEV_CUSTOMER_PIN=0000 SEED_TARGET=development npx tsx scripts/dev-set-all-customer-pins.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { revalidateAppCache } from "./revalidate-app-cache";

const db = new PrismaClient();

async function main() {
  assertSafeDestructiveDb();

  const pin = (process.env.DEV_CUSTOMER_PIN ?? "0000").trim();
  if (!/^\d{4,}$/.test(pin)) {
    throw new Error("DEV_CUSTOMER_PIN must be at least 4 digits");
  }

  const passwordHash = await bcrypt.hash(pin, 10);
  const result = await db.customer.updateMany({
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  console.log(`Updated ${result.count} customers → PIN ${pin} (mustChangePassword=false)`);
  await revalidateAppCache();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
