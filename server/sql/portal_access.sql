-- Portal roles and module permissions (docs/PORTAL_ACCESS.md, phase A1).
-- Run after portal_audit_logs.sql, then portal_scope.sql and portal_staff.sql. Never touches homecare.
-- Usage: mysql -u root -p < server/sql/portal_access.sql

CREATE TABLE IF NOT EXISTS techxpertstore.portal_roles (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(80) NOT NULL,
  Description VARCHAR(255) NULL,
  CreatedBy INT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy INT NULL,
  UpdatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_portal_roles_name (Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS techxpertstore.portal_role_permissions (
  RoleID INT NOT NULL,
  Module VARCHAR(40) NOT NULL,
  CanView TINYINT(1) NOT NULL DEFAULT 0,
  CanEdit TINYINT(1) NOT NULL DEFAULT 0,
  CanDelete TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (RoleID, Module),
  CONSTRAINT fk_portal_role_permissions_role FOREIGN KEY (RoleID)
    REFERENCES techxpertstore.portal_roles (ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- portal_staff.sql renames AdminID to StaffID and points it at portal_staff (phase A3).
CREATE TABLE IF NOT EXISTS techxpertstore.portal_staff_roles (
  AdminID INT NOT NULL PRIMARY KEY,
  RoleID INT NOT NULL,
  AssignedBy INT NULL,
  AssignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_portal_staff_roles_role (RoleID),
  CONSTRAINT fk_portal_staff_roles_role FOREIGN KEY (RoleID)
    REFERENCES techxpertstore.portal_roles (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO techxpertstore.portal_roles (Name, Description) VALUES
  ('Store Admin', 'Everything in the portal, including roles and access'),
  ('Merchandiser', 'Runs the catalogue, orders, pricing and homepage. No deletes, no access management');

INSERT IGNORE INTO techxpertstore.portal_role_permissions (RoleID, Module, CanView, CanEdit, CanDelete)
SELECT r.ID, g.Module, g.CanView, g.CanEdit, g.CanDelete
FROM techxpertstore.portal_roles r
JOIN (
  SELECT 'products' Module, 1 CanView, 1 CanEdit, 1 CanDelete UNION ALL
  SELECT 'categories', 1, 1, 1 UNION ALL
  SELECT 'orders', 1, 1, 0 UNION ALL
  SELECT 'delivery', 1, 1, 0 UNION ALL
  SELECT 'customers', 1, 0, 0 UNION ALL
  SELECT 'pricing', 1, 1, 1 UNION ALL
  SELECT 'banners', 1, 1, 1 UNION ALL
  SELECT 'sections', 1, 1, 1 UNION ALL
  SELECT 'audit', 1, 0, 0 UNION ALL
  SELECT 'access', 1, 1, 1
) g
WHERE r.Name = 'Store Admin';

INSERT IGNORE INTO techxpertstore.portal_role_permissions (RoleID, Module, CanView, CanEdit, CanDelete)
SELECT r.ID, g.Module, g.CanView, g.CanEdit, g.CanDelete
FROM techxpertstore.portal_roles r
JOIN (
  SELECT 'products' Module, 1 CanView, 1 CanEdit, 0 CanDelete UNION ALL
  SELECT 'categories', 1, 1, 0 UNION ALL
  SELECT 'orders', 1, 1, 0 UNION ALL
  SELECT 'delivery', 1, 0, 0 UNION ALL
  SELECT 'customers', 1, 0, 0 UNION ALL
  SELECT 'pricing', 1, 1, 0 UNION ALL
  SELECT 'banners', 1, 1, 0 UNION ALL
  SELECT 'sections', 1, 1, 0 UNION ALL
  SELECT 'audit', 1, 0, 0
) g
WHERE r.Name = 'Merchandiser';

ALTER TABLE techxpertstore.portal_audit_logs
  MODIFY entity ENUM('banner','section','bulk_tier','product','publish','order','category','delivery','access','store') NOT NULL;
