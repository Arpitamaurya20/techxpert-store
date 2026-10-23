-- Shop S3: place the order from the server cart (docs/SHOP_TRACK.md).
-- Run once against techxpertstore.

-- The cart an order was placed from. Unique, so one cart can only become one order;
-- checking out the same cart again returns that order.
ALTER TABLE orders
  ADD COLUMN CartID INT NULL AFTER UserID,
  ADD UNIQUE INDEX uq_orders_cart (CartID);

-- A cart that became an order.
ALTER TABLE carts
  MODIFY COLUMN Status ENUM('active', 'merged', 'abandoned', 'ordered') NOT NULL DEFAULT 'active';
