import { randomBytes } from "crypto";
import type { PasskeyOwnerType } from "@prisma/client";
import { db } from "@/lib/db";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TICKET_TTL_MS = 2 * 60 * 1000;

export type ChallengeType =
  | "REGISTRATION"
  | "AUTHENTICATION"
  | "SESSION_TICKET";

/** Drop expired rows opportunistically (MVP — no cron). */
export async function purgeExpiredPasskeyChallenges(): Promise<void> {
  await db.passkeyChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export async function storeChallenge(opts: {
  type: ChallengeType;
  challenge: string;
  ownerType?: PasskeyOwnerType;
  ownerId?: string;
  ttlMs?: number;
}): Promise<string> {
  await purgeExpiredPasskeyChallenges();
  const row = await db.passkeyChallenge.create({
    data: {
      type: opts.type,
      challenge: opts.challenge,
      ownerType: opts.ownerType,
      ownerId: opts.ownerId,
      expiresAt: new Date(Date.now() + (opts.ttlMs ?? CHALLENGE_TTL_MS)),
    },
  });
  return row.id;
}

export async function consumeChallenge(opts: {
  type: ChallengeType;
  challenge: string;
  ownerType?: PasskeyOwnerType;
  ownerId?: string;
}): Promise<{ id: string; ownerType: PasskeyOwnerType | null; ownerId: string | null } | null> {
  const row = await db.passkeyChallenge.findFirst({
    where: {
      type: opts.type,
      challenge: opts.challenge,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(opts.ownerType ? { ownerType: opts.ownerType } : {}),
      ...(opts.ownerId ? { ownerId: opts.ownerId } : {}),
    },
  });
  if (!row) return null;

  const updated = await db.passkeyChallenge.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (updated.count !== 1) return null;

  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
  };
}

/** One-time ticket after successful assertion — Credentials provider consumes it. */
export async function issueSessionTicket(userId: string): Promise<string> {
  const ticket = randomBytes(32).toString("base64url");
  await db.passkeyChallenge.create({
    data: {
      type: "SESSION_TICKET",
      challenge: ticket,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TICKET_TTL_MS),
    },
  });
  return ticket;
}

export async function consumeSessionTicket(
  ticket: string,
): Promise<string | null> {
  const row = await db.passkeyChallenge.findFirst({
    where: {
      type: "SESSION_TICKET",
      challenge: ticket,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      userId: { not: null },
    },
  });
  if (!row?.userId) return null;

  const updated = await db.passkeyChallenge.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (updated.count !== 1) return null;

  return row.userId;
}
