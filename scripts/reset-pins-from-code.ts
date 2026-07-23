/**
 * Set every Customer PIN to code.padStart(4, "0") (001 → 0001).
 * Also regenerates prisma/data/seed-pins.csv.
 * Usage: SEED_TARGET=development npx tsx scripts/reset-pins-from-code.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { pinFromCustomerCode } from "../src/lib/utils";

const db = new PrismaClient();

async function main() {
  assertSafeDestructiveDb();

  const customers = await db.customer.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      discountPercent: true,
    },
    orderBy: { code: "asc" },
  });

  const pins: Array<{
    code: string;
    name: string;
    pin: string;
    discountPercent: number;
  }> = [];
  const examples: Array<{ code: string; pin: string }> = [];

  for (const c of customers) {
    const pin = pinFromCustomerCode(c.code);
    const passwordHash = await bcrypt.hash(pin, 10);
    await db.customer.update({
      where: { id: c.id },
      data: { passwordHash, mustChangePassword: true },
    });
    pins.push({
      code: c.code,
      name: c.name,
      pin,
      discountPercent: Number(c.discountPercent),
    });
    if (examples.length < 3) {
      examples.push({ code: c.code, pin });
    }
  }

  const csvPath = path.join(process.cwd(), "prisma", "data", "seed-pins.csv");
  const csv = [
    "code,name,pin,discountPercent",
    ...pins.map(
      (p) =>
        `${p.code},"${p.name.replace(/"/g, '""')}",${p.pin},${p.discountPercent}`,
    ),
  ].join("\n");
  fs.writeFileSync(csvPath, `${csv}\n`, "utf8");

  console.log(`Updated: ${pins.length}`);
  console.log(`Rule: PIN = code digits padStart(4, "0")`);
  console.log("Examples:", examples.map((e) => `${e.code}→${e.pin}`).join(", "));
  console.log(`CSV: ${csvPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
