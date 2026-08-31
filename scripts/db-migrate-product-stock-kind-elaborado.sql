-- Backfill legacy products as elaborados (DESPERDICIO) for stock module routing.
UPDATE "Product"
SET "stockKind" = 'DESPERDICIO'
WHERE "stockKind" IS NULL;
