import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { listPasskeysForOwner } from "@/lib/webauthn/credentials";

/** List passkeys for the signed-in staff user (self-manage). */
export async function GET() {
  const session = await requireStaffApi("account");
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const passkeys = await listPasskeysForOwner("USER", session.user.id);
  return NextResponse.json({
    passkeys: passkeys.map((p) => ({
      id: p.id,
      friendlyName: p.friendlyName,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      createdAt: p.createdAt.toISOString(),
      lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
    })),
  });
}
