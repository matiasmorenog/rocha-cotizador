import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import {
  getWebAuthnExpectedOrigins,
  getWebAuthnRpId,
  getWebAuthnRpName,
} from "@/lib/webauthn/config";
import {
  consumeChallenge,
  issueSessionTicket,
  storeChallenge,
} from "@/lib/webauthn/challenges";
import {
  findCredentialByCredentialId,
  parseTransports,
  serializeTransports,
} from "@/lib/webauthn/credentials";

const OWNER_TYPE = "USER" as const;

/** Block register while seed PIN / mustChangePassword still required. */
export function assertPasskeyRegistrationAllowed(opts: {
  mustChangePassword?: boolean | null;
}): { ok: true } | { ok: false; error: string } {
  if (opts.mustChangePassword) {
    return {
      ok: false,
      error:
        "Cambiá tu contraseña (PIN inicial) antes de agregar un acceso biométrico.",
    };
  }
  return { ok: true };
}

function userIdToBytes(userId: string): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(userId);
  return new Uint8Array(bytes);
}

/** Decode `challenge` from base64url clientDataJSON. */
function challengeFromClientDataJSON(clientDataJSON: string): string | null {
  try {
    const json = Buffer.from(clientDataJSON, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { challenge?: unknown };
    return typeof parsed.challenge === "string" ? parsed.challenge : null;
  } catch {
    return null;
  }
}

export async function createAdminRegistrationOptions(opts: {
  userId: string;
  email: string;
  displayName?: string | null;
}) {
  const existing = await db.passkeyCredential.findMany({
    where: { ownerType: OWNER_TYPE, ownerId: opts.userId },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: getWebAuthnRpName(),
    rpID: getWebAuthnRpId(),
    userID: userIdToBytes(opts.userId),
    userName: opts.email,
    userDisplayName: opts.displayName?.trim() || opts.email,
    attestationType: "none",
    // Platform only — fingerprint / Face ID / device PIN (no USB keys).
    preferredAuthenticatorType: "localDevice",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      requireResidentKey: false,
      userVerification: "required",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
  });

  await storeChallenge({
    type: "REGISTRATION",
    challenge: options.challenge,
    ownerType: OWNER_TYPE,
    ownerId: opts.userId,
  });

  return options;
}

export async function verifyAdminRegistration(opts: {
  userId: string;
  response: RegistrationResponseJSON;
  friendlyName?: string | null;
}) {
  const challenge = challengeFromClientDataJSON(
    opts.response.response.clientDataJSON,
  );
  if (!challenge) {
    return { ok: false as const, error: "Respuesta de passkey inválida." };
  }

  const consumed = await consumeChallenge({
    type: "REGISTRATION",
    challenge,
    ownerType: OWNER_TYPE,
    ownerId: opts.userId,
  });
  if (!consumed) {
    return { ok: false as const, error: "Desafío expirado. Probá de nuevo." };
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: opts.response,
      expectedChallenge: challenge,
      expectedOrigin: getWebAuthnExpectedOrigins(),
      expectedRPID: getWebAuthnRpId(),
      requireUserVerification: true,
    });
  } catch (err) {
    console.error("[webauthn] admin registration verify failed", err);
    return { ok: false as const, error: "No se pudo verificar el passkey." };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false as const, error: "Registro de passkey rechazado." };
  }

  const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
    verification.registrationInfo;

  const transports = serializeTransports(
    opts.response.response.transports as string[] | undefined,
  );

  const created = await db.passkeyCredential.create({
    data: {
      ownerType: OWNER_TYPE,
      ownerId: opts.userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports,
      friendlyName: opts.friendlyName?.trim() || null,
      aaguid: aaguid || null,
    },
    select: {
      id: true,
      friendlyName: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return { ok: true as const, passkey: created };
}

export async function createAdminAuthenticationOptions(opts?: {
  /** Optional: narrow allowCredentials after email typed / remembered. */
  email?: string | null;
}) {
  let allowCredentials:
    | { id: string; transports?: AuthenticatorTransportFuture[] }[]
    | undefined;

  const email = opts?.email?.trim().toLowerCase();
  if (email) {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, active: true },
    });
    if (user?.active) {
      const creds = await db.passkeyCredential.findMany({
        where: { ownerType: OWNER_TYPE, ownerId: user.id },
        select: { credentialId: true, transports: true },
      });
      if (creds.length > 0) {
        allowCredentials = creds.map((c) => ({
          id: c.credentialId,
          transports: parseTransports(c.transports),
        }));
      }
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: getWebAuthnRpId(),
    userVerification: "required",
    // Empty allowCredentials → discoverable / resident credentials for this RP.
    allowCredentials,
  });

  await storeChallenge({
    type: "AUTHENTICATION",
    challenge: options.challenge,
  });

  return options;
}

export async function verifyAdminAuthentication(opts: {
  response: AuthenticationResponseJSON;
}) {
  const credentialId = opts.response.id;
  const stored = await findCredentialByCredentialId(credentialId);
  if (!stored || stored.ownerType !== OWNER_TYPE) {
    return { ok: false as const, error: "Passkey no reconocido." };
  }

  const challenge = challengeFromClientDataJSON(
    opts.response.response.clientDataJSON,
  );
  if (!challenge) {
    return { ok: false as const, error: "Respuesta de passkey inválida." };
  }

  const consumed = await consumeChallenge({
    type: "AUTHENTICATION",
    challenge,
  });
  if (!consumed) {
    return { ok: false as const, error: "Desafío expirado. Probá de nuevo." };
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: opts.response,
      expectedChallenge: challenge,
      expectedOrigin: getWebAuthnExpectedOrigins(),
      expectedRPID: getWebAuthnRpId(),
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(stored.publicKey),
        counter: Number(stored.counter),
        transports: parseTransports(stored.transports),
      },
    });
  } catch (err) {
    console.error("[webauthn] admin authentication verify failed", err);
    return { ok: false as const, error: "No se pudo verificar el passkey." };
  }

  if (!verification.verified) {
    return { ok: false as const, error: "Autenticación rechazada." };
  }

  await db.passkeyCredential.update({
    where: { id: stored.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
      backedUp: verification.authenticationInfo.credentialBackedUp,
      deviceType: verification.authenticationInfo.credentialDeviceType,
    },
  });

  const user = await db.user.findUnique({
    where: { id: stored.ownerId },
    select: { id: true, active: true },
  });
  if (!user?.active) {
    return { ok: false as const, error: "Usuario inactivo." };
  }

  const ticket = await issueSessionTicket(user.id);
  return { ok: true as const, ticket };
}
