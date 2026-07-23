import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateAfterCustomerMutation } from "@/lib/cache-tags";
import { normalizePhone } from "@/lib/phone-contact";
import { padCustomerCode, pinFromCustomerCode } from "@/lib/utils";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const customers = await db.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { code: "asc" },
    take: q ? 30 : 200,
    select: {
      id: true,
      code: true,
      name: true,
      priceListId: true,
      priceList: { select: { id: true, name: true } },
      active: true,
      address: true,
      phone: true,
      email: true,
      notes: true,
      paymentTerms: true,
      deliveryHours: true,
    },
  });
  return NextResponse.json({ customers });
}

const upsertSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  priceListId: z.string().nullable().optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  deliveryHours: z.string().optional().nullable(),
  active: z.boolean().optional(),
  resetPin: z.boolean().optional(),
});

function emptyToNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const code = padCustomerCode(parsed.data.code);
  let pin: string | undefined;
  let passwordHash: string | undefined;

  if (!parsed.data.id || parsed.data.resetPin) {
    pin = pinFromCustomerCode(code);
    passwordHash = await bcrypt.hash(pin, 10);
  }

  const address = emptyToNull(parsed.data.address);
  const phoneRaw = emptyToNull(parsed.data.phone);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const email = emptyToNull(parsed.data.email);
  const notes = emptyToNull(parsed.data.notes);
  const paymentTerms = emptyToNull(parsed.data.paymentTerms);
  const deliveryHours = emptyToNull(parsed.data.deliveryHours);
  const priceListId =
    parsed.data.priceListId === undefined
      ? undefined
      : emptyToNull(parsed.data.priceListId);

  if (priceListId) {
    const list = await db.priceList.findUnique({ where: { id: priceListId } });
    if (!list) {
      return NextResponse.json(
        { error: "Lista de precios no encontrada" },
        { status: 400 },
      );
    }
  }

  if (parsed.data.id) {
    const customer = await db.customer.update({
      where: { id: parsed.data.id },
      data: {
        code,
        name: parsed.data.name,
        ...(priceListId !== undefined ? { priceListId } : {}),
        address,
        phone,
        email,
        notes,
        paymentTerms,
        deliveryHours,
        active: parsed.data.active ?? true,
        ...(passwordHash
          ? { passwordHash, mustChangePassword: true }
          : {}),
      },
    });
    invalidateAfterCustomerMutation();
    return NextResponse.json({ customer, pin: pin ?? null });
  }

  if (!passwordHash || !pin) {
    pin = pinFromCustomerCode(code);
    passwordHash = await bcrypt.hash(pin, 10);
  }

  const customer = await db.customer.create({
    data: {
      code,
      name: parsed.data.name,
      passwordHash,
      mustChangePassword: true,
      priceListId: priceListId ?? null,
      address,
      phone,
      email,
      notes,
      paymentTerms,
      deliveryHours,
      active: parsed.data.active ?? true,
    },
  });

  invalidateAfterCustomerMutation();
  return NextResponse.json({ customer, pin });
}
