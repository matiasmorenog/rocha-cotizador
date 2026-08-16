import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-permissions";
import { db } from "@/lib/db";

const schema = z.object({
  newEmail: z
    .string()
    .trim()
    .min(1, "Ingresá un email")
    .email("Email inválido")
    .transform((v) => v.toLowerCase()),
  currentPassword: z.string().min(1, "Ingresá tu contraseña actual"),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isStaffRole(session.user.role) || !session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return NextResponse.json(
      { error: first ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, passwordHash: true, role: true },
  });
  if (!user?.passwordHash || !isStaffRole(user.role)) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (parsed.data.newEmail === user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "El email nuevo debe ser distinto al actual" },
      { status: 400 },
    );
  }

  const valid = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!valid) {
    return NextResponse.json(
      { error: "Contraseña actual incorrecta" },
      { status: 400 },
    );
  }

  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: { email: parsed.data.newEmail },
      select: { email: true },
    });
    return NextResponse.json({ email: updated.email });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ese email ya está en uso" },
        { status: 409 },
      );
    }
    throw err;
  }
}
