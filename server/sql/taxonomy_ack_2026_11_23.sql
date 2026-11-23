-- Taxonomy hygiene from docs/APP_TEAM_HANDOVER.md Ack 23 Nov 2026.
-- Run against techxpertstore. Safe to run again (guards on current state).
-- Does not touch the homecare schema.
--
-- What it does:
-- 1) Deactivates empty active category shells (and their empty subcategories).
-- 2) Merges the tiny duplicate Industrial (ID 11) into Industrial (ID 10):
--    moves its 7 Contactors SKUs onto Industrial Contactors (sub 27), then deactivates 11.
-- 3) Deactivates remaining empty cloned type folders called out in the ack
--    (Contactors/Relays under Electrical with 0 SKUs; empty Fans clones; etc.).
--
-- Review counts before production. Prefer a backup of categories, sub_categories, products.

USE techxpertstore;

-- ── 1. Empty active shelves ──────────────────────────────────────────────────
-- Electrical Appliances (1), Electronics (7), Automation (9), Fans (14)

UPDATE sub_categories sc
  INNER JOIN categories c ON c.ID = sc.CategoryID
SET sc.IsActive = 0
WHERE c.ID IN (1, 7, 9, 14)
  AND sc.IsActive = 1
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.SubCategoryID = sc.ID AND p.IsActive = 1
  );

UPDATE categories c
LEFT JOIN (
  SELECT CategoryID FROM products WHERE IsActive = 1 GROUP BY CategoryID
) live ON live.CategoryID = c.ID
SET c.IsActive = 0,
    c.UpdatedDate = CURDATE(),
    c.UpdatedTime = CURTIME()
WHERE c.ID IN (1, 7, 9, 14)
  AND c.IsActive = 1
  AND live.CategoryID IS NULL;

-- ── 2. Merge Industrial id 11 → id 10 ────────────────────────────────────────
-- Only when both rows are still active and named Industrial.

UPDATE products p
  INNER JOIN categories tiny ON tiny.ID = 11 AND tiny.IsActive = 1 AND tiny.CategoryName = 'Industrial'
  INNER JOIN categories keep ON keep.ID = 10 AND keep.IsActive = 1 AND keep.CategoryName = 'Industrial'
SET p.CategoryID = 10,
    p.SubCategoryID = CASE
      WHEN p.SubCategoryID = 37 THEN 27  -- Contactors (tiny) → Contactors (keep)
      WHEN p.SubCategoryID = 38 THEN 26  -- Relays
      WHEN p.SubCategoryID = 39 THEN 72  -- Sensors
      WHEN p.SubCategoryID = 40 THEN 25  -- PLC
      ELSE p.SubCategoryID
    END
WHERE p.CategoryID = 11;

UPDATE sub_categories
SET IsActive = 0
WHERE CategoryID = 11
  AND IsActive = 1
  AND EXISTS (
    SELECT 1 FROM categories keep
    WHERE keep.ID = 10 AND keep.IsActive = 1 AND keep.CategoryName = 'Industrial'
  );

UPDATE categories tiny
INNER JOIN categories keep
  ON keep.ID = 10 AND keep.IsActive = 1 AND keep.CategoryName = 'Industrial'
LEFT JOIN (
  SELECT CategoryID FROM products WHERE IsActive = 1 AND CategoryID = 11 GROUP BY CategoryID
) leftover ON leftover.CategoryID = tiny.ID
SET tiny.IsActive = 0,
    tiny.UpdatedDate = CURDATE(),
    tiny.UpdatedTime = CURTIME()
WHERE tiny.ID = 11
  AND tiny.IsActive = 1
  AND tiny.CategoryName = 'Industrial'
  AND leftover.CategoryID IS NULL;

-- ── 3. Empty cloned type names still active under other parents ──────────────
-- Contactors / Relays under Electrical with zero SKUs; Mixer Grinders under
-- Electrical Appliances (already empty parent); empty Fans clones (parent off).

UPDATE sub_categories
SET IsActive = 0
WHERE IsActive = 1
  AND ID IN (48, 51, 3, 54, 55, 57, 22)
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.SubCategoryID = sub_categories.ID AND p.IsActive = 1
  );

-- ── 4. Read-back checks (run manually after) ─────────────────────────────────
-- SELECT CategoryName, COUNT(*) FROM categories WHERE IsActive=1 GROUP BY CategoryName HAVING COUNT(*)>1;
-- SELECT ID, CategoryName, IsActive FROM categories WHERE ID IN (1,7,9,10,11,14);
-- SELECT COUNT(*) FROM products WHERE CategoryID=11 AND IsActive=1;  -- expect 0
