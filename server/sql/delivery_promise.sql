-- How many days a new order promises, and a short problem report on an order.
-- Safe to run again. The promise starts off. A missing table does not stop an order.
-- Run after staff_alerts.sql. The alert kind gains "problem".

CREATE TABLE IF NOT EXISTS techxpertstore.order_delivery (
  OrderID INT NOT NULL PRIMARY KEY,
  Days SMALLINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS techxpertstore.order_problems (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  OrderID INT NOT NULL,
  StoreID INT NOT NULL,
  Note VARCHAR(400) NOT NULL,
  Status ENUM('new', 'closed') NOT NULL DEFAULT 'new',
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  INDEX idx_order_problems_order (OrderID, ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO techxpertstore.shop_settings (SettingKey, SettingValue, Enabled)
VALUES ('deliveryDays', NULL, 0);

ALTER TABLE techxpertstore.staff_alerts
  MODIFY Kind ENUM('order', 'request', 'problem') NOT NULL;
