-- Store-owned staff list (docs/PORTAL_ACCESS.md, phase A3).
-- Run after portal_access.sql and portal_scope.sql, before restarting the API on the A3 code. Safe to run again.
-- Never writes to homecare. Linked staff point at homecare.admin_users.admin_id, read-only.
-- Usage: mysql -u root -p < server/sql/portal_staff.sql
-- Then create the first super admin: cd server && npm run staff:bootstrap

USE techxpertstore;

-- Each row is exactly one kind: a store login (own name, email, password) or a linked Homecare login.
CREATE TABLE IF NOT EXISTS portal_staff (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  HomecareAdminID INT NULL COMMENT 'Linked: homecare.admin_users.admin_id (other schema, so no foreign key)',
  Name VARCHAR(120) NULL COMMENT 'Store login only; linked staff read their name from Homecare',
  Email VARCHAR(190) NULL COMMENT 'Store login only; lower-case',
  PasswordHash VARCHAR(100) NULL COMMENT 'Store login only; bcrypt',
  IsSuperAdmin TINYINT(1) NOT NULL DEFAULT 0,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  MustChangePassword TINYINT(1) NOT NULL DEFAULT 0,
  PasswordChangedAt TIMESTAMP NULL DEFAULT NULL COMMENT 'Tokens issued before this second are refused',
  LastLoginAt TIMESTAMP NULL DEFAULT NULL,
  CreatedBy INT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy INT NULL,
  UpdatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_portal_staff_email (Email),
  UNIQUE KEY uq_portal_staff_homecare (HomecareAdminID),
  CONSTRAINT chk_portal_staff_kind CHECK (
    (HomecareAdminID IS NULL AND Name IS NOT NULL AND Email IS NOT NULL AND PasswordHash IS NOT NULL)
    OR (HomecareAdminID IS NOT NULL AND Email IS NULL AND PasswordHash IS NULL)
  )
) ENGINE=InnoDB AUTO_INCREMENT=1001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS tx_portal_staff;
DELIMITER //
CREATE PROCEDURE tx_portal_staff()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = 'techxpertstore' AND TABLE_NAME = 'portal_staff_roles' AND COLUMN_NAME = 'AdminID') THEN
    -- Every existing row is a Homecare admin id whose store role was copied from its Homecare role.
    -- Decision (A3): those copies are removed; people are added or linked on purpose.
    DELETE FROM portal_staff_scope;
    DELETE FROM portal_staff_roles;
    ALTER TABLE portal_staff_scope DROP FOREIGN KEY fk_portal_staff_scope_staff;
    ALTER TABLE portal_staff_roles RENAME COLUMN AdminID TO StaffID;
    ALTER TABLE portal_staff_scope RENAME COLUMN AdminID TO StaffID;
    ALTER TABLE portal_staff_roles
      ADD CONSTRAINT fk_portal_staff_roles_staff FOREIGN KEY (StaffID) REFERENCES portal_staff (ID) ON DELETE CASCADE;
    ALTER TABLE portal_staff_scope
      ADD CONSTRAINT fk_portal_staff_scope_staff FOREIGN KEY (StaffID) REFERENCES portal_staff_roles (StaffID) ON DELETE CASCADE;
  END IF;
END //
DELIMITER ;

CALL tx_portal_staff();
DROP PROCEDURE IF EXISTS tx_portal_staff;
