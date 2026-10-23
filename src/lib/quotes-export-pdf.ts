import PDFDocument from "pdfkit";
import { formatArgentinaDateTime } from "@/lib/argentina-time";
import { formatDeliveryDateLabel } from "@/lib/delivery-date";
import { UNIT_ORDER_PRICE_WARNING } from "@/lib/unit-order-products";
import { quoteLineMeasureLabel } from "@/lib/order-measure";
import { formatPrice, formatQty } from "@/lib/utils";

export type QuoteForPdf = {
  number: string;
  createdAt: Date;
  deliveryDate?: Date | null;
  total: number | string | { toNumber?: () => number; toString: () => string };
  customer: { code: string; name: string };
  items: Array<{
    productCode: string;
    productName: string;
    qty: number | string | { toNumber?: () => number; toString: () => string };
    orderByUnit?: boolean;
    allowsUnitOrder?: boolean;
    unitPrice: number | string | { toNumber?: () => number; toString: () => string };
    lineTotal: number | string | { toNumber?: () => number; toString: () => string };
  }>;
};

type BuildQuotesPdfInput = {
  quotes: QuoteForPdf[];
  from: Date;
  to: Date;
  /** Same search as Cotizaciones list (number / customer code / name). */
  searchQuery?: string;
  /** When set, remitos were trimmed to matching product lines only. */
  productQuery?: string;
};

function toNum(
  value: number | string | { toNumber?: () => number; toString: () => string },
): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return parseFloat(value.toString());
}

function productLinesSummary(quotes: QuoteForPdf[]): {
  qtyKg: number;
  qtyUnits: number;
  amount: number;
} {
  let qtyKg = 0;
  let qtyUnits = 0;
  let amount = 0;
  for (const quote of quotes) {
    for (const item of quote.items) {
      const qty = toNum(item.qty);
      const line = toNum(item.lineTotal);
      if (Number.isFinite(line)) amount += line;
      if (!Number.isFinite(qty)) continue;
      const orderByUnit = item.orderByUnit === true;
      const allowsUnitOrder = item.allowsUnitOrder === true;
      if (allowsUnitOrder && !orderByUnit) qtyKg += qty;
      else qtyUnits += qty;
    }
  }
  return { qtyKg, qtyUnits, amount };
}

const MARGIN = 44;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const META_LINE_GAP = 4;
const ROW_GAP = 7;
const BLOCK_GAP_AFTER = 18;

const COL = {
  code: 54,
  qty: 48,
  name: CONTENT_WIDTH - 54 - 48 - 74 - 80,
  price: 74,
  amount: 80,
} as const;

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - MARGIN;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function drawTableHeader(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  const headerPadY = 5;
  const headerH = 18;

  doc
    .save()
    .rect(MARGIN, y, CONTENT_WIDTH, headerH)
    .fill("#f5f5f5");
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#525252")
    .text("Cód.", MARGIN + 2, y + headerPadY, { width: COL.code - 2 })
    .text("Cant.", MARGIN + COL.code, y + headerPadY, { width: COL.qty })
    .text("Artículo", MARGIN + COL.code + COL.qty, y + headerPadY, {
      width: COL.name,
    })
    .text("Precio", MARGIN + COL.code + COL.qty + COL.name, y + headerPadY, {
      width: COL.price,
      align: "right",
    })
    .text(
      "Importe",
      MARGIN + COL.code + COL.qty + COL.name + COL.price,
      y + headerPadY,
      { width: COL.amount, align: "right" },
    );

  doc
    .moveTo(MARGIN, y + headerH)
    .lineTo(MARGIN + CONTENT_WIDTH, y + headerH)
    .strokeColor("#d4d4d4")
    .lineWidth(0.5)
    .stroke();
  doc.y = y + headerH + 8;
  doc.fillColor("#171717");
}

