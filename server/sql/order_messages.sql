-- One confirmation per order, by text or WhatsApp. Safe to run again.
-- The phone number is not stored. Starts with confirmation switched off.
-- A missing table does not stop an order from being placed.

CREATE TABLE IF NOT EXISTS techxpertstore.order_messages (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  OrderID INT NOT NULL,
  Channel ENUM('sms', 'whatsapp') NOT NULL,
  Status ENUM('sent', 'failed') NOT NULL,
  Detail VARCHAR(200) NOT NULL,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  UNIQUE KEY uq_order_message (OrderID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO techxpertstore.shop_settings (SettingKey, SettingValue, Enabled)
VALUES ('orderNotice', 'off', 0);
