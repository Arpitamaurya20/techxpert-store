-- Home trust-strip claims. Run against techxpertstore.
-- Safe to run again. Starts empty: staff write the claims later.
-- The app keeps its own four claims until it reads GET /cms/trust.

CREATE TABLE IF NOT EXISTS trust_claims (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Label VARCHAR(32) NOT NULL,
  Icon VARCHAR(40) NOT NULL,
  Action VARCHAR(16) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_trust_claims_position (Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
