-- Campaign banners for the home carousel (portal CMS).
-- Safe to run again. Creates the table when missing and adds any missing columns.
--
-- Usage: mysql -u root -p < sql/cms_banners.sql

USE techxpertstore;

CREATE TABLE IF NOT EXISTS cms_banners (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(500) NULL,
  image_url VARCHAR(1000) NOT NULL,
  cta_label VARCHAR(100) NOT NULL DEFAULT 'Shop Now',
  cta_type ENUM('category', 'product', 'deals', 'external') NOT NULL DEFAULT 'category',
  cta_target VARCHAR(255) NOT NULL,
  status ENUM('draft', 'scheduled', 'published', 'paused', 'archived') NOT NULL DEFAULT 'published',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  display_order INT NOT NULL DEFAULT 1,
  terms_text TEXT NULL,
  location_scope VARCHAR(255) DEFAULT 'All serviceable zones',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_banners_status (status),
  INDEX idx_banners_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS tx_cms_banners_columns;
DELIMITER //
CREATE PROCEDURE tx_cms_banners_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_banners' AND COLUMN_NAME = 'subtitle'
  ) THEN
    ALTER TABLE cms_banners ADD COLUMN subtitle VARCHAR(500) NULL AFTER title;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_banners' AND COLUMN_NAME = 'terms_text'
  ) THEN
    ALTER TABLE cms_banners ADD COLUMN terms_text TEXT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_banners' AND COLUMN_NAME = 'location_scope'
  ) THEN
    ALTER TABLE cms_banners ADD COLUMN location_scope VARCHAR(255) DEFAULT 'All serviceable zones';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_banners' AND COLUMN_NAME = 'starts_at'
  ) THEN
    ALTER TABLE cms_banners ADD COLUMN starts_at DATETIME NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_banners' AND COLUMN_NAME = 'ends_at'
  ) THEN
    ALTER TABLE cms_banners ADD COLUMN ends_at DATETIME NULL;
  END IF;
END //
DELIMITER ;

CALL tx_cms_banners_columns();
DROP PROCEDURE IF EXISTS tx_cms_banners_columns;
