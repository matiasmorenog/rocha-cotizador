/**
 * One-off: move email-looking Customer.phone values into Customer.email.
 * Usage: SEED_TARGET=development npx tsx scripts/migrate-customer-emails.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import {
  appendContactToName,
  parsePhoneContact,
} from "../src/lib/phone-contact";

const db = new PrismaClient();

async function main() {
  assertSafeDestructiveDb();

  const customers = await db.customer.findMany({
    where: { phone: { contains: "@" } },
    select: { id: true, code: true, name: true, phone: true, email: true },
    orderBy: { code: "asc" },
  });

  let migrated = 0;

  for (const c of customers) {
    const oldPhone = c.phone!;
    const { phone, email, contact } = parsePhoneContact(oldPhone);

    if (!email) continue;

    let newName = c.name;
    if (contact) {
      newName = appendContactToName(c.name, contact);
    }

    // Keep existing email if already set and different; prefer parsed when empty.
    const nextEmail = c.email?.trim() || email;

    await db.customer.update({
      where: { id: c.id },
      data: {
        phone,
        email: nextEmail,
        ...(newName !== c.name ? { name: newName } : {}),
      },
    });

    migrated += 1;
    console.log(
      `[${c.code}] phone="${oldPhone}" → phone="${phone ?? ""}" email="${nextEmail}"` +
        (newName !== c.name ? ` name="${c.name}" → "${newName}"` : ""),
    );
  }

  console.log(`\nMigrated: ${migrated} / ${customers.length} with @ in phone`);
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
