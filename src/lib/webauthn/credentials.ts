import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import type { PasskeyOwnerType, PasskeyCredential } from "@prisma/client";
import { db } from "@/lib/db";

export function parseTransports(
  raw: string | null | undefined,
): AuthenticatorTransportFuture[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean) as AuthenticatorTransportFuture[];
}

export function serializeTransports(
  transports: string[] | undefined,
): string | null {
  if (!transports?.length) return null;
  return transports.join(",");
}

export async function listPasskeysForOwner(
  ownerType: PasskeyOwnerType,
  ownerId: string,
): Promise<
  Pick<
    PasskeyCredential,
    | "id"
    | "friendlyName"
    | "deviceType"
    | "backedUp"
    | "createdAt"
    | "lastUsedAt"
  >[]
> {
  return db.passkeyCredential.findMany({
    where: { ownerType, ownerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      friendlyName: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
}

export async function findCredentialByCredentialId(credentialId: string) {
  return db.passkeyCredential.findUnique({
    where: { credentialId },
  });
}

/**
 * Soft hook for a future admin “revoke customer devices” UI.
 * Today only USER (staff) self-revoke is wired; call this when adding
 * CUSTOMER remote revoke from `/admin/clientes`.
 */
export async function revokePasskeyForOwner(opts: {
  passkeyId: string;
  ownerType: PasskeyOwnerType;
  ownerId: string;
}): Promise<boolean> {
  const result = await db.passkeyCredential.deleteMany({
    where: {
      id: opts.passkeyId,
      ownerType: opts.ownerType,
      ownerId: opts.ownerId,
    },
  });
  return result.count === 1;
}

/**
 * FUTURE: staff remote-revoke of customer passkeys (stolen phone).
 * Keep this name stable so admin customer detail can call it without
 * inventing a second delete path.
 *
 * Wire from `/admin/clientes` once CUSTOMER passkeys ship:
 * `await revokeCustomerPasskeysByStaff({ customerId, passkeyId })`
 */
export async function revokeCustomerPasskeysByStaff(opts: {
  customerId: string;
  passkeyId?: string;
}): Promise<never> {
  void opts;
  throw new Error(
    "Customer passkey remote revoke is not implemented yet (admin-only MVP).",
  );
}