function drawQuoteBlock(doc: PDFKit.PDFDocument, quote: QuoteForPdf) {
  ensureSpace(doc, 72);

  const headY = doc.y;
  doc
    .save()
    .rect(MARGIN, headY, CONTENT_WIDTH, 22)
    .fill("#fafafa");
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#171717")
    .text(`Remito ${quote.number}`, MARGIN + 2, headY + 5, {
      width: CONTENT_WIDTH - 4,
      continued: false,
    });
  doc.y = headY + 26;

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#525252")
    .text(formatArgentinaDateTime(quote.createdAt), MARGIN, doc.y + META_LINE_GAP);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#171717")
    .text(
      `Entrega: ${formatDeliveryDateLabel(quote.deliveryDate)}`,
      MARGIN,
      doc.y + META_LINE_GAP,
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#171717")
    .text(
      `${quote.customer.code} — ${quote.customer.name}`,
      MARGIN,
      doc.y + META_LINE_GAP + 1,
    );

  doc.y = doc.y + 10;
  drawTableHeader(doc);

  if (quote.items.length === 0) {
    ensureSpace(doc, 22);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#737373")
      .text("Sin ítems", MARGIN, doc.y);
    doc.moveDown(0.7);
  } else {
    for (const item of quote.items) {
      ensureSpace(doc, 40);
      const y = doc.y;
      const unitLabel = quoteLineMeasureLabel(
        item.orderByUnit === true,
        item.allowsUnitOrder === true,
      );
      const nameText = item.orderByUnit
        ? `${item.productName}\n(${UNIT_ORDER_PRICE_WARNING})`
        : item.productName;
      doc.font("Helvetica").fontSize(8);
      const nameHeight = doc.heightOfString(nameText, {
        width: COL.name,
      });
      const rowHeight = Math.max(14, nameHeight);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#171717")
        .text(item.productCode, MARGIN + 2, y, { width: COL.code - 2 })
        .text(`${formatQty(item.qty)} ${unitLabel}`, MARGIN + COL.code, y, {
          width: COL.qty,
        })
        .text(nameText, MARGIN + COL.code + COL.qty, y, {
          width: COL.name,
        })
        .text(
          formatPrice(item.unitPrice),
          MARGIN + COL.code + COL.qty + COL.name,
          y,
          { width: COL.price, align: "right" },
        )
        .text(
          formatPrice(item.lineTotal),
          MARGIN + COL.code + COL.qty + COL.name + COL.price,
          y,
          { width: COL.amount, align: "right" },
        );

      doc.y = y + rowHeight + ROW_GAP;
    }
  }

  ensureSpace(doc, 28);
  doc
    .moveTo(MARGIN, doc.y + 2)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 2)
    .strokeColor("#e5e5e5")
    .lineWidth(0.5)
    .stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#171717")
    .text(`Total: ${formatPrice(quote.total)}`, MARGIN, doc.y + 8, {
      width: CONTENT_WIDTH,
      align: "right",
    });

  doc.y = doc.y + BLOCK_GAP_AFTER;
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
    .strokeColor("#a3a3a3")
    .lineWidth(0.75)
    .stroke();
  doc.y = doc.y + BLOCK_GAP_AFTER;
}

/**
 * Multi-remito PDF for wholesale ops: cover header + one block per quote.
 */
