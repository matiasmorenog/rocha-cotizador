-- Rename Product.active → available (stock foundation PR).
-- Safe to run once on DBs that still have the old column name.
ALTER TABLE "Product" RENAME COLUMN "active" TO "available";
