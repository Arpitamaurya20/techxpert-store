-- Highlights and specifications on the product page. Run against techxpertstore.
-- Safe to run again. Starts empty: staff fill them on the product screen later.

CREATE TABLE IF NOT EXISTS product_highlights (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ProductID INT NOT NULL,
  Text VARCHAR(160) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_product_highlights (ProductID, Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_specifications (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ProductID INT NOT NULL,
  SpecLabel VARCHAR(80) NOT NULL,
  SpecValue VARCHAR(160) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_product_specifications (ProductID, Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
