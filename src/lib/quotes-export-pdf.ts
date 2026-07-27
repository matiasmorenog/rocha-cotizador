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
};

const MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COL = {
  code: 52,
  qty: 42,
  name: CONTENT_WIDTH - 52 - 42 - 72 - 78,
  price: 72,
  amount: 78,
} as const;

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - MARGIN;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function drawTableHeader(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#525252")
    .text("Cód.", MARGIN, y, { width: COL.code })
    .text("Cant.", MARGIN + COL.code, y, { width: COL.qty })
    .text("Artículo", MARGIN + COL.code + COL.qty, y, { width: COL.name })
    .text("Precio", MARGIN + COL.code + COL.qty + COL.name, y, {
      width: COL.price,
      align: "right",
    })
    .text("Importe", MARGIN + COL.code + COL.qty + COL.name + COL.price, y, {
      width: COL.amount,
      align: "right",
    });
  doc
    .moveTo(MARGIN, y + 12)
    .lineTo(MARGIN + CONTENT_WIDTH, y + 12)
    .strokeColor("#d4d4d4")
    .lineWidth(0.5)
    .stroke();
  doc.y = y + 16;
  doc.fillColor("#171717");
}

function drawQuoteBlock(doc: PDFKit.PDFDocument, quote: QuoteForPdf) {
  ensureSpace(doc, 56);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#171717")
    .text(`Remito ${quote.number}`, MARGIN, doc.y, { continued: false });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#525252")
    .text(formatArgentinaDateTime(quote.createdAt), MARGIN, doc.y + 2);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#171717")
    .text(
      `Entrega: ${formatDeliveryDateLabel(quote.deliveryDate)}`,
      MARGIN,
      doc.y + 2,
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#171717")
    .text(
      `${quote.customer.code} — ${quote.customer.name}`,
      MARGIN,
      doc.y + 2,
    );

  doc.moveDown(0.4);
  drawTableHeader(doc);

  if (quote.items.length === 0) {
    ensureSpace(doc, 20);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#737373")
      .text("Sin ítems", MARGIN, doc.y);
    doc.moveDown(0.5);
  } else {
    for (const item of quote.items) {
      ensureSpace(doc, 36);
      const y = doc.y;
      const unitLabel = quoteLineMeasureLabel(
        item.orderByUnit === true,
        item.allowsUnitOrder === true,
      );
      const nameText = item.orderByUnit
        ? `${item.productName}\n(${UNIT_ORDER_PRICE_WARNING})`
        : item.productName;
      const nameHeight = doc.heightOfString(nameText, {
        width: COL.name,
      });
      const rowHeight = Math.max(12, nameHeight);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#171717")
        .text(item.productCode, MARGIN, y, { width: COL.code })
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

      doc.y = y + rowHeight + 4;
    }
  }

  ensureSpace(doc, 24);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#171717")
    .text(`Total: ${formatPrice(quote.total)}`, MARGIN, doc.y + 4, {
      width: CONTENT_WIDTH,
      align: "right",
    });

  doc.moveDown(0.6);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
    .strokeColor("#e5e5e5")
    .lineWidth(0.75)
    .stroke();
  doc.moveDown(0.8);
}

/**
 * Multi-remito PDF for wholesale ops: cover header + one block per quote.
 */
export function buildQuotesExportPdf(input: BuildQuotesPdfInput): Promise<Buffer> {
  const { quotes, from, to } = input;
  const sumTotals = quotes.reduce((acc, q) => {
    const n =
      typeof q.total === "number"
        ? q.total
        : typeof q.total === "string"
          ? parseFloat(q.total)
          : typeof q.total.toNumber === "function"
            ? q.total.toNumber()
            : parseFloat(q.total.toString());
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      info: {
        Title: "Cotizaciones — Rocha Cotizador",
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
      .text("Exportación de cotizaciones", MARGIN, doc.y + 6);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#525252")
      .text(`Desde: ${formatArgentinaDateTime(from)}`, MARGIN, doc.y + 10)
      .text(`Hasta (excl.): ${formatArgentinaDateTime(to)}`)
      .text(`Cotizaciones: ${quotes.length}`)
      .text(`Suma totales: ${formatPrice(sumTotals)}`);

    doc.moveDown(0.8);
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor("#a3a3a3")
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.8);

    if (quotes.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#737373")
        .text("No hay cotizaciones en este rango.", MARGIN, doc.y);
    } else {
      for (const quote of quotes) {
        drawQuoteBlock(doc, quote);
      }
    }

    doc.end();
  });
}

export function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
