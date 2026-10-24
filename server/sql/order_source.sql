-- Where an order came from. Existing rows are the app.
-- Run once. Skip this statement if OrderSource is already there.

ALTER TABLE techxpertstore.orders
  ADD COLUMN OrderSource ENUM('app', 'request', 'staff') NOT NULL DEFAULT 'app' AFTER PaymentMethod;
