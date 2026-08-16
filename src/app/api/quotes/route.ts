import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { auth } from "@/lib/auth";
import { getWhatsAppNotifyDigits } from "@/lib/business-settings";
import { db } from "@/lib/db";
import { invalidateAfterQuoteCreate } from "@/lib/cache-tags";
import { lineTotal, unitPriceForProduct } from "@/lib/pricing";
import {
  effectiveDiscountPriceListId,
  getPriceListUnitPricesByProductId,
} from "@/lib/price-list-resolve";
import { notifyAdminsNewQuote } from "@/lib/push";
import {
  earliestDeliveryDateYmd,
  parseDateOnlyYmd,
  validateDeliveryDateYmd,
} from "@/lib/delivery-date";
import { nextQuoteNumber } from "@/lib/quotes";
import { staffHasPermission } from "@/lib/staff-permissions";
import { formatPrice } from "@/lib/utils";
import { buildQuoteWhatsAppMessage, whatsappUrl } from "@/lib/whatsapp";

const bodySchema = z.object({
  notes: z.string().optional(),
  /** `YYYY-MM-DD` requested delivery / fulfillment date (Argentina calendar). */
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  customerId: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().positive(),
        orderByUnit: z.boolean().optional().default(false),
      }),
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  let customerId: string;

  if (session.user.role === "CUSTOMER") {
    if (!session.user.customerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    customerId = session.user.customerId;
  } else if (staffHasPermission(session.user.role, "quotes")) {
    if (!parsed.data.customerId) {
      return NextResponse.json({ error: "customerId requerido" }, { status: 400 });
    }
    customerId = parsed.data.customerId;
  } else {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const customer = await db.customer.findUnique({
    where: { id: customerId },
  });
  if (!customer || !customer.active) {
    return NextResponse.json({ error: "Cliente inactivo" }, { status: 403 });
  }

  const productIds = parsed.data.items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds }, active: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const discountListId = await effectiveDiscountPriceListId(
    customer.priceListId,
  );
  const listPrices = discountListId
    ? await getPriceListUnitPricesByProductId(discountListId)
    : null;

  // Same SKU may appear twice only with different measure (kg vs units).
  const seenMeasureKeys = new Set<string>();
  for (const item of parsed.data.items) {
    const orderByUnit = item.orderByUnit === true;
    const key = `${item.productId}:${orderByUnit ? "u" : "k"}`;
    if (seenMeasureKeys.has(key)) {
      return NextResponse.json(
        {
          error:
            "Líneas duplicadas: el mismo producto y medida no pueden repetirse",
        },
        { status: 400 },
      );
    }
    seenMeasureKeys.add(key);
  }

  const lines: Array<{
    productId: string;
    productCode: string;
    productName: string;
    qty: Decimal;
    orderByUnit: boolean;
    unitPrice: Decimal;
    lineTotal: Decimal;
  }> = [];

  for (const item of parsed.data.items) {
    const product = byId.get(item.productId);
    if (!product) {
      return NextResponse.json(
        { error: `Producto no encontrado: ${item.productId}` },
        { status: 400 },
      );
    }

    const orderByUnit = item.orderByUnit === true;
    if (orderByUnit && !product.allowsUnitOrder) {
      return NextResponse.json(
        {
          error: `El producto ${product.code} no admite pedido por unidades`,
        },
        { status: 400 },
      );
    }

    const qty = new Decimal(item.qty);
    if (orderByUnit) {
      const zero = new Decimal(0).toDecimalPlaces(2);
      lines.push({
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        qty,
        orderByUnit: true,
        unitPrice: zero,
        lineTotal: zero,
      });
      continue;
    }

    const unitPrice = unitPriceForProduct(
      product.basePrice,
      listPrices?.get(product.id) ?? null,
    );
    lines.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      qty,
      orderByUnit: false,
      unitPrice,
      lineTotal: lineTotal(unitPrice, qty),
    });
  }

  const total = lines.reduce((acc, l) => acc.plus(l.lineTotal), new Decimal(0));
  const number = await nextQuoteNumber();

  let deliveryDate: Date;
  if (parsed.data.deliveryDate) {
    const validated = validateDeliveryDateYmd(parsed.data.deliveryDate);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    deliveryDate = validated.date;
  } else {
    deliveryDate = parseDateOnlyYmd(earliestDeliveryDateYmd())!;
  }

  const quote = await db.quote.create({
    data: {
      number,
      status: "SUBMITTED",
      customerId: customer.id,
      subtotal: total,
      total,
      notes: parsed.data.notes?.trim() || null,
      deliveryDate,
      items: {
        create: lines.map((l) => ({
          productId: l.productId,
          productCode: l.productCode,
          productName: l.productName,
          qty: l.qty,
          orderByUnit: l.orderByUnit,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
      },
    },
    include: { items: true },
  });

  invalidateAfterQuoteCreate();

  // Customer-created quotes only — admin self-create must not notify.
  // Await (never throws) so local turbopack / Next after() cannot drop the FCM send.
  if (session.user.role === "CUSTOMER") {
    await notifyAdminsNewQuote({
      id: quote.id,
      number: quote.number,
      customerName: customer.name,
    });
  }

  const origin =
    req.nextUrl.origin ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    "";
  const remitoUrl = `${origin}/remitos/${quote.number}`;
  const notifyDigits = await getWhatsAppNotifyDigits();
  const message = buildQuoteWhatsAppMessage({
    quoteNumber: quote.number,
    customerCode: customer.code,
    customerName: customer.name,
    totalLabel: formatPrice(quote.total),
    notes: quote.notes,
    deliveryDate: quote.deliveryDate,
    remitoUrl,
  });
  const notifyWhatsappUrl = whatsappUrl(notifyDigits, message);

  return NextResponse.json({
    id: quote.id,
    number: quote.number,
    whatsappUrl: notifyWhatsappUrl,
  });
}
