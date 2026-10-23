-- Stores, groups and staff scope (docs/PORTAL_ACCESS.md, phase A2).
-- Run after portal_access.sql, before restarting the API on the A2 code. Safe to run again.
-- Never writes to homecare.
-- Usage: mysql -u root -p < server/sql/portal_scope.sql
--
-- If delivery pincodes have no store and there is not exactly one active store, the script stops after
-- creating the (empty) tables and changes nothing else. Link each pincode to its store, then run it again:
--   INSERT INTO techxpertstore.store_pincodes (StoreID, PincodeID) VALUES (<store id>, <pincodes.ID>);

USE techxpertstore;

CREATE TABLE IF NOT EXISTS store_groups (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(80) NOT NULL,
  Kind VARCHAR(40) NULL COMMENT 'Free label: Zone, Area, Cluster...',
  ParentID INT NULL COMMENT 'NULL = top level',
  ParentKey INT AS (COALESCE(ParentID, 0)) STORED,
  CreatedBy INT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy INT NULL,
  UpdatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_store_groups_sibling_name (ParentKey, Name),
  INDEX idx_store_groups_parent (ParentID),
  CONSTRAINT fk_store_groups_parent FOREIGN KEY (ParentID) REFERENCES store_groups (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A store with no row here sits at the top level.
CREATE TABLE IF NOT EXISTS store_group_stores (
  StoreID INT NOT NULL PRIMARY KEY,
  GroupID INT NOT NULL,
  UpdatedBy INT NULL,
  UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store_group_stores_group (GroupID),
  CONSTRAINT fk_store_group_stores_store FOREIGN KEY (StoreID) REFERENCES stores (ID),
  CONSTRAINT fk_store_group_stores_group FOREIGN KEY (GroupID) REFERENCES store_groups (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which store serves a pincode. Old links stay (IsActive = 0) as history; only one active link per pincode.
CREATE TABLE IF NOT EXISTS store_pincodes (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  StoreID INT NOT NULL,
  PincodeID INT NOT NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  ActivePincodeID INT AS (IF(IsActive = 1, PincodeID, NULL)) STORED,
  CreatedBy INT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedBy INT NULL,
  UpdatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_store_pincodes_active (ActivePincodeID),
  INDEX idx_store_pincodes_store (StoreID, IsActive),
  INDEX idx_store_pincodes_pincode (PincodeID),
  CONSTRAINT fk_store_pincodes_store FOREIGN KEY (StoreID) REFERENCES stores (ID),
  CONSTRAINT fk_store_pincodes_pincode FOREIGN KEY (PincodeID) REFERENCES pincodes (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Places a staff member covers. Whole company is portal_staff_roles.ScopeAll, not "no rows".
CREATE TABLE IF NOT EXISTS portal_staff_scope (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  AdminID INT NOT NULL,
  NodeType ENUM('group','store') NOT NULL,
  NodeID INT NOT NULL,
  AssignedBy INT NULL,
  AssignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_portal_staff_scope (AdminID, NodeType, NodeID),
  INDEX idx_portal_staff_scope_node (NodeType, NodeID),
  CONSTRAINT fk_portal_staff_scope_staff FOREIGN KEY (AdminID)
    REFERENCES portal_staff_roles (AdminID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS tx_portal_scope;
DELIMITER //
CREATE PROCEDURE tx_portal_scope()
BEGIN
  DECLARE active_stores INT DEFAULT 0;
  DECLARE only_store INT DEFAULT NULL;
  DECLARE unlinked INT DEFAULT 0;
  DECLARE msg VARCHAR(255);

  SELECT COUNT(*), MIN(ID) INTO active_stores, only_store FROM stores WHERE IsActive = 1;
  SELECT COUNT(*) INTO unlinked FROM pincodes p
  WHERE p.IsActive = 1
    AND NOT EXISTS (SELECT 1 FROM store_pincodes sp WHERE sp.PincodeID = p.ID AND sp.IsActive = 1);

  IF unlinked > 0 AND active_stores <> 1 THEN
    SET msg = CONCAT(unlinked, ' delivery pincode(s) have no store and there are ', active_stores,
                     ' active stores. Link each pincode in store_pincodes, then run this again.');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = msg;
  END IF;

  IF active_stores = 1 THEN
    -- One store today: it serves every pincode on the list (paused ones too, for when they resume).
    INSERT INTO store_pincodes (StoreID, PincodeID)
    SELECT only_store, p.ID FROM pincodes p
    WHERE NOT EXISTS (SELECT 1 FROM store_pincodes sp WHERE sp.PincodeID = p.ID AND sp.IsActive = 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = 'techxpertstore' AND TABLE_NAME = 'portal_staff_roles' AND COLUMN_NAME = 'ScopeAll') THEN
    ALTER TABLE portal_staff_roles ADD COLUMN ScopeAll TINYINT(1) NOT NULL DEFAULT 0 AFTER RoleID;
    -- Staff who already have a role keep seeing everything (decision D2).
    UPDATE portal_staff_roles SET ScopeAll = 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = 'techxpertstore' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'StoreID') THEN
    ALTER TABLE orders
      ADD COLUMN StoreID INT NULL COMMENT 'Store that serves the delivery pincode, fixed at checkout' AFTER CartID,
      ADD INDEX idx_orders_store (StoreID),
      ADD CONSTRAINT fk_orders_store FOREIGN KEY (StoreID) REFERENCES stores (ID);
    IF active_stores = 1 THEN
      UPDATE orders SET StoreID = only_store WHERE StoreID IS NULL;
    END IF;
  END IF;
END //
DELIMITER ;

CALL tx_portal_scope();
DROP PROCEDURE IF EXISTS tx_portal_scope;

-- Stores & Groups module for the seeded roles. Other roles get it from Roles & Access.
INSERT IGNORE INTO portal_role_permissions (RoleID, Module, CanView, CanEdit, CanDelete)
SELECT ID, 'stores', 1, 1, 1 FROM portal_roles WHERE Name = 'Store Admin';
INSERT IGNORE INTO portal_role_permissions (RoleID, Module, CanView, CanEdit, CanDelete)
SELECT ID, 'stores', 1, 0, 0 FROM portal_roles WHERE Name = 'Merchandiser';

ALTER TABLE portal_audit_logs
  MODIFY entity ENUM('banner','section','bulk_tier','product','publish','order','category','delivery','access','store') NOT NULL;
