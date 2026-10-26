-- Pack size on a product. 1 means any whole number from the minimum.
-- Safe to run again. Existing products stay at 1, so current orders are unchanged.

SET @quantity_step_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'QuantityStep'
);
SET @quantity_step_sql := IF(
  @quantity_step_exists = 0,
  'ALTER TABLE products ADD COLUMN QuantityStep INT NOT NULL DEFAULT 1 AFTER MaxOrderQuantity',
  'SELECT 1'
);
PREPARE quantity_step_stmt FROM @quantity_step_sql;
EXECUTE quantity_step_stmt;
DEALLOCATE PREPARE quantity_step_stmt;
