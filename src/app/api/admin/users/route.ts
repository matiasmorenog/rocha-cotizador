import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateAfterStaffUserMutation } from "@/lib/cache-tags";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordErrorMessage,
} from "@/lib/password";
import {
  STAFF_ROLES,
  staffFieldsFromSwitches,
} from "@/lib/staff-permissions";

const upsertSchema = z
  .object({
    id: z.string().min(1).optional(),
    email: z.string().email(),
    name: z.string().trim().min(1).max(120).nullable().optional(),
    isAdmin: z.boolean(),
    canQuotes: z.boolean(),
    canStock: z.boolean(),
    active: z.boolean().optional().default(true),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH)
      .max(MAX_PASSWORD_LENGTH)
      .optional(),
  })
  .refine((data) => data.isAdmin || data.canQuotes || data.canStock, {
    message: "Elegí al menos un permiso (Cotización o Stock)",
  });

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  canQuotes: true,
  canStock: true,
  active: true,
} as const;

export async function GET() {
  if (!(await requireStaffApi("users"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const users = await db.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    orderBy: [{ active: "desc" }, { email: "asc" }],
    select: {
      ...userSelect,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await requireStaffApi("users");
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    const pwd = body && typeof body.password === "string" ? body.password : "";
    const pwdErr = pwd ? passwordErrorMessage(pwd) : null;
    const refineErr = parsed.error.issues.find((i) => i.path.length === 0);
    return NextResponse.json(
      { error: pwdErr ?? refineErr?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name?.trim() || null;
  const staffFields = staffFieldsFromSwitches({
    isAdmin: parsed.data.isAdmin,
    canQuotes: parsed.data.canQuotes,
    canStock: parsed.data.canStock,
  });

  if (parsed.data.id) {
    const existing = await db.user.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, role: true },
    });
    if (!existing || !STAFF_ROLES.includes(existing.role as (typeof STAFF_ROLES)[number])) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (
      parsed.data.id === session.user.id &&
      parsed.data.active === false
    ) {
      return NextResponse.json(
        { error: "No podés desactivar tu propia cuenta" },
        { status: 400 },
      );
    }

    const emailTaken = await db.user.findFirst({
      where: { email, NOT: { id: parsed.data.id } },
      select: { id: true },
    });
    if (emailTaken) {
      return NextResponse.json({ error: "Email ya en uso" }, { status: 409 });
    }

    const data: {
      email: string;
      name: string | null;
      role: "ADMIN" | "QUOTES" | "STOCK";
      canQuotes: boolean;
      canStock: boolean;
      active: boolean;
      passwordHash?: string;
    } = {
      email,
      name,
      role: staffFields.role,
      canQuotes: staffFields.canQuotes,
      canStock: staffFields.canStock,
      active: parsed.data.active,
    };
    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }

    const user = await db.user.update({
      where: { id: parsed.data.id },
      data,
      select: userSelect,
    });
    invalidateAfterStaffUserMutation();
    return NextResponse.json({ user });
  }

  if (!parsed.data.password) {
    return NextResponse.json(
      { error: "Contraseña requerida para usuario nuevo" },
      { status: 400 },
    );
  }

  const emailTaken = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (emailTaken) {
    return NextResponse.json({ error: "Email ya en uso" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await db.user.create({
    data: {
      email,
      name,
      role: staffFields.role,
      canQuotes: staffFields.canQuotes,
      canStock: staffFields.canStock,
      active: parsed.data.active,
      passwordHash,
    },
    select: userSelect,
  });

  invalidateAfterStaffUserMutation();
  return NextResponse.json({ user }, { status: 201 });
}
