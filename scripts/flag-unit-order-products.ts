import { PrismaClient } from "@prisma/client";
import { UNIT_ORDER_PRODUCT_CODES } from "../src/lib/unit-order-products";

async function main() {
  const db = new PrismaClient();
  const codes = [...UNIT_ORDER_PRODUCT_CODES];
  const r = await db.product.updateMany({
    where: { code: { in: codes } },
    data: { allowsUnitOrder: true },
  });
  const count = await db.product.count({ where: { allowsUnitOrder: true } });
  console.log(`Unit-order flag: updated=${r.count}, total flagged=${count}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
