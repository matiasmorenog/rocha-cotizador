import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import {
  buildQuotesExportFilename,
  buildQuotesExportPdf,
  pdfResponse,
} from "@/lib/quotes-export-pdf";
import { filterFoldedSearch } from "@/lib/search-fold";

export const runtime = "nodejs";
/** Multi-remito PDF over date range — Neon cold + pdfkit. */
export const maxDuration = 60;

function toNum(
  value: number | string | { toNumber?: () => number; toString: () => string },
): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return parseFloat(value.toString());
}

/**
 * GET /api/admin/quotes/export?from=&to=&q=&product=
 *
 * `q`: customer / remito search (same as Cotizaciones list).
 * `product`: keep only matching product lines inside each remito (and drop remitos
 * with no match). PDF header shows kg / units / $ for that product.
 */
export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("quotes"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const { from, to, fromLocal, toLocal } = resolveQuotesExportRange(
    sp.get("from"),
    sp.get("to"),
  );
  const q = (sp.get("q") ?? "").trim();
  const productQ = (sp.get("product") ?? "").trim();

  if (from.getTime() >= to.getTime()) {
    return NextResponse.json(
      { error: "El rango es inválido: 'from' debe ser anterior a 'to'" },
      { status: 400 },
    );
  }

  const quotesInRange = await db.quote.findMany({
    where: {
      createdAt: { gte: from, lt: to },
    },
    include: {
      customer: { select: { code: true, name: true } },
      items: { orderBy: { productCode: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  let quotes = filterFoldedSearch(quotesInRange, q, {
    primary: [(row) => row.number, (row) => row.customer.code],
    secondary: [(row) => row.customer.name],
    emptyReturnsAll: true,
  });

  if (productQ) {
    quotes = quotes
      .map((quote) => {
        const items = filterFoldedSearch(quote.items, productQ, {
          primary: [(item) => item.productCode],
          secondary: [(item) => item.productName],
          emptyReturnsAll: true,
        });
        if (items.length === 0) return null;
        const totalNum = items.reduce((acc, item) => {
          const n = toNum(item.lineTotal);
          return acc + (Number.isFinite(n) ? n : 0);
        }, 0);
        const total = new Decimal(totalNum).toDecimalPlaces(2);
        return {
          ...quote,
          items,
          total,
          subtotal: total,
        };
      })
      .filter((quote): quote is NonNullable<typeof quote> => quote != null);
  }

  const productIds = [
    ...new Set(
      quotes.flatMap((quote) =>
        quote.items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const products =
    productIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, allowsUnitOrder: true },
        })
      : [];
  const allowsUnitOrderByProductId = new Map(
    products.map((p) => [p.id, p.allowsUnitOrder]),
  );

  const quotesForPdf = quotes.map((quote) => ({
    ...quote,
    items: quote.items.map((item) => ({
      ...item,
      allowsUnitOrder: item.productId
        ? (allowsUnitOrderByProductId.get(item.productId) ?? false)
        : false,
    })),
  }));

  const customerCodes = new Set(quotes.map((quote) => quote.customer.code));
  const soleCustomer =
    !q && customerCodes.size === 1 && quotes[0]
      ? quotes[0].customer
      : null;

  const filename = buildQuotesExportFilename({
    fromLocal,
    toLocal,
    searchQuery: q || undefined,
    productQuery: productQ || undefined,
    soleCustomer,
    quoteCount: quotes.length,
  });

  const buffer = await buildQuotesExportPdf({
    quotes: quotesForPdf,
    from,
    to,
    searchQuery: q || undefined,
    productQuery: productQ || undefined,
  });
  return pdfResponse(buffer, filename, "inline");
}
