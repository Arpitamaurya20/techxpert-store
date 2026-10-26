-- A customer's "Talk to us" request. Nothing is ordered and no stock is held.
-- Safe to run again. After the audit table exists.

CREATE TABLE IF NOT EXISTS techxpertstore.talk_requests (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CustomerName VARCHAR(80) NOT NULL,
  CustomerPhone VARCHAR(10) NOT NULL,
  Pincode VARCHAR(6) NOT NULL,
  StoreID INT NOT NULL,
  Note VARCHAR(400) NULL,
  Status ENUM('new', 'closed') NOT NULL DEFAULT 'new',
  SubTotal DECIMAL(12,2) NOT NULL,
  TaxTotal DECIMAL(12,2) NOT NULL,
  ShippingCharges DECIMAL(12,2) NOT NULL,
  GrandTotal DECIMAL(12,2) NOT NULL,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  UpdatedDate DATE NULL,
  UpdatedTime TIME NULL,
  KEY idx_talk_status (Status, ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS techxpertstore.talk_request_lines (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  RequestID INT NOT NULL,
  ProductID INT NOT NULL,
  VariantID INT NOT NULL,
  ProductName VARCHAR(255) NOT NULL,
  VariantName VARCHAR(255) NULL,
  Quantity INT NOT NULL,
  UnitPrice DECIMAL(12,2) NOT NULL,
  LineTotal DECIMAL(12,2) NOT NULL,
  StockAtRequest INT NOT NULL,
  Note VARCHAR(255) NULL,
  KEY idx_talk_line (RequestID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE techxpertstore.portal_audit_logs
  MODIFY entity ENUM(
    'banner','section','bulk_tier','product','publish','order','category','delivery','access','store','help','about','policy','setting','request'
  ) NOT NULL;
