-- Saved items (wishlist). Run once against techxpertstore. Safe to run again.
-- The old API ignores this table. A customer list is keyed by UserID; a guest list by SessionID.

CREATE TABLE IF NOT EXISTS saved_items (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  UserID INT NULL,
  SessionID VARCHAR(128) NULL,
  ProductID INT NOT NULL,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  OwnerKey VARCHAR(160) AS (
    CASE
      WHEN UserID IS NOT NULL THEN CONCAT('u:', UserID)
      ELSE CONCAT('s:', SessionID)
    END
  ) STORED,
  CONSTRAINT chk_saved_owner CHECK (
    (UserID IS NOT NULL AND SessionID IS NULL) OR (UserID IS NULL AND SessionID IS NOT NULL)
  ),
  UNIQUE KEY uq_saved_owner_product (OwnerKey, ProductID),
  INDEX idx_saved_user (UserID),
  INDEX idx_saved_session (SessionID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
