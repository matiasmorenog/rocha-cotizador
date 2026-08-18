/**
 * Set User.isSuperuser on emails in PLATFORM_OWNER_EMAIL.
 * Development Neon only — refuses production.
 *
 * Usage:
 *   SEED_TARGET=development npx tsx scripts/bootstrap-superuser.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { parsePlatformOwnerEmails } from "../src/lib/platform-owner";

async function main() {
  assertSafeDestructiveDb();
  const emails = parsePlatformOwnerEmails();
  if (emails.length === 0) {
    console.error(
      "Set PLATFORM_OWNER_EMAIL (single email or comma-separated) in .env",
    );
    process.exit(1);
  }

  const db = new PrismaClient();
  const r = await db.user.updateMany({
    where: { email: { in: emails } },
    data: { isSuperuser: true },
  });
  const flagged = await db.user.findMany({
    where: { isSuperuser: true },
    select: { email: true },
  });
  console.log(
    `Updated ${r.count} user(s). Superusuario: ${flagged.map((u) => u.email).join(", ") || "(none)"}`,
  );
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
