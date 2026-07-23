/**
 * One-off: split Customer.phone "Telefono/Contacto" into phone-only + name (Contact).
 * Usage: SEED_TARGET=development npx tsx scripts/clean-customer-phones.ts
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
    where: { phone: { not: null } },
    select: { id: true, code: true, name: true, phone: true, email: true },
    orderBy: { code: "asc" },
  });

  let updated = 0;
  const examples: Array<{
    code: string;
    oldPhone: string;
    newPhone: string | null;
    newEmail: string | null;
    newName: string;
  }> = [];

  for (const c of customers) {
    const oldPhone = c.phone!;
    const { phone: newPhone, email: parsedEmail, contact } =
      parsePhoneContact(oldPhone);

    let newName = c.name;
    if (contact) {
      newName = appendContactToName(c.name, contact);
    }

    const newEmail = parsedEmail ?? c.email;
    const phoneChanged = (newPhone ?? null) !== oldPhone;
    const emailChanged = (newEmail ?? null) !== (c.email ?? null);
    const nameChanged = newName !== c.name;

    if (!phoneChanged && !emailChanged && !nameChanged) continue;

    await db.customer.update({
      where: { id: c.id },
      data: {
        phone: newPhone,
        ...(emailChanged ? { email: newEmail } : {}),
        ...(nameChanged ? { name: newName } : {}),
      },
    });

    updated += 1;
    const row = {
      code: c.code,
      oldPhone,
      newPhone,
      newEmail,
      newName,
    };
    console.log(
      `[${c.code}] phone: "${oldPhone}" → "${newPhone ?? ""}"` +
        (emailChanged ? ` email="${newEmail ?? ""}"` : "") +
        ` | name: "${c.name}" → "${newName}"`,
    );
    if (examples.length < 5) examples.push(row);
  }

  console.log(`\nUpdated: ${updated} / ${customers.length} with phone`);
  if (examples.length) {
    console.log("\nExamples:");
    for (const e of examples) {
      console.log(
        `  ${e.code}: "${e.oldPhone}" → phone="${e.newPhone ?? ""}" email="${e.newEmail ?? ""}" name="${e.newName}"`,
      );
    }
  }
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
