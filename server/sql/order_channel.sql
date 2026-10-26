-- Which customer app placed the order. Safe to run again.
-- Null means the order was placed before this, or staff placed it.
-- Run after orders exists.

CREATE TABLE IF NOT EXISTS order_channel (
  OrderID INT NOT NULL PRIMARY KEY,
  Channel ENUM('store_app', 'homecare_app') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
