-- Run once against the store MySQL instance (fixes GET /audit/logs 503).
-- Usage: mysql -u root -p < server/sql/portal_audit_logs.sql

CREATE TABLE IF NOT EXISTS techxpertstore.portal_audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  entity ENUM('banner', 'section', 'bulk_tier', 'product', 'publish', 'order', 'category', 'delivery', 'access', 'store') NOT NULL,
  details TEXT NULL,
  actor VARCHAR(255) NOT NULL DEFAULT 'Store Admin',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_entity (entity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
