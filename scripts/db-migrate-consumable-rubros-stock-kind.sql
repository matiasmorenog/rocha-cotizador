-- Consumibles por rubro (gaseosas, insumos, regalo).
UPDATE "Product"
SET "stockKind" = 'CONSUMABLE'
WHERE rubro IS NOT NULL
  AND lower(trim(rubro)) IN ('gaseosas', 'insumos', 'regalo');
