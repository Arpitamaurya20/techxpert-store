-- Privacy, terms, cancellation and shipping. Run against techxpertstore.
-- Safe to run again. Starts empty: staff paste the published text later.
-- The app keeps its own copies until it reads GET /cms/policies.

CREATE TABLE IF NOT EXISTS policy_pages (
  PolicyID VARCHAR(16) NOT NULL PRIMARY KEY,
  LastUpdated VARCHAR(40) NOT NULL DEFAULT '',
  SourceUrl VARCHAR(300) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS policy_intro (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  PolicyID VARCHAR(16) NOT NULL,
  Paragraph VARCHAR(800) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_policy_intro (PolicyID, Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS policy_sections (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  PolicyID VARCHAR(16) NOT NULL,
  Heading VARCHAR(120) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_policy_sections (PolicyID, Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS policy_blocks (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  SectionID INT NOT NULL,
  Kind ENUM('paragraph', 'list') NOT NULL,
  Paragraph VARCHAR(800) NULL,
  Position INT NOT NULL,
  INDEX idx_policy_blocks (SectionID, Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS policy_bullets (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  BlockID INT NOT NULL,
  Bullet VARCHAR(400) NOT NULL,
  Position INT NOT NULL,
  INDEX idx_policy_bullets (BlockID, Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE portal_audit_logs
  MODIFY entity ENUM(
    'banner','section','bulk_tier','product','publish','order','category','delivery','access','store','help','about','policy'
  ) NOT NULL;
