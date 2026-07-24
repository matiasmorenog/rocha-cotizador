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
import { nextQuoteNumber } from "@/lib/quotes";
import { formatPrice } from "@/lib/utils";
import { buildQuoteWhatsAppMessage, whatsappUrl } from "@/lib/whatsapp";

const bodySchema = z.object({
  notes: z.string().optional(),
  customerId: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().positive(),
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
  } else if (session.user.role === "ADMIN") {
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

  const lines: Array<{
    productId: string;
    productCode: string;
    productName: string;
    qty: Decimal;
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
    const unitPrice = unitPriceForProduct(
      product.basePrice,
      listPrices?.get(product.id) ?? null,
    );
    const qty = new Decimal(item.qty);
    lines.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      qty,
      unitPrice,
      lineTotal: lineTotal(unitPrice, qty),
    });
  }

  const total = lines.reduce((acc, l) => acc.plus(l.lineTotal), new Decimal(0));
  const number = await nextQuoteNumber();

  const quote = await db.quote.create({
    data: {
      number,
      status: "SUBMITTED",
      customerId: customer.id,
      subtotal: total,
      total,
      notes: parsed.data.notes?.trim() || null,
      items: {
        create: lines.map((l) => ({
          productId: l.productId,
          productCode: l.productCode,
          productName: l.productName,
          qty: l.qty,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
      },
    },
    include: { items: true },
  });

  invalidateAfterQuoteCreate();

  const origin =
    req.nextUrl.origin ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    "";
  const remitoUrl = `${origin}/remitos/${quote.id}`;
  const notifyDigits = await getWhatsAppNotifyDigits();
  const message = buildQuoteWhatsAppMessage({
    quoteNumber: quote.number,
    customerCode: customer.code,
    customerName: customer.name,
    totalLabel: formatPrice(quote.total),
    notes: quote.notes,
    remitoUrl,
  });
  const notifyWhatsappUrl = whatsappUrl(notifyDigits, message);

  return NextResponse.json({
    id: quote.id,
    number: quote.number,
    whatsappUrl: notifyWhatsappUrl,
  });
}