export function buildQuotesExportPdf(input: BuildQuotesPdfInput): Promise<Buffer> {
  const { quotes, from, to, searchQuery, productQuery } = input;
  const sumTotals = quotes.reduce((acc, q) => {
    const n = toNum(q.total);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const productSummary = productQuery
    ? productLinesSummary(quotes)
    : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      info: {
        Title: productQuery
          ? `Producto ${productQuery} — Rocha Cotizador`
          : "Cotizaciones — Rocha Cotizador",
        Author: "Rocha Cotizador",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Cover / header
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#171717")
      .text("Rocha Cotizador", MARGIN, MARGIN);

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(
        productQuery
          ? "Exportación por producto"
          : "Exportación de cotizaciones",
        MARGIN,
        doc.y + 10,
      );

    let metaY = doc.y + 14;
    const writeMeta = (
      line: string,
      opts?: { bold?: boolean; color?: string },
    ) => {
      doc
        .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .fillColor(opts?.color ?? "#525252")
        .text(line, MARGIN, metaY, { width: CONTENT_WIDTH });
      metaY = doc.y + META_LINE_GAP + 2;
    };

    writeMeta(`Desde: ${formatArgentinaDateTime(from)}`);
    writeMeta(`Hasta (excl.): ${formatArgentinaDateTime(to)}`);
    if (searchQuery) {
      writeMeta(`Cliente / búsqueda: ${searchQuery}`);
    }
    if (productQuery) {
      writeMeta(`Producto: ${productQuery}`, {
        bold: true,
        color: "#171717",
      });
      if (productSummary) {
        const kgLabel =
          productSummary.qtyKg > 0
            ? `${formatQty(productSummary.qtyKg)} kg`
            : "— kg";
        const unitsLabel =
          productSummary.qtyUnits > 0
            ? `${formatQty(productSummary.qtyUnits)} unid.`
            : "— unid.";
        writeMeta(
          `Consumo filtrado: ${kgLabel} · ${unitsLabel} · ${formatPrice(productSummary.amount)}`,
          { bold: true, color: "#171717" },
        );
      }
      writeMeta(
        "Cada remito muestra solo las líneas de ese producto (total del bloque = esas líneas).",
      );
    }
    writeMeta(`Remitos: ${quotes.length}`);
    writeMeta(
      productQuery
        ? `Suma líneas producto: ${formatPrice(sumTotals)}`
        : `Suma totales: ${formatPrice(sumTotals)}`,
      { bold: true, color: "#171717" },
    );

    doc.y = metaY + 6;
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor("#a3a3a3")
      .lineWidth(1)
      .stroke();
    doc.y = doc.y + 16;

    if (quotes.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#737373")
        .text(
          productQuery || searchQuery
            ? "No hay remitos en este rango para ese filtro."
            : "No hay cotizaciones en este rango.",
          MARGIN,
          doc.y,
        );
    } else {
      for (const quote of quotes) {
        drawQuoteBlock(doc, quote);
      }
    }

    doc.end();
  });
}

/**
 * ASCII-safe Content-Disposition + UTF-8 filename*.
 * `inline` = open in browser tab (user can still Save As with the suggested name).
 */
export function pdfResponse(
  buffer: Buffer,
  filename: string,
  disposition: "inline" | "attachment" = "inline",
): Response {
  const safe = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(filename);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  });
}

/** `2026-09-01` or `2026-09-01T12:00` → `01-09-2026` for download names. */
export function ymdSlugForFilename(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(local.trim());
  if (!m) return local.slice(0, 10).replace(/[^\d-]/g, "");
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Filename segment: letters/digits/dash only. */
export function filenameSlug(raw: string, max = 40): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

export function buildQuotesExportFilename(input: {
  fromLocal: string;
  toLocal: string;
  searchQuery?: string;
  productQuery?: string;
  /** When search empty but all remitos are one customer. */
  soleCustomer?: { code: string; name: string } | null;
  quoteCount: number;
}): string {
  const parts = [
    "Cotizaciones",
    ymdSlugForFilename(input.fromLocal),
    "a",
    ymdSlugForFilename(input.toLocal),
  ];
  const clientRaw =
    input.searchQuery?.trim() ||
    (input.soleCustomer
      ? `${input.soleCustomer.code} ${input.soleCustomer.name}`
      : "");
  const client = clientRaw ? filenameSlug(clientRaw) : "";
  if (client) parts.push(client);
  const product = input.productQuery?.trim()
    ? filenameSlug(input.productQuery.trim())
    : "";
  if (product) parts.push(`prod-${product}`);
  if (input.quoteCount > 0) parts.push(`${input.quoteCount}remitos`);
  return `${parts.join("_")}.pdf`;
}
