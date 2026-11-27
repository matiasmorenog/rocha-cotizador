import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminAuthenticationOptions } from "@/lib/webauthn/admin-passkeys";

const schema = z.object({
  /** Optional remembered / typed admin email to narrow allowCredentials. */
  email: z.string().email().optional().nullable(),
});

/**
 * Public: issue authentication options for admin passkey login.
 * Customer passkeys are intentionally not wired in this PR.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const options = await createAdminAuthenticationOptions({
      email: parsed.data.email,
    });
    return NextResponse.json(options);
  } catch (err) {
    console.error("[passkeys] auth options failed", err);
    return NextResponse.json(
      { error: "No se pudieron preparar las opciones de passkey" },
      { status: 500 },
    );
  }
}
