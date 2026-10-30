-- Indexes for the product list, found with SHOW INDEX and EXPLAIN on production.
-- Safe to run again: an index that already exists is skipped. No data changes.
-- Online: each ADD INDEX asks for ALGORITHM=INPLACE, LOCK=NONE, so it fails instead of locking the table.
-- Run in a quiet hour, then run ANALYZE TABLE products, product_pricing; and re-check EXPLAIN (bottom of this file).
--
-- Not added, because what exists already does the job:
--   products (IsActive, CategoryID, ID) and (IsActive, IsFeatured, ID):
--     idx_CategoryID / idx_IsFeatured already end in ID (InnoDB appends the primary key), so ORDER BY ID needs no sort,
--     and IsActive is 1 for nearly every row, so it filters almost nothing.
--   product_variants (ProductID, ID, StockQuantity): idx_ProductID already finds the first option in one step,
--     and a product has about one option, so a covering index saves one lookup per row.
--
-- Left in place for now, to drop later once EXPLAIN shows the new ones are used:
--   product_pricing.idx_ProductID is a prefix of idx_pricing_product_active_price.
--   product_pricing.idx_IsActive  is a prefix of idx_pricing_active_price_product.

USE techxpertstore;

DROP PROCEDURE IF EXISTS tx_add_index;
DELIMITER //
CREATE PROCEDURE tx_add_index(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN cols VARCHAR(255))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx
  ) THEN
    SET @tx_add_index_sql := CONCAT(
      'ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', cols, '), ALGORITHM=INPLACE, LOCK=NONE'
    );
    PREPARE tx_add_index_stmt FROM @tx_add_index_sql;
    EXECUTE tx_add_index_stmt;
    DEALLOCATE PREPARE tx_add_index_stmt;
  END IF;
END //
DELIMITER ;

-- 1. Price and MRP lookups per product, and the "has a selling price" check, answered from the index alone.
CALL tx_add_index('product_pricing', 'idx_pricing_product_active_price', 'ProductID, IsActive, SellingPrice, MRP');

-- 2. Lets the customer list start from the few rows with a selling price
--    instead of reading about 54,000 active products and checking each one.
CALL tx_add_index('product_pricing', 'idx_pricing_active_price_product', 'IsActive, SellingPrice, ProductID');

-- 3. Brand filter, and GET /catalog/brands (GROUP BY Brand over active products).
--    If MySQL says the key is too long, use a prefix: Brand(191).
CALL tx_add_index('products', 'idx_products_brand_active', 'Brand, IsActive');

DROP PROCEDURE IF EXISTS tx_add_index;

-- Check after running (look for the new key names and a small "rows" figure on the first line):
--   EXPLAIN SELECT p.ID FROM products p
--     WHERE p.IsActive = 1
--       AND EXISTS (SELECT 1 FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1 AND pr.SellingPrice > 0)
--     ORDER BY p.ID LIMIT 51;
--   EXPLAIN SELECT Brand, COUNT(*) FROM products WHERE Brand IS NOT NULL AND Brand != '' AND IsActive = 1 GROUP BY Brand;
