import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  passwordErrorMessage,
} from "@/lib/password";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CUSTOMER" || !session.user.customerId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = passwordErrorMessage(String(body?.newPassword ?? ""));
    return NextResponse.json(
      { error: msg ?? "Contraseña inválida" },
      { status: 400 },
    );
  }

  const customer = await db.customer.findUnique({
    where: { id: session.user.customerId },
  });
  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const valid = await bcrypt.compare(
    parsed.data.currentPassword,
    customer.passwordHash,
  );
  if (!valid) {
    return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      { error: "La contraseña nueva debe ser distinta a la actual" },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.customer.update({
    where: { id: customer.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  return NextResponse.json({ ok: true });
}
