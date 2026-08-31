import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateAfterCustomerMutation } from "@/lib/cache-tags";
import { normalizePhone } from "@/lib/phone-contact";
import { getBasePriceList } from "@/lib/price-list-resolve";
import {
  DEFAULT_CUSTOMER_MODULE_FLAGS,
  syncCustomerModuleFlags,
  type CustomerModuleFlags,
} from "@/lib/customer-modules";
import { padCustomerCode, pinFromCustomerCode } from "@/lib/utils";
import { emptyToNullNameNote } from "@/lib/customer-name-note";

const moduleFlagsSchema = z.object({
  DESPERDICIOS: z.boolean(),
  CONSUMABLES: z.boolean(),
  ACTIVOS: z.boolean(),
});

export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("customers"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const customers = await db.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { nameNote: { contains: q, mode: "insensitive" } },
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
      nameNote: true,
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
  nameNote: z.string().optional().nullable(),
  priceListId: z.string().nullable().optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  deliveryHours: z.string().optional().nullable(),
  active: z.boolean().optional(),
  modules: moduleFlagsSchema.optional(),
  resetPin: z.boolean().optional(),
});

function emptyToNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

export async function POST(req: NextRequest) {
  if (!(await requireStaffApi("customers"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const detail = firstIssue?.message ?? "Revisá los campos del formulario.";
    return NextResponse.json(
      { error: `Datos inválidos: ${detail}` },
      { status: 400 },
    );
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
  const nameNote = emptyToNullNameNote(parsed.data.nameNote);
  const paymentTerms = emptyToNull(parsed.data.paymentTerms);
  const deliveryHours = emptyToNull(parsed.data.deliveryHours);
  const priceListIdRaw =
    parsed.data.priceListId === undefined
      ? undefined
      : emptyToNull(parsed.data.priceListId);

  let priceListId = priceListIdRaw;
  if (priceListIdRaw === null) {
    const base = await getBasePriceList();
    priceListId = base?.id ?? null;
  }

  if (priceListId) {
    const list = await db.priceList.findUnique({ where: { id: priceListId } });
    if (!list) {
      return NextResponse.json(
        { error: "Lista de precios no encontrada" },
        { status: 400 },
      );
    }
  }

  try {
    if (parsed.data.id) {
      const customer = await db.customer.update({
        where: { id: parsed.data.id },
        data: {
          code,
          name: parsed.data.name,
          nameNote,
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
      const moduleFlags: CustomerModuleFlags =
        parsed.data.modules ?? DEFAULT_CUSTOMER_MODULE_FLAGS;
      await syncCustomerModuleFlags(customer.id, moduleFlags);
      invalidateAfterCustomerMutation();
      return NextResponse.json({ customer, pin: pin ?? null });
    }

    if (!passwordHash || !pin) {
      pin = pinFromCustomerCode(code);
      passwordHash = await bcrypt.hash(pin, 10);
    }

    if (priceListId === undefined) {
      const base = await getBasePriceList();
      priceListId = base?.id ?? null;
    }

    const customer = await db.customer.create({
      data: {
        code,
        name: parsed.data.name,
        nameNote,
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

    const moduleFlags: CustomerModuleFlags =
      parsed.data.modules ?? DEFAULT_CUSTOMER_MODULE_FLAGS;
    await syncCustomerModuleFlags(customer.id, moduleFlags);

    invalidateAfterCustomerMutation();
    return NextResponse.json({ customer, pin });
  } catch (err) {
    console.error("[admin/customers] POST failed", err);
    const detail =
      err instanceof Error ? err.message : "Error inesperado al guardar.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
