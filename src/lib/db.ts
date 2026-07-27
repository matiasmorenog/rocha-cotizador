import { PrismaClient } from "@prisma/client";

/**
 * Bump when prisma/schema.prisma gains fields that a long-lived `next dev`
 * process may still hold via globalThis (HMR reloads routes, not the client).
 * Forces a fresh PrismaClient without restarting the server.
 */
const PRISMA_SCHEMA_STAMP = "user-inAppNotificationsEnabled-v1";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaStamp?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

if (
  globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaStamp !== PRISMA_SCHEMA_STAMP
) {
  void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  globalForPrisma.prisma = undefined;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaSchemaStamp = PRISMA_SCHEMA_STAMP;
}
