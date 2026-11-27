import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import {
  assertPasskeyRegistrationAllowed,
  createAdminRegistrationOptions,
} from "@/lib/webauthn/admin-passkeys";

export async function POST() {
  const session = await requireStaffApi("account");
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const gate = assertPasskeyRegistrationAllowed({
    mustChangePassword: session.user.mustChangePassword,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }

  try {
    const options = await createAdminRegistrationOptions({
      userId: session.user.id,
      email: session.user.email,
      displayName: session.user.name,
    });
    return NextResponse.json(options);
  } catch (err) {
    console.error("[passkeys] register options failed", err);
    return NextResponse.json(
      { error: "No se pudieron preparar las opciones de passkey" },
      { status: 500 },
    );
  }
}
