import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminAuthentication } from "@/lib/webauthn/admin-passkeys";

const schema = z.object({
  response: z.record(z.string(), z.unknown()),
});

/**
 * Public: verify admin passkey assertion and return a one-time session ticket
 * for `signIn("passkey", { ticket })`.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = await verifyAdminAuthentication({
    response: parsed.data.response as never,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({ ok: true, ticket: result.ticket });
}
