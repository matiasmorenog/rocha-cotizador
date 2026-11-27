import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import {
  assertPasskeyRegistrationAllowed,
  verifyAdminRegistration,
} from "@/lib/webauthn/admin-passkeys";

const schema = z.object({
  response: z.record(z.string(), z.unknown()),
  friendlyName: z.string().max(80).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await requireStaffApi("account");
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const gate = assertPasskeyRegistrationAllowed({
    mustChangePassword: session.user.mustChangePassword,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = await verifyAdminRegistration({
    userId: session.user.id,
    // RegistrationResponseJSON — validated further by SimpleWebAuthn
    response: parsed.data.response as never,
    friendlyName: parsed.data.friendlyName,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    passkey: {
      ...result.passkey,
      createdAt: result.passkey.createdAt.toISOString(),
      lastUsedAt: result.passkey.lastUsedAt?.toISOString() ?? null,
    },
  });
}
