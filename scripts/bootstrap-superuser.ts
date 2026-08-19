/**
 * Ensure singleton SUPERUSER from PLATFORM_OWNER_EMAIL.
 * Development Neon only — refuses production.
 *
 * Creates missing owner account (password: ADMIN_PASSWORD or seed default).
 * Migrates legacy ADMIN+isSuperuser rows to role SUPERUSER.
 *
 * Usage:
 *   SEED_TARGET=development npx tsx scripts/bootstrap-superuser.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import {
  parsePlatformOwnerEmails,
  primaryPlatformOwnerEmail,
} from "../src/lib/platform-owner";

const DEFAULT_BOOTSTRAP_PASSWORD = "admin1234";

async function main() {
  assertSafeDestructiveDb();
  const emails = parsePlatformOwnerEmails();
  const ownerEmail = primaryPlatformOwnerEmail();
  if (!ownerEmail) {
    console.error(
      "Set PLATFORM_OWNER_EMAIL (single email or comma-separated) in .env",
    );
    process.exit(1);
  }
  if (emails.length > 1) {
    console.warn(
      `Multiple PLATFORM_OWNER_EMAIL entries; singleton superuser uses only ${ownerEmail}`,
    );
  }

  const password =
    process.env.ADMIN_PASSWORD?.trim() || DEFAULT_BOOTSTRAP_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  const db = new PrismaClient();
  let created = 0;
  let migrated = 0;

  const existing = await db.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, role: true, isSuperuser: true },
  });

  if (!existing) {
    await db.user.create({
      data: {
        email: ownerEmail,
        name: "Superusuario",
        passwordHash,
        role: "SUPERUSER",
        canQuotes: false,
        canStock: false,
        isSuperuser: true,
        active: true,
      },
    });
    created += 1;
    console.log(`Created superuser: ${ownerEmail}`);
  } else if (existing.role !== "SUPERUSER" || !existing.isSuperuser) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        role: "SUPERUSER",
        isSuperuser: true,
        canQuotes: false,
        canStock: false,
      },
    });
    migrated += 1;
    console.log(`Migrated to SUPERUSER: ${ownerEmail}`);
  } else {
    console.log(`Already SUPERUSER: ${ownerEmail}`);
  }

  const extraSuperusers = await db.user.findMany({
    where: { role: "SUPERUSER", NOT: { email: ownerEmail } },
    select: { id: true, email: true },
  });
  for (const u of extraSuperusers) {
    await db.user.update({
      where: { id: u.id },
      data: { role: "ADMIN", isSuperuser: false },
    });
    console.warn(`Demoted extra superuser to ADMIN: ${u.email}`);
  }

  const legacyFlagged = await db.user.updateMany({
    where: {
      isSuperuser: true,
      NOT: { email: ownerEmail },
    },
    data: { isSuperuser: false },
  });
  if (legacyFlagged.count > 0) {
    console.warn(`Cleared legacy isSuperuser on ${legacyFlagged.count} user(s)`);
  }

  const superuser = await db.user.findFirst({
    where: { role: "SUPERUSER" },
    select: { email: true },
  });
  console.log(
    `Done (created ${created}, migrated ${migrated}). Superusuario: ${superuser?.email ?? "(none)"}`,
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
