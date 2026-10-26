-- Deals-for-you tiles on the home screen. Run against techxpertstore.
-- Safe to run again. Starts empty: staff pick categories later.
-- The row holds two tiles. The app keeps its own deals until it reads GET /cms/deals.

CREATE TABLE IF NOT EXISTS home_deals (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CategoryID INT NOT NULL,
  Title VARCHAR(32) NOT NULL,
  Highlight VARCHAR(24) NOT NULL DEFAULT '',
  Tagline VARCHAR(60) NOT NULL DEFAULT '',
  Tone VARCHAR(8) NOT NULL,
  ImageURL VARCHAR(1000) NOT NULL DEFAULT '',
  Position INT NOT NULL,
  INDEX idx_home_deals_position (Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
