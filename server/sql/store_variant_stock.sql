-- Per-store stock. No row means that store still sells the company figure on product_variants.
-- A row is only what that store can sell, and the rows for one option cannot add up to more than the company figure.
-- Safe to run again.

CREATE TABLE IF NOT EXISTS techxpertstore.store_variant_stock (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  StoreID INT NOT NULL,
  VariantID INT NOT NULL,
  StockQuantity INT NOT NULL,
  UNIQUE KEY uniq_store_variant (StoreID, VariantID),
  INDEX idx_store_stock_variant (VariantID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
