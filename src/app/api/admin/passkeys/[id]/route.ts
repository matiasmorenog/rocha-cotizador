import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { revokePasskeyForOwner } from "@/lib/webauthn/credentials";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Self-revoke one of the signed-in staff user's passkeys.
 *
 * FUTURE: customer remote revoke from admin → see
 * `revokeCustomerPasskeysByStaff` in `@/lib/webauthn/credentials`.
 */
export async function DELETE(_req: Request, context: RouteContext) {
  const session = await requireStaffApi("account");
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const ok = await revokePasskeyForOwner({
    passkeyId: id,
    ownerType: "USER",
    ownerId: session.user.id,
  });
  if (!ok) {
    return NextResponse.json(
      { error: "Passkey no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
