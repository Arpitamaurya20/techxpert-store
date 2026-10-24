-- Shop rules staff can change without a release.
-- A switched-off rule does not apply. Missing rows mean the built-in defaults
-- (delivery ₹99, free from ₹2,000, GST 18%, large-order and cash limits off).
-- Safe to run again.

CREATE TABLE IF NOT EXISTS techxpertstore.shop_settings (
  SettingKey VARCHAR(64) NOT NULL PRIMARY KEY,
  SettingValue VARCHAR(40) NULL,
  Enabled TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO techxpertstore.shop_settings (SettingKey, SettingValue, Enabled) VALUES
  ('largeOrderValue', NULL, 0),
  ('largeOrderQuantity', NULL, 0),
  ('codLimit', NULL, 0),
  ('freeDeliveryFrom', '2000', 1),
  ('deliveryFee', '99', 1),
  ('gstPercent', '18', 1);

ALTER TABLE techxpertstore.portal_audit_logs
  MODIFY entity ENUM(
    'banner','section','bulk_tier','product','publish','order','category','delivery','access','store','help','about','policy','setting'
  ) NOT NULL;
