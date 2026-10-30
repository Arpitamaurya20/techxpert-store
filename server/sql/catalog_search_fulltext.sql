-- FULLTEXT on product name + brand for ranked store search (MariaDB / MySQL).
-- Safe to run again. Does not change rows.
-- Note: MariaDB has no MySQL ngram parser; substring matches still use LIKE.
-- Short queries (1–2 letter tokens) keep using LIKE only (see catalogSearch.ts).
--
-- Usage: mysql -u root -p < sql/catalog_search_fulltext.sql
-- Then: ANALYZE TABLE techxpertstore.products;

USE techxpertstore;

DROP PROCEDURE IF EXISTS tx_add_fulltext;
DELIMITER //
CREATE PROCEDURE tx_add_fulltext()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND INDEX_NAME = 'ft_products_name_brand'
  ) THEN
    ALTER TABLE products
      ADD FULLTEXT INDEX ft_products_name_brand (ProductName, Brand);
  END IF;
END //
DELIMITER ;

CALL tx_add_fulltext();
DROP PROCEDURE IF EXISTS tx_add_fulltext;
