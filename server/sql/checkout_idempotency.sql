-- Checkout Idempotency-Key storage (Phase 1). Safe to run again.
-- Unique per customer + key. Rows expire after 24 hours (app enforces on read).

CREATE TABLE IF NOT EXISTS checkout_idempotency (
  ID BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  UserID INT NOT NULL,
  IdempotencyKey VARCHAR(128) NOT NULL,
  RequestHash CHAR(64) NOT NULL,
  Status ENUM('pending', 'completed') NOT NULL DEFAULT 'pending',
  StatusCode INT NULL,
  ResponseJson MEDIUMTEXT NULL,
  ExpiresAt DATETIME NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_checkout_idempotency_user_key (UserID, IdempotencyKey),
  KEY ix_checkout_idempotency_expires (ExpiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
