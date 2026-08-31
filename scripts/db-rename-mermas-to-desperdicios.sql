-- Rename mermas → desperdicios (Neon development / prod — run once per branch).
-- Safe: renames enum values and tables in place (no data loss).

ALTER TYPE "CustomerModule" RENAME VALUE 'MERMAS' TO 'DESPERDICIOS';

ALTER TYPE "ProductStockKind" RENAME VALUE 'MERMA' TO 'DESPERDICIO';

ALTER TABLE "MermaEntry" RENAME TO "DesperdicioEntry";
ALTER TABLE "MermaLine" RENAME TO "DesperdicioLine";
