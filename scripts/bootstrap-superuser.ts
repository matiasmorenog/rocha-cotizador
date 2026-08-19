/**
 * Ensure PLATFORM_OWNER_EMAIL users exist as ADMIN with isSuperuser.
 * Development Neon only — refuses production.
 *
 * Creates missing owner accounts (password: ADMIN_PASSWORD or seed default).
 *
 * Usage:
 *   SEED_TARGET=development npx tsx scripts/bootstrap-superuser.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { parsePlatformOwnerEmails } from "../src/lib/platform-owner";

const DEFAULT_BOOTSTRAP_PASSWORD = "admin1234";

async function main() {
  assertSafeDestructiveDb();
  const emails = parsePlatformOwnerEmails();
  if (emails.length === 0) {
    console.error(
      "Set PLATFORM_OWNER_EMAIL (single email or comma-separated) in .env",
    );
    process.exit(1);
  }

  const password =
    process.env.ADMIN_PASSWORD?.trim() || DEFAULT_BOOTSTRAP_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  const db = new PrismaClient();
  let created = 0;
  let updated = 0;

  for (const email of emails) {
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true, isSuperuser: true },
    });

    if (!existing) {
      await db.user.create({
        data: {
          email,
          name: "Superusuario",
          passwordHash,
          role: "ADMIN",
          canQuotes: true,
          canStock: true,
          isSuperuser: true,
          active: true,
        },
      });
      created += 1;
      console.log(`Created owner admin: ${email}`);
      continue;
    }

    if (!existing.isSuperuser) {
      await db.user.update({
        where: { id: existing.id },
        data: { isSuperuser: true },
      });
      updated += 1;
      console.log(`Set isSuperuser on existing user: ${email}`);
    } else {
      console.log(`Already superuser: ${email}`);
    }
  }

  const flagged = await db.user.findMany({
    where: { isSuperuser: true },
    select: { email: true },
  });
  console.log(
    `Done (created ${created}, flagged ${updated}). Superusuario: ${flagged.map((u) => u.email).join(", ") || "(none)"}`,
  );
  if (created > 0 && !process.env.ADMIN_PASSWORD?.trim()) {
    console.log(
      `New account password: ${DEFAULT_BOOTSTRAP_PASSWORD} (set ADMIN_PASSWORD to override)`,
    );
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
