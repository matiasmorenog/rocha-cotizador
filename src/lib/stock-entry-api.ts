import { Decimal } from "@prisma/client/runtime/library";
import type { CustomerModule } from "@prisma/client";
import { z } from "zod";
import { customerHasModule } from "@/lib/customer-modules";
import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import { getActiveProductsBase } from "@/lib/products-cache";
import { productWhereForModule } from "@/lib/stock-rubros";
import {
  serializeStockLinesWithProducts,
  stockLineFlatSelect,
  type ProductReportRow,
} from "@/lib/stock-line-serialize";
import { resolveStockProductReportMap } from "@/lib/stock-product-lookup";
import {
  coerceStockUnitForProduct,
  isValidStockUnitForProduct,
} from "@/lib/stock-units";

export const stockEntryLineSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1).max(32).optional(),
});

export const stockEntryBodySchema = z.object({
  customerId: z.string().min(1),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
  lines: z.array(stockEntryLineSchema).min(1),
});

function mapEntryLines(
  lines: Array<{
    productId: string;
    unit: string;
    qty: { toNumber?: () => number } | number | string;
  }>,
  productById: Map<string, ProductReportRow>,
) {
  return serializeStockLinesWithProducts(lines, productById).map((line) => ({
    productId: line.productId,
    unit: line.unit,
    qty: line.qty,
    product: line.product,
  }));
}

const stockEntryDateSelect = {
  id: true,
  notes: true,
  lines: { select: stockLineFlatSelect },
} as const;

export async function loadStockEntryForDate(
  module: CustomerModule,
  customerId: string,
  entryDateYmd: string,
) {
  const entryDate = parseDateOnlyYmd(entryDateYmd);
  if (!entryDate) return null;

  const [entry, catalog] = await Promise.all([
    module === "MERMAS"
      ? db.mermaEntry.findUnique({
          where: { customerId_entryDate: { customerId, entryDate } },
          select: stockEntryDateSelect,
        })
      : db.consumableCount.findUnique({
          where: { customerId_entryDate: { customerId, entryDate } },
          select: stockEntryDateSelect,
        }),
    getActiveProductsBase(),
  ]);
  if (!entry) return null;

  const productById = await resolveStockProductReportMap(
    [...new Set(entry.lines.map((line) => line.productId))],
    catalog,
  );
  return {
    id: entry.id,
    notes: entry.notes,
    lines: mapEntryLines(entry.lines, productById),
  };
}

export async function upsertStockEntry(
  module: CustomerModule,
  customerId: string,
  body: z.infer<typeof stockEntryBodySchema>,
  submittedBy: string | null,
) {
  if (!(await customerHasModule(customerId, module))) {
    return { error: "Cliente sin módulo habilitado", status: 403 as const };
  }

  const entryDate = parseDateOnlyYmd(body.entryDate);
  if (!entryDate) {
    return { error: "Fecha inválida", status: 400 as const };
  }

  const productIds = [...new Set(body.lines.map((l) => l.productId))];
  const moduleKey = module === "MERMAS" ? "MERMAS" : "CONSUMABLES";
  const moduleFilter = productWhereForModule(moduleKey);
  const validProducts = await db.product.findMany({
    where: { id: { in: productIds }, ...moduleFilter },
    select: { id: true, allowsUnitOrder: true, code: true },
  });
  if (validProducts.length !== productIds.length) {
    const validSet = new Set(validProducts.map((p) => p.id));
    const invalidIds = productIds.filter((id) => !validSet.has(id));
    const invalidRows =
      invalidIds.length > 0
        ? await db.product.findMany({
            where: { id: { in: invalidIds } },
            select: { code: true },
          })
        : [];
    const codes = invalidRows.map((p) => p.code).join(", ");
    const moduleLabel = module === "MERMAS" ? "mermas" : "consumibles";
    return {
      error:
        codes.length > 0
          ? `Productos no válidos para ${moduleLabel}: ${codes}`
          : "Hay productos inválidos en la carga",
      status: 400 as const,
    };
  }

  const productById = new Map(validProducts.map((p) => [p.id, p]));
  const lineCreates: Array<{
    productId: string;
    unit: string;
    qty: Decimal;
  }> = [];
  for (const l of body.lines) {
    const product = productById.get(l.productId);
    if (!product) continue;
    const unit = coerceStockUnitForProduct(l.unit, product.allowsUnitOrder);
    if (!isValidStockUnitForProduct(unit, product.allowsUnitOrder)) {
      return { error: "Unidad inválida para un producto", status: 400 as const };
    }
    lineCreates.push({
      productId: l.productId,
      unit,
      qty: new Decimal(l.qty),
    });
  }

  if (module === "MERMAS") {
    const entry = await db.$transaction(async (tx) => {
      const existing = await tx.mermaEntry.findUnique({
        where: { customerId_entryDate: { customerId, entryDate } },
        select: { id: true },
      });
      if (existing) {
        await tx.mermaLine.deleteMany({ where: { entryId: existing.id } });
        return tx.mermaEntry.update({
          where: { id: existing.id },
          data: {
            notes: body.notes?.trim() || null,
            submittedBy,
            lines: { create: lineCreates },
          },
          select: { id: true },
        });
      }
      return tx.mermaEntry.create({
        data: {
          customerId,
          entryDate,
          notes: body.notes?.trim() || null,
          submittedBy,
          lines: { create: lineCreates },
        },
        select: { id: true },
      });
    });
    return { id: entry.id, ok: true as const };
  }

  const entry = await db.$transaction(async (tx) => {
    const existing = await tx.consumableCount.findUnique({
      where: { customerId_entryDate: { customerId, entryDate } },
      select: { id: true },
    });
    if (existing) {
      await tx.consumableCountLine.deleteMany({ where: { countId: existing.id } });
      return tx.consumableCount.update({
        where: { id: existing.id },
        data: {
          notes: body.notes?.trim() || null,
          submittedBy,
          lines: { create: lineCreates },
        },
        select: { id: true },
      });
    }
    return tx.consumableCount.create({
      data: {
        customerId,
        entryDate,
        notes: body.notes?.trim() || null,
        submittedBy,
        lines: { create: lineCreates },
      },
      select: { id: true },
    });
  });
  return { id: entry.id, ok: true as const };
}
