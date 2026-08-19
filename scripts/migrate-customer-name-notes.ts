/**
 * One-off: split trailing "(note)" from Customer.name into Customer.nameNote.
 * Usage: SEED_TARGET=development npx tsx scripts/migrate-customer-name-notes.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { parseTrailingNameNote } from "../src/lib/customer-name-note";
import { revalidateAppCache } from "./revalidate-app-cache";

const db = new PrismaClient();

async function main() {
  assertSafeDestructiveDb();

  const customers = await db.customer.findMany({
    select: { id: true, code: true, name: true, nameNote: true },
    orderBy: { code: "asc" },
  });

  let migrated = 0;
  let skipped = 0;

  for (const c of customers) {
    if (c.nameNote?.trim()) {
      skipped += 1;
      continue;
    }

    const parsed = parseTrailingNameNote(c.name);
    if (!parsed) {
      skipped += 1;
      continue;
    }

    if (parsed.name === c.name && !parsed.nameNote) {
      skipped += 1;
      continue;
    }

    await db.customer.update({
      where: { id: c.id },
      data: {
        name: parsed.name,
        nameNote: parsed.nameNote,
      },
    });

    migrated += 1;
    console.log(
      `[${c.code}] "${c.name}" → name="${parsed.name}" nameNote="${parsed.nameNote}"`,
    );
  }

  console.log(
    `\nMigrated: ${migrated} / ${customers.length} (${skipped} unchanged)`,
  );
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
