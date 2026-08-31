/**
 * One-time: promote QUOTES/STOCK staff users to ADMIN (idempotent).
 * Run via seed or: npx tsx scripts/migrate-staff-roles-to-admin.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export async function migrateStaffRolesToAdmin(): Promise<number> {
  const result = await db.user.updateMany({
    where: { role: { in: ["QUOTES", "STOCK"] } },
    data: {
      role: "ADMIN",
      canQuotes: true,
      canStock: true,
    },
  });
  return result.count;
}

async function main() {
  const count = await migrateStaffRolesToAdmin();
  console.log(`Staff roles migrated to ADMIN: ${count}`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
